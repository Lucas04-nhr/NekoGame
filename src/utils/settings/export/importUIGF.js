const fs = require('fs');
const { db2 } = require('../../../app/database');
const { ipcMain, dialog } = require("electron");
const {fetchItemId, itemCache, fetchItemName} = require("./UIGFapi");
const {checkUIGF} = require("./checkUIGF"); // 数据库连接

async function importUIGFData(filePath, tableName) {
    try {
        // 读取并解析 UIGF 数据
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const uigfData = JSON.parse(rawData);
        const query = `INSERT OR IGNORE INTO ${tableName} (
            id, uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        if (!uigfData.hkrpg || !Array.isArray(uigfData.hkrpg)) {
            global.Notify(false, "无效的 UIGF 格式\n缺少 'hkrpg' 数据");
            throw new Error("无效的 UIGF 格式: 缺少 'hkrpg' 数据");
        }

        let insertedCount = 0; // 统计插入记录数

        // 遍历 hkrpg 数据
        for (const playerData of uigfData.hkrpg) {
            const { uid, list } = playerData;
            if (!list || !Array.isArray(list)) continue;

            for (const record of list) {
                const {
                    id,
                    gacha_id,
                    gacha_type,
                    item_id,
                    count,
                    time,
                    name,
                    item_type,
                    rank_type
                } = record;

                checkUIGF(id, uid, gacha_id, gacha_type, time, rank_type, record);

                await new Promise((resolve, reject) => {
                    db2.run(query, [
                        id,
                        uid,
                        gacha_id,
                        gacha_type,
                        item_id,
                        count,
                        time,
                        name,
                        playerData.lang || "zh-cn", // 默认语言
                        item_type,
                        rank_type
                    ], function (err) {
                        if (err) {
                            reject(`插入失败: ${err.message}`);
                        } else {
                            if (this.changes > 0) insertedCount++; // 判断是否有更改
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
        return { success: false, message: `UIGF 数据导入失败\n${error.message}` };
    }
}

async function importUK4eData(filePath, tableName) {
    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const uk4eData = JSON.parse(rawData);
        const query = `INSERT OR IGNORE INTO ${tableName} (
            id, uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        // 检查数据结构完整性
        if (!uk4eData.hk4e || !Array.isArray(uk4eData.hk4e)) {
            global.Notify(false, "无效的 UK4e 格式\n缺少 'hk4e' 数据");
            throw new Error("无效的 UK4e 格式: 缺少 'hk4e' 数据");
        }

        let insertedCount = 0; // 统计插入记录数

        for (const playerData of uk4eData.hk4e) {
            const { uid, list } = playerData;

            if (!list || !Array.isArray(list)) {
                global.Notify(false, "无效的 UK4e 格式\n记录列表为空");
                throw new Error("无效的 UK4e 格式: 记录列表为空");
            }

            for (const record of list) {
                let {
                    id,
                    gacha_id,
                    gacha_type,
                    item_id,
                    count,
                    time,
                    name,
                    item_type,
                    rank_type
                } = record;

                // 检查是否缺少必要字段
                checkUIGF(id, uid, gacha_id, gacha_type, time, rank_type, record);

                let resolvedItemId = item_id;
                let resolvedName = name;

                // 如果 item_id 缺失但有 name，尝试通过缓存或 API 获取
                if (!item_id && name) {
                    if (itemCache[name]) {
                        resolvedItemId = itemCache[name];
                    } else {
                        try {
                            resolvedItemId = await fetchItemId(name);
                        } catch (error) {
                            global.Notify(false, `无法获取 item_id: ${name}`);
                            throw new Error(`无法获取 item_id for name: ${name}`);
                        }
                    }
                }

                // 如果 name 缺失但有 item_id，通过缓存或 API 获取 name
                if (!name && item_id) {
                    try {
                        name = await fetchItemName(item_id);
                    } catch (error) {
                        global.Notify(false, `无法获取 name for item_id: ${item_id}`);
                        throw new Error(`无法获取 name for item_id: ${item_id}`);
                    }
                }

                // 如果依然缺失 item_id 或 name，抛出错误终止流程
                if (!resolvedItemId || !resolvedName) {
                    global.Notify(false, "缺失 item_id 或 name，终止导入流程");
                    throw new Error(`缺失 item_id 或 name，记录: ${JSON.stringify(record)}`);
                }

                await new Promise((resolve, reject) => {
                    db2.run(query, [
                        id,
                        uid,
                        gacha_id,
                        gacha_type,
                        resolvedItemId,
                        count,
                        time,
                        resolvedName,
                        playerData.lang || "zh-cn", // 默认语言
                        item_type,
                        rank_type
                    ], function (err) {
                        if (err) {
                            reject(`插入失败: ${err.message}`);
                        } else {
                            if (this.changes > 0) insertedCount++; // 判断是否有更改
                            resolve();
                        }
                    });
                });
            }
        }
        console.log(`成功导入 ${insertedCount} 条 UK4e 记录`);
        return { success: true, message: `成功导入 ${insertedCount} 条 UK4e 记录` };
    } catch (error) {
        console.error("导入 UK4e 数据失败:", error.message);
        return { success: false, message: `UK4e 数据导入失败\n${error.message}` };
    }
}


ipcMain.handle('import-starRail-data', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: '选择 UIGF 数据文件',
        filters: [{ name: 'JSON 文件', extensions: ['json'] }],
        properties: ['openFile']
    });
    if (canceled || filePaths.length === 0) {
        return { success: false, message: '未选择文件' };
    }

    const filePath = filePaths[0];
    return await importUIGFData(filePath, 'starRail_gacha');
});


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
    return await importUK4eData(filePath, 'genshin_gacha');
});
