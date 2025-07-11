const { db2 } = require('../../../app/database');
const { get } = require("axios");
const db = db2;
const { getStarRailLink } = require('./getStarRailUrl');
const {fetchGachaRecords} = require("./fetchGacha");

// 定义祈愿类型映射
const GACHA_TYPE_MAP = {
    '1': '常驻跃迁',
    '2': '新手跃迁',
    '11': '角色活动跃迁',
    '12': '光锥活动跃迁',
    '21': '角色联动跃迁',
    '22': '光锥联动跃迁'
};

async function insertGachaLogs(logs) {
    let insertedCount = 0;
    const insertPromises = logs.map(log => {
        return new Promise((resolve, reject) => {
            const { id, uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type } = log;
            db.run(`INSERT OR IGNORE INTO starRail_gacha (id, uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [id, uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type], function (err) {
                        if (err) {
                            reject(`插入失败: ${err.message}`);
                        } else {
                            if (this.changes > 0) {
                                insertedCount++;
                            }
                            resolve();
                        }
                    });
        });
    });
    // 等待所有插入操作完成
    await Promise.all(insertPromises);
    console.log(`成功插入 ${insertedCount} 条数据`);
    return insertedCount;
}


async function fetchStarRailGachaData(event) {
    // 获取抽卡记录链接
    const result = getStarRailLink();
    if (!result.success) {
        console.error(result.message);
        return {success: result.success, message:result.message};
    }

    const gachaUrl = result.message.split('\n')[1].trim();
    console.log(`获取的抽卡记录链接: ${gachaUrl}`);
    global.Notify(true, `已获取抽卡记录并复制到剪贴板\n${gachaUrl}`);
    // 获取祈愿日志数据
    try {
        const allRecords = { '1': [], '2': [], '11': [], '12': [], '21': [], '22': [] };
        let totalFetched = await fetchGachaRecords(allRecords,GACHA_TYPE_MAP,gachaUrl,event);
        // 插入查询到的所有数据
        const totalInserted = await insertGachaLogs(allRecords['1'].concat(allRecords['2'], allRecords['11'], allRecords['12'], allRecords['21'], allRecords['22']));
        event.sender.send('gacha-records-status', `查询到的抽卡记录: ${totalFetched} 条,成功插入: ${totalInserted} 条`);
        return { success: true, message: `查询到的抽卡记录: ${totalFetched} 条\n成功插入: ${totalInserted} 条`};
    } catch (error) {
        console.error('获取抽卡数据时出错:', error);
        event.sender.send('gacha-records-status', `获取抽卡数据时出错:${error}`);
        return { success: false, message: `获取抽卡数据时出错\n${error}`};
    }
}

module.exports = { fetchStarRailGachaData }
