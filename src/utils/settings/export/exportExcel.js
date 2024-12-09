const {db2} = require('../../../app/database');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { ipcMain, BrowserWindow } = require('electron');
const db = db2;

// 导入其他export和import功能
require('./exportUIGF');
require('./importUIGF')

async function exportGachaDataToExcel() {
    const exportFolder = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'export');

    // 确认文件是否存在，不存在则创建
    if (!fs.existsSync(exportFolder)) {
        fs.mkdirSync(exportFolder);
    }

    const filePaths = {
        zh: path.join(exportFolder, 'gacha_logs_zh.xlsx'),
        en: path.join(exportFolder, 'gacha_logs_en.xlsx')
    };

    const headers = {
        zh: [
            { header: 'id', key: 'id', width: 10 },
            { header: 'UID', key: 'player_id', width: 15 },
            { header: '卡池类型', key: 'card_pool_type', width: 20 },
            { header: '物品ID', key: 'resource_id', width: 15 },
            { header: '品质', key: 'quality_level', width: 10 },
            { header: '类型', key: 'resource_type', width: 15 },
            { header: '名称', key: 'name', width: 30 },
            { header: '数量', key: 'count', width: 10 },
            { header: '时间戳', key: 'timestamp', width: 20 }
        ],
        en: [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'player_id', key: 'player_id', width: 15 },
            { header: 'card_pool_type', key: 'card_pool_type', width: 20 },
            { header: 'resource_id', key: 'resource_id', width: 15 },
            { header: 'quality_level', key: 'quality_level', width: 10 },
            { header: 'resource_type', key: 'resource_type', width: 15 },
            { header: 'name', key: 'name', width: 30 },
            { header: 'count', key: 'count', width: 10 },
            { header: 'time', key: 'timestamp', width: 20 }
        ]
    };

    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM gacha_logs', async (err, rows) => {
            if (err) {
                return reject({ success: false, message: '数据查询失败,请确认数据是否存在' });
            }

            try {
                for (const [lang, filePath] of Object.entries(filePaths)) {
                    const workbook = new ExcelJS.Workbook();

                    const totalSheet = workbook.addWorksheet(
                        lang === 'zh' ? '总数据' : 'Total Data'
                    );
                    totalSheet.columns = headers[lang];
                    totalSheet.addRows(rows);

                    const groupedData = rows.reduce((acc, row) => {
                        const key = `${row.player_id}_${row.card_pool_type}`;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(row);
                        return acc;
                    }, {});

                    for (const [key, data] of Object.entries(groupedData)) {
                        const [uid, cardPool] = key.split('_');
                        const sheetName =
                            lang === 'zh'
                                ? `UID-${uid}-${cardPool}`
                                : `UID-${uid}-${cardPool}`;
                        const sheet = workbook.addWorksheet(sheetName.substring(0, 31));
                        sheet.columns = headers[lang];
                        sheet.addRows(data);
                    }
                    await workbook.xlsx.writeFile(filePath);
                }

                resolve({
                    success: true,
                    message: `数据成功导出到\nexport目录`,
                    paths: filePaths
                });
            } catch (error) {
                reject({ success: false, message: 'Excel 文件保存失败' });
            }
        });
    });
}

ipcMain.handle('exportGachaData', async () => {
    try {
        return await exportGachaDataToExcel();
    } catch (error) {
        return { success: false, message: error.message };
    }
});

