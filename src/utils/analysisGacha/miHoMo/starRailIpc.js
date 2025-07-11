const { ipcMain, clipboard } = require('electron');
const {fetchStarRailGachaData} = require("./gachaAnalysisStarRail");
require("./getStarRailUrl");
const {db2} = require("../../../app/database");
const db = db2;


ipcMain.handle('fetchStarRailGachaData', async (event) => {
    event.sender.send('gacha-records-status', '正在获取抽卡记录...');
    return await fetchStarRailGachaData(event);
});

ipcMain.handle('get-last-starRail-uid', async () => {
    try {
        const row = await new Promise((resolve, reject) => {
            db.get(
                'SELECT uid FROM starRail_gacha ORDER BY id DESC LIMIT 1',
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
        return row ? row.uid : null;
    } catch (err) {
        console.error('数据库中无崩铁抽卡记录:', err);
        return null;
    }
});


ipcMain.handle('get-starRail-player-uids', async () => {
    try {
        const rows = await new Promise((resolve, reject) => {
            db.all(
                'SELECT DISTINCT uid FROM starRail_gacha',
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
        return rows.map(row => row.uid);
    } catch (err) {
        console.error('未能从数据库获取用户UID:', err);
        return [];
    }
});


ipcMain.handle('get-starRail-gacha-records', async () => {
    try {
        const rows = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM starRail_gacha ORDER BY id DESC', // 按插入顺序倒序获取
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
        // 定义gacha_type对应的中文映射
        const gachaTypeMap = {
            '1': '常驻跃迁',
            '2': '新手跃迁',
            '11': '角色活动跃迁',
            '12': '光锥活动跃迁',
            '21': '角色联动跃迁',
            '22': '光锥联动跃迁'
        };
        // 替换字段
        return rows.map(record => ({
            id: record.id,
            uid: record.uid,
            gacha_id: record.gacha_id,
            card_pool_type: gachaTypeMap[record.gacha_type] || record.gacha_type,  // 替换gacha_type为card_pool_type
            item_id: record.item_id,
            count: record.count,
            timestamp: record.time,  // 替换time为timestamp
            name: record.name,
            lang: record.lang,
            item_type: record.item_type,
            quality_level: record.rank_type,  // 替换rank_type为quality_level
        }));
    } catch (err) {
        console.error('从数据库获取崩铁抽卡记录失败:', err);
        return [];
    }
});
