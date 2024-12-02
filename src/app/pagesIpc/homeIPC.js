const { ipcMain} = require('electron');
const { getAnalysisData, refreshAnalysisData, generateAnalysisData } = require('../../js/analysis');
const path = require("path");
const sqlite3 = require('sqlite3').verbose();
const { getGameTimeData} = require('../database'); // 确保导入 getGameTimeData

const db = new sqlite3.Database(path.join(process.env.NEKO_GAME_FOLDER_PATH, "neko_game.db"), (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("Connected to the database.");
    }
});

// 监听获取分析数据请求
ipcMain.handle('fetch-analysis-data', async (event, { type, range }) => {
    return new Promise((resolve, reject) => {
        getAnalysisData(type, range, (err, data, updatedAt) => {
            if (err) {
                console.error("Error fetching analysis data for", type, ":", err);
                reject(new Error(`Error fetching analysis data for ${type}: ${err.message || err}`));
            } else {
                resolve({ data, updatedAt });
            }
        });
    });
});

// 统一 refresh-analysis-data 格式
ipcMain.handle('refresh-analysis-data', async (event, type) => {
    return new Promise((resolve, reject) => {
        refreshAnalysisData(type, (err, data, updatedAt) => {
            if (err) {
                console.error("Error refreshing analysis data for", type, ":", err);
                reject(new Error(`Error refreshing analysis data for ${type}: ${err.message || err}`));
            } else {
                resolve({ data, updatedAt });
            }
        });
    });
});

// 获取排行榜数据
ipcMain.handle('getLeaderboardData', async () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT games.name, games.icon, games.poster_horizontal, MAX(game_sessions.end_time) AS end_time, SUM(game_sessions.duration) AS total_time
                FROM games
                LEFT JOIN game_sessions ON games.id = game_sessions.game_id
                GROUP BY games.id
                ORDER BY total_time DESC`,
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
    });
});

// 获取日志数据
ipcMain.handle('getLogData', async (event, page) => {
    const pageSize = 20;
    return new Promise((resolve, reject) => {
        db.all(`SELECT games.name AS game_name, games.icon, games.poster_horizontal, game_sessions.start_time, game_sessions.end_time, game_sessions.duration
                FROM game_sessions
                LEFT JOIN games ON games.id = game_sessions.game_id
                ORDER BY game_sessions.start_time DESC
                LIMIT ? OFFSET ?`,
            [pageSize, page * pageSize],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
    });
});


ipcMain.handle('get-log-data', async (event, page) => {
    const logsPerPage = 20;
    const offset = page * logsPerPage;

    return new Promise((resolve, reject) => {
        db.all(`
            SELECT game_sessions.*, games.name AS game_name, games.icon, games.poster_horizontal
            FROM game_sessions 
            JOIN games ON games.id = game_sessions.game_id
            ORDER BY game_sessions.start_time DESC
            LIMIT ? OFFSET ?`,
            [logsPerPage, offset],
            (err, rows) => {
                if (err) {
                    console.error("Error fetching log data:", err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            }
        );
    });
});

// 获取游戏时长数据
ipcMain.handle('get-game-time-data', (event) => {
    return new Promise((resolve, reject) => {
        getGameTimeData((err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
});