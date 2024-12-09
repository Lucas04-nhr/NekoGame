const fs = require('fs');
const path = require('path');
const { db2 } = require('../../../app/database');
const { ipcMain } = require('electron');
const { fetchItemId, itemCache } = require("./UIGFapi");

// 通用导出方法
async function exportUIGFData({ tableName, type, outputFileName, formatRecord }) {
    const query = `SELECT * FROM ${tableName} ORDER BY id ASC`;
    const outputPath = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'export');
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath);
    }

    try {
        const records = await new Promise((resolve, reject) => {
            db2.all(query, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const formattedData = {
            info: {
                export_timestamp: Math.floor(Date.now() / 1000), // 当前时间戳（秒）
                export_app: "NekoGame",
                export_app_version: "2.3.0",
                version: "v4.0"
            },
            [type]: []
        };

        const groupedByUID = {};
        for (const record of records) {
            if (!groupedByUID[record.uid]) {
                groupedByUID[record.uid] = {
                    uid: record.uid,
                    timezone: 8, // 默认 UTC+8
                    lang: record.lang || "zh-cn",
                    list: []
                };
            }
            const formattedRecord = formatRecord ? formatRecord(record) : record;
            groupedByUID[record.uid].list.push(formattedRecord);
        }

        formattedData[type] = Object.values(groupedByUID);

        const outputFile = path.resolve(outputPath, outputFileName);
        fs.writeFileSync(outputFile, JSON.stringify(formattedData, null, 4), 'utf-8');
        console.log(`抽卡数据已成功导出: ${outputFile}`);
        global.Notify(true, `已成功导出\n${outputFile}\nUIGF V4.0`);
    } catch (error) {
        console.error("导出 UIGF 数据时发生错误:", error.message);
        global.Notify(false, `导出 UIGF 数据时发生错误: ${error.message}`);
    }
}

// 格式化方法（可选）
function formatHK4eRecord(record) {
    let itemId = record.item_id;
    if (!itemId) {
        if (itemCache[record.name]) {
            itemId = itemCache[record.name];
        } else {
            itemId = await fetchItemId(record.name);
        }
    }
    return {
        gacha_id: record.gacha_id,
        gacha_type: record.gacha_type === "400" ? "301" : record.gacha_type.toString(),
        item_id: itemId ? itemId.toString() : null,
        count: record.count.toString(),
        time: record.time.toString(),
        name: record.name.toString(),
        item_type: record.item_type.toString(),
        rank_type: record.rank_type.toString(),
        id: record.id.toString(),
        uigf_gacha_type: record.gacha_type === "400" ? "301" : record.gacha_type.toString()
    };
}

// IPC 处理
ipcMain.handle('export-genshin-data', async () => {
    await exportUIGFData({
        tableName: 'genshin_gacha',
        type: 'hk4e',
        outputFileName: 'UIGF4_genshin_gacha_NekoGame.json',
        formatRecord: formatHK4eRecord
    });
});

ipcMain.handle('export-starRail-data', async () => {
    await exportUIGFData({
        tableName: 'starRail_gacha',
        type: 'hkrpg',
        outputFileName: 'UIGF4_starRail_gacha_NekoGame.json',
        formatRecord: null // 使用默认格式
    });
});

ipcMain.handle('export-zzz-data', async () => {
    await exportUIGFData({
        tableName: 'zzz_gacha',
        type: 'nap',
        outputFileName: 'UIGF4_zzz_gacha_NekoGame.json',
        formatRecord: null // 使用默认格式
    });
});
