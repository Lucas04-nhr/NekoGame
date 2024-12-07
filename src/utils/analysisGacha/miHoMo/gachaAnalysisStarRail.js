const { db2 } = require('../../../app/database');
const { get } = require("axios");
const db = db2;
const { getStarRailLink } = require('./getStarRailUrl');
const { URL, URLSearchParams } = require('url');

// 定义祈愿类型映射
const GACHA_TYPE_MAP = {
    '1': '常驻跃迁',
    '2': '新手跃迁',
    '11': '角色活动跃迁',
    '12': '光锥活动跃迁'
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


async function fetchGachaData(event) {
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
        const allRecords = { '1': [], '2': [], '11': [], '12': [] };
        const size = 20; // 每页20条记录
        let totalFetched = 0; // 本次查询到的总数据量
        const parsedUrl = new URL(gachaUrl);

        // 遍历不同的祈愿类型
        for (const [gachaType, gachaName] of Object.entries(GACHA_TYPE_MAP)) {
            console.log(`正在获取 ${gachaName} 的祈愿记录...`);
            let hasMoreData = true;
            let page = 1;
            let endId = '0';
            let retries = 0;

            while (hasMoreData && retries < 3) {
                try {
                    const queryParams = new URLSearchParams(parsedUrl.search);
                    queryParams.set("gacha_type", gachaType);
                    queryParams.set("page", page.toString());
                    queryParams.set("size", size.toString());
                    queryParams.set("end_id", endId);
                    // 构造完整的请求 URL
                    const urlWithParams = `${parsedUrl.origin}${parsedUrl.pathname}?${queryParams.toString()}`;
                    // 发送请求
                    const response = await get(urlWithParams);
                    const data = response.data;

                    console.log(`获取 ${gachaName} 第 ${page} 页数据...`);
                    event.sender.send('gacha-records-status', `获取 ${gachaName} 第 ${page} 页数据...`);
                    console.log('回应数据', JSON.stringify(data));

                    if (data.retcode !== 0 || !data.data.list || data.data.list.length === 0) {
                        console.error(`获取 ${gachaName} 第 ${page} 页数据失败，跳过该页`);
                        event.sender.send('gacha-records-status', `获取 ${gachaName} 第 ${page} 页数据失败，跳过该页`);
                        retries++;
                        if (retries >= 3) {
                            console.error(`重试超过次数，停止获取 ${gachaName}`);
                            break;
                        }
                        await new Promise(resolve => setTimeout(resolve, 300)); // 等待 0.3s 再重试
                        continue;
                    }
                    // 更新查询的 ID 以进行分页
                    const fetchedRecords = data.data.list;
                    allRecords[gachaType] = allRecords[gachaType].concat(fetchedRecords);
                    totalFetched += fetchedRecords.length;

                    endId = fetchedRecords[fetchedRecords.length - 1].id;
                    hasMoreData = fetchedRecords.length === size;

                    // 每页请求间隔 0.3s
                    await new Promise(resolve => setTimeout(resolve, 300));
                    page++;
                } catch (err) {
                    console.error(`请求 ${gachaName} 第 ${page} 页失败:`, err);
                    retries++;
                    if (retries >= 3) {
                        console.error(`重试超过次数，停止获取 ${gachaName}`);
                        global.Notify(false, `重试超过3次，停止获取 ${gachaName}`)
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
        }
        // 插入查询到的所有数据
        const totalInserted = await insertGachaLogs(allRecords['1'].concat(allRecords['2'], allRecords['11'], allRecords['12']));
        event.sender.send('gacha-records-status', `查询到的抽卡记录: ${totalFetched} 条,成功插入: ${totalInserted} 条`);
        return { success: true, message: `查询到的抽卡记录: ${totalFetched} 条\n成功插入: ${totalInserted} 条`};
    } catch (error) {
        console.error('获取抽卡数据时出错:', error);
        event.sender.send('gacha-records-status', `获取抽卡数据时出错:${error}`);
        return { success: false, message: `获取抽卡数据时出错\n${error}`};
    }
}

module.exports = { fetchGachaData }
