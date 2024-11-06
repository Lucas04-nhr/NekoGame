const { exec } = require('child_process');
const { startSession, endSession, db } = require('./database');
const { ipcMain } = require('electron');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
dayjs.extend(timezone);
const trackedGames = {}; // 记录当前正在追踪的游戏状态
const chinaTimezone = 'Asia/Shanghai';

// 初始化游戏列表，将游戏进程名添加到 `trackedGames` 对象中
function initializeTrackedGames() {
    db.all("SELECT id, name, path, total_time FROM games", (err, rows) => {
        if (err) {
            console.error("Error fetching games from database:", err);
            return;
        }
        rows.forEach(row => {
            // 使用进程名（仅文件名部分）作为 key
            const processName = row.path.split('\\').pop(); // 只保留 `game.exe`
            trackedGames[processName] = { 
                id: row.id, 
                isRunning: false, 
                sessionId: null,
                totalTime: row.total_time // 初始化总时长
            };
        });
    });
}


// 检测后台运行的进程并实时更新时长
function detectRunningGames() {
    exec('tasklist', (err, stdout) => {
        if (err) {
            console.error("Error fetching process list:", err);
            return;
        }

        Object.keys(trackedGames).forEach(processName => {
            const game = trackedGames[processName];
            const isRunning = stdout.includes(processName);

            if (isRunning && !game.isRunning) {
                // 游戏刚启动
                game.isRunning = true;
                startSession(game.id, (err, sessionId) => {
                    if (err) {
                        console.error("Error starting session:", err);
                    } else {
                        console.log(`Started session for ${processName}`);
                        game.sessionId = sessionId;
                        sendRunningStatus();
                    }
                });
            } else if (isRunning && game.isRunning && game.sessionId) {
                // 游戏仍在运行，实时更新结束时间、时长和 `total_time`
                const endTime = dayjs().tz(chinaTimezone).format('YYYY-MM-DD HH:mm:ss');
                const increment = 15;

                db.run(`
                    UPDATE game_sessions 
                    SET end_time = ?, duration = strftime('%s', ?) - strftime('%s', start_time)
                    WHERE id = ? AND datetime(end_time) >= datetime(start_time) 
                `, [endTime, endTime, game.sessionId], (err) => {
                    if (err) console.error("Error updating session duration:", err);
                });

                game.totalTime += increment;
                db.run(`UPDATE games SET total_time = ? WHERE id = ?`, [game.totalTime, game.id], (err) => {
                    if (err) console.error("Error updating total time:", err);
                });

                sendRunningStatus();
            } else if (!isRunning && game.isRunning && game.sessionId) {
                // 游戏刚关闭，结束会话
                game.isRunning = false;

                // 检查结束时间有效性
                db.get(`SELECT start_time, end_time FROM game_sessions WHERE id = ?`, [game.sessionId], (err, session) => {
                    if (err) {
                        console.error("Error fetching session:", err);
                        return;
                    }

                    if (!session || session.end_time === null) {
                        // 删除无效的会话
                        db.run(`DELETE FROM game_sessions WHERE id = ?`, [game.sessionId], (err) => {
                            if (err) console.error("Error deleting invalid session:", err);
                        });
                    } else {
                        // 正常结束会话
                        endSession(game.id, (err) => {
                            if (err) {
                                console.error("Error ending session:", err);
                            } else {
                                console.log(`Ended session for ${processName}`);
                                game.sessionId = null;
                                sendRunningStatus();
                            }
                        });
                    }
                });
            }
        });
    });
}


// 向前端发送游戏运行状态
function sendRunningStatus() {
    //if (!mainWindow || !mainWindow.webContents) return; // 添加保护性判断
    const runningStatus = Object.keys(trackedGames).map(processName => {
        const game = trackedGames[processName];
        return { id: game.id, isRunning: game.isRunning };
    });
    //mainWindow.webContents.send('running-status-updated', runningStatus);
    ipcMain.emit('running-status-updated', null, runningStatus);  // 发送到主进程
}


// 启动检测循环，每15秒检测一次
function startGameTracking() {
    initializeTrackedGames();
    setInterval(() => detectRunningGames(), 15000);
}

module.exports = {
    startGameTracking,
    initializeTrackedGames
};
