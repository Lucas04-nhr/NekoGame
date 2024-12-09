const fs = require('fs');
const path = require('path');
const { db2 } = require('../../../app/database');
const { ipcMain} = require('electron');
const {post} = require("axios");
const {fetchItemId, itemCache} = require("./UIGFapi");

// 生成UIGF-4.0
async function exportHKrpgUIGFData(tableName) {
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
            hkrpg: []
        };

        // 按 UID 分组
        const groupedByUID = {};
        for (const record of records) {
            if (!groupedByUID[record.uid]) {
                groupedByUID[record.uid] = {
                    uid: record.uid,
                    timezone: 8, // 默认 UTC+8
                    lang: record.lang || "zh-cn", // 语言代码
                    list: []
                };
            }
            groupedByUID[record.uid].list.push({
                gacha_id: record.gacha_id,
                gacha_type: record.gacha_type,
                item_id: record.item_id,
                count: record.count.toString(),
                time: record.time,
                name: record.name,
                item_type: record.item_type,
                rank_type: record.rank_type.toString(),
                id: record.id.toString()
            });
        }

        // 将分组数据填入 hkrpg
        formattedData.hkrpg = Object.values(groupedByUID);

        // 写入 JSON 文件
        const outputFile = path.resolve(outputPath, `UIGF4_${tableName}_NekoGame_hkrpg.json`);
        fs.writeFileSync(outputFile, JSON.stringify(formattedData, null, 4), 'utf-8');
        console.log(`抽卡数据已成功导出: ${outputFile}`);
        global.Notify(true, `已成功导出\n${outputFile}\nUIGF V4.0`);
    } catch (error) {
        console.error("导出 UIGF 数据时发生错误:", error.message);
        global.Notify(false, `导出 UIGF 数据时发生错误:${error.message}`);
    }
}


async function exportHK4eUIGFData(tableName) {
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
                export_timestamp: Math.floor(Date.now() / 1000),
                export_app: "NekoGame",
                export_app_version: "2.3.0",
                version: "v4.0"
            },
            hk4e: []
        };

        const groupedByUID = {};
        for (const record of records) {
            if (!groupedByUID[record.uid]) {
                groupedByUID[record.uid] = {
                    uid: record.uid,
                    timezone: 8,
                    lang: record.lang || "zh-cn",
                    list: []
                };
            }

            const name = record.name;
            let itemId = record.item_id;

            if (!itemId) {
                if (itemCache[name]) {
                    itemId = itemCache[name];
                } else {
                    try {
                        itemId = await fetchItemId(name);
                    } catch (error) {
                        console.error(`因网络问题终止导出流程: ${error.message}`);
                        global.Notify(false, `终止导出流程: ${error.message}`);
                        return { success: false, message: `终止导出流程: ${error.message}` };
                    }
                }
            }

            const filteredRecord = {};
            if (record.gacha_type) {
                filteredRecord.gacha_type = record.gacha_type === "400" ? "301" : record.gacha_type.toString();
            }
            if (itemId) filteredRecord.item_id = itemId.toString();
            if (record.count) filteredRecord.count = record.count.toString();
            if (record.time) filteredRecord.time = record.time.toString();
            if (record.name) filteredRecord.name = record.name.toString();
            if (record.item_type) filteredRecord.item_type = record.item_type.toString();
            if (record.rank_type) filteredRecord.rank_type = record.rank_type.toString();
            if (record.id) filteredRecord.id = record.id.toString();
            filteredRecord.uigf_gacha_type = filteredRecord.gacha_type;

            groupedByUID[record.uid].list.push(filteredRecord);
        }

        formattedData.hk4e = Object.values(groupedByUID);

        const outputFile = path.resolve(outputPath, `UIGF4_${tableName}_NekoGame_hk4e.json`);
        fs.writeFileSync(outputFile, JSON.stringify(formattedData, null, 4), 'utf-8');
        console.log(`抽卡数据已成功导出: ${outputFile}`);
        global.Notify(true, `已成功导出\n${outputFile}\nUIGF V4.0`);
    } catch (error) {
        console.error("导出 UIGF 数据时发生错误:", error.message);
        global.Notify(false, `导出 UIGF 数据时发生错误: ${error.message}`);
    }
}

async function exportNapUIGFData(tableName) {
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
            nap: []
        };

        // 按 UID 分组
        const groupedByUID = {};
        for (const record of records) {
            if (!groupedByUID[record.uid]) {
                groupedByUID[record.uid] = {
                    uid: record.uid,
                    timezone: 8, // 默认 UTC+8
                    lang: record.lang || "zh-cn", // 语言代码
                    list: []
                };
            }
            groupedByUID[record.uid].list.push({
                gacha_id: record.gacha_id,
                gacha_type: record.gacha_type,
                item_id: record.item_id,
                count: record.count.toString(),
                time: record.time,
                name: record.name,
                item_type: record.item_type,
                rank_type: record.rank_type.toString(),
                id: record.id.toString()
            });
        }

        // 将分组数据填入 nap
        formattedData.nap = Object.values(groupedByUID);

        // 写入 JSON 文件
        const outputFile = path.resolve(outputPath, `UIGF4_${tableName}_NekoGame_nap.json`);
        fs.writeFileSync(outputFile, JSON.stringify(formattedData, null, 4), 'utf-8');
        console.log(`抽卡数据已成功导出: ${outputFile}`);
        global.Notify(true, `已成功导出\n${outputFile}\nUIGF V4.0`);
    } catch (error) {
        console.error("导出 UIGF 数据时发生错误:", error.message);
        global.Notify(false, `导出 UIGF 数据时发生错误:${error.message}`);
    }
}

ipcMain.handle('export-genshin-data', async () => {
    await exportHK4eUIGFData('genshin_gacha');
});

ipcMain.handle('export-starRail-data', async () => {
    await exportHKrpgUIGFData('starRail_gacha');
});

ipcMain.handle('export-zzz-data', async () => {
    await exportNapUIGFData('zzz_gacha');
});
