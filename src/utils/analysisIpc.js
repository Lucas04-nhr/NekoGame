const { ipcMain } = require('electron');
const { db2 } = require('../database'); // 引入数据库实例
const { parseGachaUrl, fetchAllGachaLogs } = require('./gachaUtils'); // 工具方法
const { getGamePath, extractGachaUrl } = require("./getWutheringWavesPath"); // 获取游戏路径和祈愿链接

const db = db2; // 数据库实例

/**
 * 获取上次查询的玩家 UID
 */
ipcMain.handle('get-last-query-uid', async () => {
    try {
        const row = await new Promise((resolve, reject) => {
            db.get(
                'SELECT player_id FROM gacha_logs ORDER BY timestamp DESC LIMIT 1',
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
        return row ? row.player_id : null;
    } catch (err) {
        console.error('Error fetching last query UID:', err);
        return null;
    }
});

/**
 * 获取所有玩家 UID
 */
ipcMain.handle('get-player-uids', async () => {
    try {
        const rows = await new Promise((resolve, reject) => {
            db.all(
                'SELECT DISTINCT player_id FROM gacha_logs',
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
        return rows.map(row => row.player_id);
    } catch (err) {
        console.error('Error fetching player UIDs:', err);
        return [];
    }
});

/**
 * 获取所有祈愿记录
 */
ipcMain.handle('get-gacha-records', async () => {
    try {
        const rows = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM gacha_logs ORDER BY timestamp DESC',
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
        return rows;
    } catch (err) {
        console.error('Error fetching gacha records:', err);
        return [];
    }
});

/**
 * 刷新祈愿记录
 */
ipcMain.handle('refresh-gacha-records', async (event) => {
    try {
        event.sender.send('gacha-records-status', '正在获取抽卡记录...');

        // 获取游戏路径和祈愿链接
        const gamePath = await getGamePath();
        const gachaUrl = await extractGachaUrl(gamePath);

        if (!gachaUrl) {
            throw new Error('未找到祈愿链接');
        }

        console.log("抽卡链接为：", gachaUrl);

        // 解析链接，获取请求参数
        const params = parseGachaUrl(gachaUrl);
        console.log("解析后的参数：", params);

        // 获取所有祈愿记录
        const count = await fetchAllGachaLogs(params);

        event.sender.send('gacha-records-status', `成功获取 ${count} 条记录！`);
        return { success: true, count };
    } catch (err) {
        console.error("Failed to fetch gacha records:", err.message);
        event.sender.send('gacha-records-status', `获取记录失败: ${err.message}`);
        return { success: false, error: err.message };
    }
});
