const { app, BrowserWindow, Tray, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { initializeDatabase, getGameDetails, getGameTimeData, getGameTrendData, addGame, deleteGame, updateGame, getSetting, setSetting } = require('./database'); // 确保导入 getGameTimeData
const { initializeTrackedGames, startGameTracking } = require('./gameTracker'); 
const { getAnalysisData, refreshAnalysisData, generateAnalysisData } = require('./js/analysis');
const db = new sqlite3.Database('neko_game.db');
const gotTheLock = app.requestSingleInstanceLock();
let tray = null;
let mainWindow;
let isWindowVisible = true;
let minimizeToTraySetting = false;


function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'icon.png'); // 使用绝对路径
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
        { label: '退出应用', click: () => {
            tray.destroy();  // 销毁托盘图标
            app.exit();      // 强制退出应用
        }}
    ]);
    tray.setToolTip('Neko Game');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (!mainWindow) {
            createWindow();  // 如果主窗口未创建，则创建窗口
        } else {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                // 每次窗口显示时发送刷新事件
                mainWindow.webContents.send('refresh-content');
                mainWindow.focus();
            }
        }
    });
}



function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1000,
        minHeight: 600,
        backgroundColor: '#1e1e1e', // 设置为应用的暗色主题颜色
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // 指定 preload 脚本
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false
        },
        frame: false
    });

    //mainWindow.webContents.openDevTools();
    mainWindow.loadFile('index.html');
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('set-app-path', app.getAppPath());
    });
    mainWindow.on('minimize', () => {
        isWindowVisible = false;
    });

    mainWindow.on('restore', () => {
        isWindowVisible = true;
    });
    mainWindow.on('close', (event) => {
        if (minimizeToTraySetting) {
            event.preventDefault();
            mainWindow.hide();
            isWindowVisible = false;
        } else {
            mainWindow = null;  // 清除引用，确保可以正常退出
            app.quit();
        }
    });
    
}


// 选择路径对话框
ipcMain.handle("dialog:openDirectory", async () => {
    return dialog.showOpenDialog({ properties: ["openDirectory"] });
});

// 选择图片文件对话框
ipcMain.handle("dialog:selectImageFile", async () => {
    const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
            { name: 'Images', extensions: ['jpg', 'png', 'gif'] }
        ]
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    return result.filePaths[0];
});

