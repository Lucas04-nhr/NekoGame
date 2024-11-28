const {ipcMain, shell } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();


const db = new sqlite3.Database(path.join(process.env.NEKO_GAME_FOLDER_PATH, "neko_game.db"), (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    }
});
ipcMain.handle("check-errors", async () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            let cacheChanges = 0; // 记录缓存清理的条数
            // 清理 end_time 为 NULL 或 end_time 小于 start_time 的数据
            db.run(`DELETE FROM game_sessions WHERE end_time IS NULL OR end_time < start_time`, [], function (err) {
                if (err) {
                    reject("检查错误时发生问题：" + err.message);
                    return;
                }
                const changes1 = this.changes;

                // 清理 start_time 等于 end_time 的数据
                db.run(`DELETE FROM game_sessions WHERE start_time = end_time`, [], function (err) {
                    if (err) {
                        reject("检查开始时间等于结束时间的记录时发生问题：" + err.message);
                        return;
                    }
                    const changes2 = this.changes;

                    // 清理重复会话记录
                    db.run(`DELETE FROM game_sessions WHERE rowid NOT IN (
                        SELECT MIN(rowid)
                        FROM game_sessions
                        GROUP BY game_id, start_time
                    )`, [], function (err) {
                        if (err) {
                            reject("检查重复数据时发生问题：" + err.message);
                        } else {
                            const changes3 = this.changes;

                            // 清理 analysis_cache 表中过期数据
                            db.run(
                                `DELETE FROM analysis_cache 
                                 WHERE updated_at < datetime('now', '-1 month')`,
                                [],
                                function (err) {
                                    if (err) {
                                        reject("清理过期缓存记录时发生问题：" + err.message);
                                    } else {
                                        cacheChanges = this.changes; // 保存缓存清理的条数
                                        const totalChanges = changes1 + changes2 + changes3;
                                        let resultMessage = "";
                                        if (totalChanges > 0) {
                                            resultMessage += `已整理 ${totalChanges} 条异常时间记录。\n`;
                                        }
                                        if (cacheChanges > 0) {
                                            resultMessage += `已清理 ${cacheChanges} 条过期缓存数据。`;
                                        }
                                        resolve(resultMessage || "没有需要清理的数据。");
                                    }
                                }
                            );
                        }
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

