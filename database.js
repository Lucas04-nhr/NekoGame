const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');


dayjs.extend(utc);
dayjs.extend(timezone);
const chinaTimezone = 'Asia/Shanghai';

// 创建或连接数据库
const db = new sqlite3.Database('neko_game.db', (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("Connected to the database.");
    }
});

// 初始化数据库函数
function initializeDatabase() {
    db.serialize(() => {
        // 创建 games 表
        db.run(`
            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                icon BLOB,
                poster_vertical BLOB,
                poster_horizontal BLOB,
                path TEXT UNIQUE NOT NULL,
                total_time INTEGER DEFAULT 0
            )
        `, (err) => {
            if (err) {
                console.error("Error creating games table:", err.message);
            } else {
                console.log("Games table created or already exists.");
            }
        });

        // 创建 game_sessions 表
        db.run(`
            CREATE TABLE IF NOT EXISTS game_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id INTEGER NOT NULL,
                start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP,
                duration INTEGER,
                FOREIGN KEY (game_id) REFERENCES games (id)
            )
        `, (err) => {
            if (err) {
                console.error("Error creating game_sessions table:", err.message);
            } else {
                console.log("Game_sessions table created or already exists.");
            }
        });
        // 新增设置表
        db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `, (err) => {
            if (err) {
                console.error("Error creating settings table:", err.message);
            } else {
                console.log("settings table created or already exists.");
            }
        });

        // 创建分析数据缓存表
        db.run(`
            CREATE TABLE IF NOT EXISTS analysis_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_type TEXT NOT NULL,
                date DATE NOT NULL,
                data TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(analysis_type, date)
            )
        `, (err) => {
            if (err) console.error("Error creating analysis_cache table:", err.message);
            else console.log("Analysis cache table created or already exists.");
        });
    });
}

// 添加游戏信息
function addGame(gameData, callback) {
    const { name, icon, poster_vertical, poster_horizontal, path } = gameData;
    db.run(
        `INSERT INTO games (name, icon, poster_vertical, poster_horizontal, path) VALUES (?, ?, ?, ?, ?)`,
        [name, icon, poster_vertical, poster_horizontal, path],
        function (err) {
            if (err) return callback(err);
            callback(null, this.lastID);
        }
    );
}


function getSetting(key, callback) {
    db.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => {
        if (err) {
            console.error("Error fetching setting:", err);
            callback(err);
        } else {
            callback(null, row ? row.value : "false"); // 返回默认值 "false"
        }
    });
}


function setSetting(key, value, callback) {
    db.run(`INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, value], (err) => {
        if (err) {
            console.error("Error setting value:", err);
            callback(err);
        } else {
            callback(null);
        }
    });
}



// 导出数据库实例和初始化函数
module.exports = {
    db,
    initializeDatabase,
    addGame,
    startSession,  // 确保导出 startSession
    endSession,     // 确保导出 endSession
    getGameTimeData,
    getGameDetails,  
    getGameTrendData,
    deleteGame,
    updateGame,
    getSetting, 
    setSetting
};

// 获取游戏详细信息
function getGameDetails(gameId, callback) {
    db.get(`
        SELECT g.name, g.icon, g.poster_horizontal, g.poster_vertical, g.path,
               g.total_time, 
               (SELECT end_time FROM game_sessions WHERE game_id = g.id ORDER BY end_time DESC LIMIT 1) AS last_played,
               (SELECT CASE WHEN g.total_time > 0 THEN 
                   (SELECT COUNT(*) + 1 FROM games AS g2 WHERE g2.total_time > g.total_time)
                   ELSE '--' END) AS rank
        FROM games AS g
        WHERE g.id = ?
    `, [gameId], callback);
}
// 获取游戏时长趋势数据
function getGameTrendData(gameId, callback) {
    db.all(`
        SELECT DATE(start_time) AS date, SUM(duration) AS total_time
        FROM game_sessions
        WHERE game_id = ?
        GROUP BY DATE(start_time)
        ORDER BY date ASC
        LIMIT 12
    `, [gameId], callback);
}



function startSession(gameId, callback) {
    const startTime = dayjs().tz(chinaTimezone).format('YYYY-MM-DD HH:mm:ss');
    const initialDuration = 0;
    db.run(`
        INSERT INTO game_sessions (game_id, start_time, end_time, duration)
        VALUES (?, ?, ?, ?)
    `, [gameId, startTime, startTime, initialDuration], function (err) {
        if (err) {
            console.error("Error starting session:", err);
            callback(err);
        } else {
            callback(null, this.lastID); // 返回新 session 的 ID
        }
    });
}



function endSession(gameId, callback) {
    const endTime = new Date().toISOString();
    db.run(`
        UPDATE game_sessions 
        SET end_time = ?, duration = strftime('%s', ?) - strftime('%s', start_time)
        WHERE game_id = ? AND end_time IS NULL
    `, [endTime, endTime, gameId], function (err) {
        if (err) return callback(err);
        callback(null, this.changes);
    });
}


// 查询游戏时长数据
function getGameTimeData(callback) {
    const todayStart = dayjs().tz(chinaTimezone).startOf('day').toISOString();
    const twoWeeksAgo = dayjs().tz(chinaTimezone).subtract(14, 'days').toISOString();

    db.all(`
        SELECT 
            g.id,
            g.name,
            g.icon,
            g.poster_horizontal,
            g.poster_vertical,
            g.total_time,
            g.path,
            COALESCE(SUM(CASE WHEN s.start_time >= ? THEN s.duration ELSE 0 END), 0) AS today_time,
            COALESCE(SUM(CASE WHEN s.start_time >= ? THEN s.duration ELSE 0 END), 0) AS two_weeks_time
        FROM games g
        LEFT JOIN game_sessions s ON g.id = s.game_id
        GROUP BY g.id
        ORDER BY today_time DESC
    `, [todayStart, twoWeeksAgo], (err, rows) => {
        if (err) {
            console.error("Error fetching game time data:", err);
            callback(err);
        } else {
            callback(null, rows);
        }
    });
}

function deleteGame(gameId, callback) {
    db.run(`DELETE FROM games WHERE id = ?`, [gameId], function (err) {
        if (err) return callback(err);
        db.run(`DELETE FROM game_sessions WHERE game_id = ?`, [gameId], callback);
    });
}

// 检查路径是否已存在
function updateGame(gameData, callback) {
    const { id, name, icon, poster_vertical, poster_horizontal, path } = gameData;

    db.get(`SELECT id FROM games WHERE path = ? AND id != ?`, [path, id], (err, row) => {
        if (row) {
            return callback(new Error("游戏路径已存在"));
        }
        db.run(`
            UPDATE games SET name = ?, icon = ?, poster_vertical = ?, poster_horizontal = ?, path = ?
            WHERE id = ?
        `, [name, icon, poster_vertical, poster_horizontal, path, id], callback);
    });
}