// 文件选择对话框，允许选择 .exe 文件
ipcMain.handle("dialog:openFile", async () => {
    return dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
            { name: 'Executable Files', extensions: ['exe'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
});


ipcMain.handle("load-games", async () => {
    return new Promise((resolve, reject) => {
        getGameTimeData((err, games) => {
            if (err) reject(err);
            else resolve(games);
        });
    });
});

ipcMain.handle("add-game", async (event, gameData) => {
    return new Promise((resolve, reject) => {
        addGame(gameData, (err, gameId) => {
            if (err) reject(err);
            else {
                resolve(gameId);
                initializeTrackedGames(); // 在添加新游戏后重新初始化游戏追踪
            }
        });
    });
});

ipcMain.handle("load-settings", async () => {
    const settings = {};
    const keys = ["minimizeToTray", "silentMode", "autoLaunch"];
    
    for (const key of keys) {
        settings[key] = await new Promise((resolve) => {
            getSetting(key, (err, value) => {
                if (err) {
                    console.error(`Error loading setting ${key}:`, err);
                    resolve("false"); // 默认值
                } else {
                    resolve(value || "false"); // 默认为 "false"
                }
            });
        });
    }
    return settings;
});

ipcMain.handle("save-setting", (event, key, value) => {
    setSetting(key, value, (err) => {
        if (err) {
            console.error(`Error saving setting ${key}:`, err);
        } else {
            if (key === "minimizeToTray") {
                minimizeToTraySetting = value === "true";
            }
        }
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

// 获取游戏详细信息
ipcMain.handle('get-game-details', async (event, gameId) => {
    return new Promise((resolve, reject) => {
        getGameDetails(gameId, (err, row) => {
            if (err) {
                console.error("Database error fetching game details:", err);
                reject(err);
            } else {
                console.log("Fetched game details from database:", row); // 调试信息
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

// 窗口控制事件
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});
ipcMain.on('window-close', () => mainWindow.close());


async function initializeSettings() {
    minimizeToTraySetting = await new Promise((resolve) => {
        getSetting("minimizeToTray", (err, value) => {
            resolve(value === "true");
        });
    });

    const silentMode = await new Promise((resolve) => {
        getSetting("silentMode", (err, value) => {
            resolve(value === "true");
        });
    });

    // 如果 silentMode 为 true，不显示主窗口，只创建托盘图标
    if (silentMode) {
        createTray();
    } else {
        createWindow();
        createTray();
    }
}
if (!gotTheLock) {
    dialog.showErrorBox('Neko Game 已运行', '应用已在运行，请检查喵。'); // 提示用户已有进程
    app.exit(); // 使用 app.exit 退出当前实例
} 

// 在应用启动时初始化数据库和进程检测
app.whenReady().then(() => {
    initializeDatabase();
    initializeSettings();
    // 启动后台进程检测，每20秒检测一次（由 gameTracker.js 设置间隔）
    startGameTracking(); 
});

module.exports = { mainWindow }; // 确保 `mainWindow` 可供外部访问


// 定期触发数据更新通知
ipcMain.on('running-status-updated', (event, runningStatus) => {
    console.log("是否有running-status-updated1",runningStatus);
    if (mainWindow && mainWindow.webContents && mainWindow.isVisible()) {
        console.log("是否有running-status-updated2")
        mainWindow.webContents.send('running-status-updated', runningStatus);
    }
});



// 获取游戏时长数据
ipcMain.handle('get-game-time-data', (event) => {
    return new Promise((resolve, reject) => {
        getGameTimeData((err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
});


// 监听获取分析数据请求
ipcMain.handle('fetch-analysis-data', async (event, { type, range }) => {
    return new Promise((resolve, reject) => {
        getAnalysisData(type, range, (err, data, updatedAt) => {
            if (err) {
                console.error("Error fetching analysis data for", type, ":", err);
                reject(new Error(`Error fetching analysis data for ${type}: ${err.message || err}`));
            } else {
                resolve({ data, updatedAt });
            }
        });
    });
});

// 获取游戏详细信息
ipcMain.handle("getGameDetails", async (event, gameId) => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(path.join(__dirname, "neko_game.db"));
        db.get(`
            SELECT g.name, g.icon, g.poster_horizontal, 
                   (SELECT SUM(duration) FROM game_sessions WHERE game_id = g.id) AS total_time,
                   (SELECT end_time FROM game_sessions WHERE game_id = g.id ORDER BY end_time DESC LIMIT 1) AS last_played,
                   (SELECT COUNT(*) + 1 FROM games AS g2
                    WHERE (SELECT SUM(duration) FROM game_sessions WHERE game_id = g2.id) >
                          (SELECT SUM(duration) FROM game_sessions WHERE game_id = g.id)) AS rank
            FROM games AS g
            WHERE g.id = ?
        `, [gameId], (err, row) => {
            db.close();
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
});

// 删除游戏及相关数据
ipcMain.handle("delete-game", async (event, gameId) => {
    return new Promise((resolve, reject) => {
        deleteGame(gameId, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

// 更新游戏数据
ipcMain.handle("update-game", async (event, gameData) => {
    return new Promise((resolve, reject) => {
        updateGame(gameData, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

// 获取游戏时长趋势数据
ipcMain.handle("getGameTrendData", async (event, gameId) => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(path.join(__dirname, "neko_game.db"));
        db.all(`
            SELECT DATE(start_time) AS date, SUM(duration) AS total_time
            FROM game_sessions
            WHERE game_id = ?
            GROUP BY DATE(start_time)
            ORDER BY date ASC
        `, [gameId], (err, rows) => {
            db.close();
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
});

// 开机自启动
ipcMain.handle("set-auto-launch", (event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
});

// 检查并清理错误数据
ipcMain.handle("check-errors", async () => {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM game_sessions WHERE end_time IS NULL OR end_time < start_time`, [], function (err) {
            if (err) {
                reject("检查错误时发生问题：" + err.message);
            } else {
                resolve(this.changes > 0 ? `已处理 ${this.changes} 条数据` : null); // 返回处理的条数
            }
        });
    });
});




// 统一 refresh-analysis-data 格式
ipcMain.handle('refresh-analysis-data', async (event, type) => {
    return new Promise((resolve, reject) => {
        refreshAnalysisData(type, (err, data, updatedAt) => {
            if (err) {
                console.error("Error refreshing analysis data for", type, ":", err);
                reject(new Error(`Error refreshing analysis data for ${type}: ${err.message || err}`));
            } else {
                resolve({ data, updatedAt });
            }
        });
    });
});

// 获取排行榜数据
ipcMain.handle('getLeaderboardData', async () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT games.name, games.icon, games.poster_horizontal, MAX(game_sessions.end_time) AS end_time, SUM(game_sessions.duration) AS total_time
                FROM games
                LEFT JOIN game_sessions ON games.id = game_sessions.game_id
                GROUP BY games.id
                ORDER BY total_time DESC`, 
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
    });
});

// 获取日志数据
ipcMain.handle('getLogData', async (event, page) => {
    const pageSize = 20;
    return new Promise((resolve, reject) => {
        db.all(`SELECT games.name AS game_name, games.icon, games.poster_horizontal, game_sessions.start_time, game_sessions.end_time, game_sessions.duration
                FROM game_sessions
                LEFT JOIN games ON games.id = game_sessions.game_id
                ORDER BY game_sessions.start_time DESC
                LIMIT ? OFFSET ?`, 
            [pageSize, page * pageSize], 
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
    });
});


ipcMain.handle('get-log-data', async (event, page) => {
    const logsPerPage = 20;
    const offset = page * logsPerPage;

    return new Promise((resolve, reject) => {
        db.all(`
            SELECT game_sessions.*, games.name AS game_name, games.icon, games.poster_horizontal
            FROM game_sessions 
            JOIN games ON games.id = game_sessions.game_id
            ORDER BY game_sessions.start_time DESC
            LIMIT ? OFFSET ?`, 
            [logsPerPage, offset], 
            (err, rows) => {
                if (err) {
                    console.error("Error fetching log data:", err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            }
        );
    });
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
