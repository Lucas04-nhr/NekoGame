const fs = require('fs');
const { db2 } = require('../../../app/database');
const { ipcMain, dialog } = require("electron");
const {fetchItemId, itemCache, fetchItemName} = require("./UIGFapi");
const {checkUIGF} = require("./checkUIGF");

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

                checkUIGF(id, uid, gacha_type, time, rank_type, record);
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

async function importUIGFGenshinData(filePath, tableName) {
    try {
        // 读取文件内容
        const rawData = fs.readFileSync(filePath, 'utf-8');
        let parsedData;

        try {
            // 尝试解析为 UK4e 数据
            parsedData = JSON.parse(rawData);
            if (!parsedData.hk4e || !Array.isArray(parsedData.hk4e)) {
                throw new Error("不是有效的 UK4e 格式，缺少 'hk4e' 数据");
            }
            console.log("成功解析为 UK4e 格式");
        } catch (uk4eError) {
            console.warn("解析 UK4e 数据失败，尝试解析为 UIGF 3.0 格式:", uk4eError.message);

            try {
                // 尝试解析为 UIGF 3.0 数据
                parsedData = JSON.parse(rawData);
                if (!parsedData.list || !Array.isArray(parsedData.list) || !parsedData.info) {
                    throw new Error("不是有效的 UIGF 3.0 格式，缺少 'list' 或 'info' 数据");
                }
                console.log("成功解析为 UIGF 3.0 格式");
            } catch (uigfError) {
                throw new Error(`UIGF 数据解析失败: ${uigfError.message}`);
            }
        }

        // 开始插入记录
        let insertedCount = 0;
        const query = `INSERT OR IGNORE INTO ${tableName} (
            id, uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        // 判断格式类型并插入数据
        if (parsedData.hk4e) {
            // UK4e 数据处理
            for (const playerData of parsedData.hk4e) {
                const { uid, list } = playerData;
                if (!list || !Array.isArray(list)) continue;

                for (const record of list) {
                    const {
                        id,
                        gacha_id,
                        gacha_type,
                        item_id = "",
                        count,
                        time,
                        name,
                        item_type,
                        rank_type
                    } = record;

                    checkUIGF(id, uid, gacha_type, time, rank_type, record);
                    // 插入数据
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
                            playerData.lang || "zh-cn",
                            item_type,
                            rank_type
                        ], function (err) {
                            if (err) reject(`插入失败: ${err.message}`);
                            else {
                                if (this.changes > 0) insertedCount++;
                                resolve();
                            }
                        });
                    });
                }
            }
        } else if (parsedData.list) {
            // UIGF 3.0 数据处理
            const { uid, lang } = parsedData.info;

            for (const record of parsedData.list) {
                const {
                    id,
                    gacha_id,
                    gacha_type,
                    item_id = '',
                    count = "1",
                    time,
                    name,
                    item_type,
                    rank_type,
                    uigf_gacha_type = gacha_type
                } = record;

                // 检查必要字段
                checkUIGF(id, uid, gacha_type, time, rank_type, record);

                // 插入数据
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
                        lang || "zh-cn",
                        item_type,
                        rank_type
                    ], function (err) {
                        if (err) reject(`插入失败: ${err.message}`);
                        else {
                            if (this.changes > 0) insertedCount++;
                            resolve();
                        }
                    });
                });
            }
        }

        console.log(`成功导入 ${insertedCount} 条记录`);
        return { success: true, message: `成功导入 ${insertedCount} 条记录` };
    } catch (error) {
        console.error("导入数据失败:", error.message);
        return { success: false, message: `导入数据失败: ${error.message}` };
    }
}
async function importNapUIGFData(filePath, tableName) {
    try {
        // 读取并解析 UIGF 数据
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const uigfData = JSON.parse(rawData);
        const query = `INSERT OR IGNORE INTO ${tableName} (
            id, uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        if (!uigfData.nap || !Array.isArray(uigfData.nap)) {
            global.Notify(false, "无效的 UIGF 格式\n缺少 'nap' 数据");
            throw new Error("无效的 UIGF 格式: 缺少 'nap' 数据");
        }

        let insertedCount = 0; // 统计插入记录数

        // 遍历 nap 数据
        for (const playerData of uigfData.nap) {
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

                checkUIGF(id, uid, gacha_type, time, rank_type, record);
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
    return await importUIGFData(filePath, 'starRail_gacha');
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
    return await importNapUIGFData(filePath, 'zzz_gacha');
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
    return await importUIGFGenshinData(filePath, 'genshin_gacha');
});
