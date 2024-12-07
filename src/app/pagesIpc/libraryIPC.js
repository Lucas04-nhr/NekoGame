const { ipcMain, BrowserWindow, shell,app, dialog} = require('electron');
const {getGameTrendData, getGameDetails, getGameDailyTimeData} = require("../database");


// 获取游戏详细信息
ipcMain.handle('get-game-details', async (event, gameId) => {
    return new Promise((resolve, reject) => {
        getGameDetails(gameId, (err, row) => {
            if (err) {
                console.error("从数据库中获取游戏详情失败:", err);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
});


// 获取游戏时长趋势数据
ipcMain.handle("get-game-trend-data", async (event, gameId) => {
    return new Promise((resolve, reject) => {
        getGameTrendData(gameId, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});


//从数据库获取游戏的每日时长数据生成方块
ipcMain.handle("get-game-daily-time-data", (event, gameId) => {
    return new Promise((resolve, reject) => {
        getGameDailyTimeData(gameId, (err, rows) => {
            if (err) {
                reject(err.message);
            } else {
                resolve(rows);
            }
        });
    });
});


ipcMain.handle("select-image", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "Images", extensions: ["jpg", "png", "gif", "webp"] }]
    });
    return canceled ? null : filePaths[0];
});

ipcMain.handle("open-file", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "Executables", extensions: ["exe", "app"] }]
    });
    return canceled ? null : filePaths[0];
});



// 选择图像文件
ipcMain.handle('select-image-file', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    return result.filePaths[0];
});
