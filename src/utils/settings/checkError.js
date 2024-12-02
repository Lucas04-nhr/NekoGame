const {ipcMain, shell } = require('electron');
const {db} = require('../../app/database');
const dayjs = require('dayjs');

// 合并一年前的数据
function optimizeOldSessions() {
    return new Promise((resolve, reject) => {
        const oneYearAgo = dayjs().subtract(1, 'year').format('YYYY-MM-DD HH:mm:ss');
        let mergedCount = 0; // 记录合并的条数
        let resultMessage = ""; // 用于返回合并操作的结果

        db.serialize(() => {
            // 查找一年前的数据，按游戏和日期分组，合并同一天的多条记录
            db.all(`
                SELECT game_id, DATE(start_time) AS session_date,
                       MIN(start_time) AS first_start_time,
                       MAX(end_time) AS last_end_time,
                       SUM(duration) AS total_duration,
                       COUNT(*) AS record_count
                FROM game_sessions
                WHERE start_time < ?
                GROUP BY game_id, DATE(start_time)
            `, [oneYearAgo], (err, rows) => {
                if (err) {
                    resultMessage = '查询一年前的记录时发生问题: ' + err.message;
                    reject(resultMessage);
                    return;
                }

                rows.forEach(row => {
                    const { game_id, session_date, first_start_time, last_end_time, total_duration, record_count } = row;
                    // 如果当天只有一条记录，不进行更新
                    if (record_count > 1) {
                        // 更新合并后的记录，合并同一天的记录
                        db.run(`
                            UPDATE game_sessions
                            SET start_time = ?, end_time = ?, duration = ?
                            WHERE game_id = ? AND DATE(start_time) = ?
                        `, [first_start_time, last_end_time, total_duration, game_id, session_date], (err) => {
                            if (err) {
                                resultMessage = '更新合并后的记录时发生问题: ' + err.message;
                                reject(resultMessage);
                                return;
                            }
                            console.log(`合并游戏 ${game_id} 在 ${session_date} 的记录`);
                            mergedCount++;
                        });
                    } else {
                        console.log(`跳过游戏 ${game_id} 在 ${session_date} 的记录，因为只有一条记录`);
                    }
                });

                // 删除合并前的重复记录，只保留每个游戏的第一条记录
                db.run(`
                    DELETE FROM game_sessions
                    WHERE id NOT IN (
                        SELECT MIN(id)
                        FROM game_sessions
                        WHERE start_time < ? AND start_time IS NOT NULL
                        GROUP BY game_id, DATE(start_time)
                    )
                    AND start_time < ?  -- 确保只删除一年前的记录
                `, [oneYearAgo, oneYearAgo], (err) => {
                    if (err) {
                        resultMessage = '删除重复记录时发生问题: ' + err.message;
                        reject(resultMessage);
                        return;
                    }
                    console.log('删除了合并前的重复记录');
                    resultMessage = mergedCount > 0 ? `整理了 ${mergedCount} 条旧数据\n` : "";
                    resolve(resultMessage); // 返回合并操作的结果
                });
            });
        });
    });
}

ipcMain.handle("check-errors", async () => {
    return new Promise((resolve, reject) => {
        let resultMessage = "";  // 用于记录最终的清理信息
        let cacheChanges = 0;    // 记录缓存清理的条数

        db.serialize(() => {
            // 清理 end_time 为 NULL 或 end_time 小于 start_time 的数据
            db.run(`DELETE FROM game_sessions WHERE end_time IS NULL OR end_time < start_time`, [], function (err) {
                if (err) {
                    reject("检查错误时发生问题：" + err.message);
                    return;
                }
                const changes1 = this.changes;
                if (changes1 > 0) {
                    resultMessage += `已整理 ${changes1} 条异常时间记录。\n`;
                }
                // 清理 start_time 等于 end_time 的数据
                db.run(`DELETE FROM game_sessions WHERE start_time = end_time`, [], function (err) {
                    if (err) {
                        reject("检查开始时间等于结束时间的记录时发生问题：" + err.message);
                        return;
                    }
                    const changes2 = this.changes;
                    if (changes2 > 0) {
                        resultMessage += `已整理 ${changes2} 条开始时间等于结束时间的记录。\n`;
                    }

                    // 清理重复会话记录
                    db.run(`DELETE FROM game_sessions WHERE rowid NOT IN (
                        SELECT MIN(rowid)
                        FROM game_sessions
                        GROUP BY game_id, start_time
                    )`, [], function (err) {
                        if (err) {
                            reject("检查重复数据时发生问题：" + err.message);
                            return;
                        }
                        const changes3 = this.changes;
                        if (changes3 > 0) {
                            resultMessage += `已清理 ${changes3} 条重复记录。\n`;
                        }

                        // 清理 analysis_cache 表中过期数据
                        db.run(
                            `DELETE FROM analysis_cache 
                             WHERE updated_at < datetime('now', '-1 month')`,
                            [],
                            function (err) {
                                if (err) {
                                    reject("清理过期缓存记录时发生问题：" + err.message);
                                    return;
                                }
                                cacheChanges = this.changes; // 保存缓存清理的条数
                                if (cacheChanges > 0) {
                                    resultMessage += `已清理 ${cacheChanges} 条过期缓存数据。\n`;
                                }

                                // 执行 optimizeOldSessions() 合并旧数据
                                optimizeOldSessions()
                                    .then(optimizationMessage => {
                                        resultMessage += optimizationMessage;
                                        resolve(resultMessage || "没有需要整理的数据"); // 返回最终的清理信息
                                    })
                                    .catch(error => {
                                        reject("优化旧数据时发生问题：" + error);
                                    });
                            }
                        );
                    });
                });
            });
        });
    });
});


//打开数据文件夹逻辑
ipcMain.on('open-data-path', () => {
    const dataPath = process.env.NEKO_GAME_FOLDER_PATH;
    if (dataPath) {
        shell.openPath(dataPath).then(response => {
            if (response) {
                console.error("Failed to open data path:", response);
            }
        });
    } else {
        console.error("Data path not defined");
    }
});

