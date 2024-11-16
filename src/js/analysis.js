const sqlite3 = require('sqlite3').verbose();
const db = require('../database').db;
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Shanghai");

// 检查缓存并返回分析数据
// getAnalysisData
function getAnalysisData(type, range, callback = () => {}) {
    const today = dayjs().tz("Asia/Shanghai").format("YYYY-MM-DD");

    db.get(`
        SELECT data, updated_at FROM analysis_cache 
        WHERE analysis_type = ? AND date = ?`, 
        [type, today], 
        (err, row) => {
            if (err) {
                callback(err, null);
            } else if (row && row.data) {
                callback(null, JSON.parse(row.data), row.updated_at);
            } else {
                generateAnalysisData(type, range, (genErr, data) => {
                    if (genErr) {
                        callback(genErr, null);
                    } else {
                        const dataStr = JSON.stringify(data);
                        const updatedAt = dayjs().tz("Asia/Shanghai").format("YYYY-MM-DD HH:mm:ss");

                        db.run(`
                            INSERT OR REPLACE INTO analysis_cache (analysis_type, date, data, updated_at)
                            VALUES (?, ?, ?, ?)`, 
                            [type, today, dataStr, updatedAt], 
                            (insertErr) => {
                                if (insertErr) {
                                    callback(insertErr, null);
                                } else {
                                    callback(null, data, updatedAt);
                                }
                            });
                    }
                });
            }
        }
    );
}

// 生成分析数据
function generateAnalysisData(type, range, callback = () => {}) {
    const today = dayjs().tz("Asia/Shanghai").format("YYYY-MM-DD");
    const startDate = dayjs().subtract(6, 'months').startOf('month').format('YYYY-MM-DD');

    if (type === 'today_total_time') {
        db.all(`
            SELECT SUM(duration) AS total_time FROM game_sessions 
            WHERE DATE(start_time) = ?`, 
            [today], 
            (err, rows) => {
                if (err) {
                    console.error("Error generating today total time:", err);
                    callback(err, null);
                } else {
                    callback(null, { total_time_today: rows[0]?.total_time || 0 });
                }
            }
        );

    } else if (type === 'yesterday_total_time') {
        const yesterday = dayjs().subtract(1, 'day').tz("Asia/Shanghai").format("YYYY-MM-DD");
        db.all(`
            SELECT SUM(duration) AS total_time FROM game_sessions 
            WHERE DATE(start_time) = ?`, 
            [yesterday], 
            (err, rows) => {
                if (err) {
                    console.error("Error generating yesterday total time:", err);
                    callback(err, null);
                } else {
                    callback(null, { total_time_yesterday: rows[0]?.total_time || 0 });
                }
            }
        );

    } else if (type === 'weekly_game_time') {
        db.all(`
            SELECT games.name AS game_name, DATE(start_time) AS date, SUM(game_sessions.duration) AS total_time 
            FROM game_sessions 
            JOIN games ON games.id = game_sessions.game_id 
            WHERE DATE(start_time) >= ? 
            GROUP BY game_sessions.game_id, DATE(start_time) 
            ORDER BY date DESC`, 
            [startDate], 
            (err, rows) => {
                if (err) {
                    console.error("Error generating weekly game time data:", err);
                    callback(err, null);
                } else {
                    const data = rows.map(row => ({
                        game_name: row.game_name,
                        date: row.date,
                        total_time: row.total_time
                    }));
                    callback(null, data);
                }
            }
        );

    } else if (type === 'monthly_trend') {
        db.all(`
            SELECT DATE(start_time) AS date, SUM(duration) AS total_time 
            FROM game_sessions 
            WHERE DATE(start_time) >= ? 
            GROUP BY date 
            ORDER BY date DESC`, 
            [startDate], 
            (err, rows) => {
                if (err) {
                    console.error("Error generating monthly trend data:", err);
                    callback(err, null);
                } else {
                    const data = rows.map(row => ({
                        date: row.date,
                        total_time: row.total_time
                    }));
                    callback(null, data);
                }
            }
        );

    } else if (type === 'half_year_distribution') {
        db.all(`
            SELECT games.name AS game_name, DATE(start_time) AS date, SUM(game_sessions.duration) AS total_time 
            FROM game_sessions 
            JOIN games ON games.id = game_sessions.game_id 
            WHERE DATE(start_time) >= ? 
            GROUP BY games.id, DATE(start_time) 
            ORDER BY game_name, date`, 
            [startDate], 
            (err, rows) => {
                if (err) {
                    console.error("Error generating half-year distribution data:", err);
                    callback(err, null);
                } else {
                    const data = rows.map(row => ({
                        game_name: row.game_name,
                        date: row.date,
                        total_time: row.total_time
                    }));
                    callback(null, data);
                }
            }
        );

    } else if (type === 'total_time_distribution') {
        db.all(`
            SELECT games.name AS game_name, SUM(duration) AS total_time 
            FROM game_sessions 
            JOIN games ON games.id = game_sessions.game_id 
            GROUP BY game_sessions.game_id`, 
            (err, rows) => {
                if (err) {
                    console.error("Error generating total time distribution data:", err);
                    callback(err, null);
                } else {
                    const data = rows.map(row => ({
                        game_name: row.game_name,
                        total_time: row.total_time
                    }));
                    callback(null, data);
                }
            }
        );

    } else {
        callback(new Error(`Unknown analysis type: ${type}`), null);
    }
}




// 刷新指定分析数据
function refreshAnalysisData(type, callback = () => {}) {
    generateAnalysisData(type, null, (genErr, data) => {
        if (genErr) {
            callback(genErr);
            return;
        }
        
        const today = dayjs().tz("Asia/Shanghai").format("YYYY-MM-DD");
        const dataStr = JSON.stringify(data);
        const updatedAt = dayjs().tz("Asia/Shanghai").format("YYYY-MM-DD HH:mm:ss");

        db.run(`
            INSERT OR REPLACE INTO analysis_cache (analysis_type, date, data, updated_at)
            VALUES (?, ?, ?, ?)`, 
            [type, today, dataStr, updatedAt], 
            (insertErr) => {
                if (insertErr) {
                    callback(insertErr);
                } else {
                    callback(null, data, updatedAt);
                }
            });
    });
}





module.exports = {
    generateAnalysisData,
    getAnalysisData,
    refreshAnalysisData
};
