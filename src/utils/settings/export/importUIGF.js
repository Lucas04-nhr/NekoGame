const fs = require('fs');
const { db2 } = require('../../../app/database');
const { ipcMain, dialog } = require("electron");
const {fetchItemId, itemCache, fetchItemName} = require("./UIGFapi");
const {checkUIGF} = require("./checkUIGF");

const UIGF_FIELDS = [
    "id", "uid", "gacha_id", "gacha_type", "item_id", "count",
    "time", "name", "lang", "item_type", "rank_type"
];


async function importUIGFData(filePath, tableName, dataKey, fetchItemIdFn, gameType=null) {
    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const parsedData = JSON.parse(rawData);

        // 检测数据格式标准
        const isUIGF3 = parsedData.info && parsedData.list;
        const isUIGF4 = parsedData[dataKey] && Array.isArray(parsedData[dataKey]);

        if (!isUIGF3 && !isUIGF4) {
            throw new Error(`无效的 UIGF 格式: 缺少 '${dataKey}' 或 'list' 数据`);
        }

        if (isUIGF3 && gameType !== "genshin") {
            throw new Error(`UIGF 3.0 数据仅支持导入到原神`);
        }

        const query = `INSERT OR IGNORE INTO ${tableName} (${UIGF_FIELDS.join(', ')}) VALUES (${UIGF_FIELDS.map(() => '?').join(', ')})`;

        let insertedCount = 0;

        if (isUIGF4) {
            // UIGF 4.0
            for (const playerData of parsedData[dataKey]) {
                const { uid, list, lang = "zh-cn" } = playerData;
                if (!list || !Array.isArray(list)) continue;

                for (const record of list) {
                    const recordData = { ...record, uid, lang };

                    // 检查字段完整性
                    checkUIGF(recordData.id, recordData.uid, recordData.gacha_type, recordData.time, recordData.rank_type, recordData);
                    // 补充 item_id 如果缺失
                    if (!recordData.item_id && recordData.name && fetchItemIdFn) {
                        try {
                            recordData.item_id = await fetchItemIdFn(recordData.name);
                        } catch (err) {
                            global.Notify(false, `获取 item_id 失败: ${recordData.name}\n已跳过此记录\n 错误: ${err.message}`)
                            console.warn(`获取 item_id 失败: ${recordData.name}, 错误: ${err.message}`);
                            continue;
                        }
                    }

                    // 插入数据
                    const values = UIGF_FIELDS.map(field => recordData[field] || "");
                    await new Promise((resolve, reject) => {
                        db2.run(query, values, function (err) {
                            if (err) {
                                reject(`插入失败: ${err.message}`);
                            } else {
                                if (this.changes > 0) insertedCount++;
                                resolve();
                            }
                        });
                    });
                }
            }
        } else if (isUIGF3) {
            // UIGF 3.0 格式处理
            const { uid, lang = "zh-cn" } = parsedData.info;

            for (const record of parsedData.list) {
                const recordData = { ...record, uid, lang };

                checkUIGF(recordData.id, recordData.uid, recordData.gacha_type, recordData.time, recordData.rank_type, recordData);

                // 补充 item_id 如果缺失
                if (!recordData.item_id && recordData.name && fetchItemIdFn) {
                    try {
                        recordData.item_id = await fetchItemIdFn(recordData.name);
                    } catch (err) {
                        global.Notify(false, `获取 item_id 失败: ${recordData.name}\n已跳过此记录\n 错误: ${err.message}`)
                        console.warn(`获取 item_id 失败: ${recordData.name}, 错误: ${err.message}`);
                        continue; // 跳过该记录
                    }
                }
                const values = UIGF_FIELDS.map(field => recordData[field] || "");
                await new Promise((resolve, reject) => {
                    db2.run(query, values, function (err) {
                        if (err) {
                            reject(`插入失败: ${err.message}`);
                        } else {
                            if (this.changes > 0) insertedCount++;
                            resolve();
                        }
                    });
                });
            }
        }
        console.log(`成功导入 ${insertedCount} 条 UIGF 记录`);
        return { success: true, message: `成功导入 ${insertedCount} 条 UIGF 记录` };
    } catch (error) {
        console.error("导入 UIGF 数据失败:", error.message);
        return { success: false, message: `导入 UIGF 数据失败: ${error.message}` };
    }
}

ipcMain.handle('import-genshin-data', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: '选择 UIGF 数据文件',
        filters: [{ name: 'JSON 文件', extensions: ['json'] }],
        properties: ['openFile']
    });
    if (canceled || filePaths.length === 0) {
        return { success: false, message: '未选择文件' };
    }

    const filePath = filePaths[0];
    return await importUIGFData(filePath, 'genshin_gacha', 'hk4e', fetchItemId, "genshin");
});

ipcMain.handle('import-starRail-data', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: '选择 StarRail_UIGF 数据文件',
        filters: [{ name: 'JSON 文件', extensions: ['json'] }],
        properties: ['openFile']
    });
    if (canceled || filePaths.length === 0) {
        return { success: false, message: '未选择文件' };
    }

    const filePath = filePaths[0];
    return await importUIGFData(filePath, 'starRail_gacha', 'hkrpg', fetchItemId);
});

ipcMain.handle('import-zzz-data', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: '选择 ZZZ_UIGF 数据文件',
        filters: [{ name: 'JSON 文件', extensions: ['json'] }],
        properties: ['openFile']
    });
    if (canceled || filePaths.length === 0) {
        return { success: false, message: '未选择文件' };
    }

    const filePath = filePaths[0];
    return await importUIGFData(filePath, 'zzz_gacha', 'nap', fetchItemId);
});
