const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { autoUpdater} = require('electron-updater');
const { spawn } = require('child_process');
//在调用database前设置
const fs = require('fs');
// 获取用户数据文件夹路径
const userDataPath = app.getPath('userData');
// 设置 NekoGame 文件夹路径
const nekoGameFolderPath = path.join(userDataPath, 'NekoGame');
// 确保文件夹存在，如果不存在则创建它
if (!fs.existsSync(nekoGameFolderPath)) {
    fs.mkdirSync(nekoGameFolderPath, { recursive: true });
  }
process.env.NEKO_GAME_FOLDER_PATH = nekoGameFolderPath;
require("./utils/console");


const { initializeDatabase, getGameDetails, getGameTimeData, getGameTrendData, addGame, deleteGame, updateGame, getSetting, setSetting, getGameDailyTimeData } = require('./database'); // 确保导入 getGameTimeData
const { initializeTrackedGames, startGameTracking, sendRunningStatus } = require('./gameTracker');
const { getAnalysisData, refreshAnalysisData, generateAnalysisData } = require('./js/analysis');
const gotTheLock = app.requestSingleInstanceLock();



let tray = null;
let mainWindow;
let isWindowVisible = true;
let minimizeToTraySetting = false;
let guideWindow = null;


// 更新逻辑
// 创建引导窗口
function createGuideWindow(mainWindow) {
    if (!mainWindow) {
        createWindow(); // 如果主窗口未创建，则创建窗口
    }
    guideWindow = new BrowserWindow({
        width: 600,
        height: 400,
        resizable: false,
        modal: true,
        parent: mainWindow,
        frame: false, // 去掉窗口边框
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    guideWindow.loadFile(path.resolve(__dirname, './pages/guide.html'));
    // 拦截新窗口打开事件，使用默认浏览器打开外部链接
    guideWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // 拦截导航事件，阻止内部导航并改为默认浏览器打开
    guideWindow.webContents.on('will-navigate', (event, url) => {
        if (url !== guideWindow.webContents.getURL()) {
            event.preventDefault(); // 阻止导航
            shell.openExternal(url); // 在默认浏览器中打开链接
        }
    });
    // 监听窗口关闭事件，将 guideWindow 设置为 null
    guideWindow.on('closed', () => {
        guideWindow = null;
    });
    return guideWindow;
}


const db = new sqlite3.Database(path.join(nekoGameFolderPath, "neko_game.db"), (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("Connected to the database.");
    }
});


function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'icon.ico'); // 使用绝对路径
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
            autoUpdater.checkForUpdates(); //检查更新
        } else {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                // 每次窗口显示时发送刷新事件
                sendRunningStatus(); // 立即发送最新的运行状态
                mainWindow.focus();
            }
        }
    });
}



function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 700,
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
    mainWindow.loadFile('src/index.html');
    // 打开开发者工具
    // mainWindow.webContents.once('dom-ready', () => {
    //    mainWindow.webContents.openDevTools();
    // });

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
// 引入其他模块
require('./utils/analysisGacha/analysisIpc'); // 引入分析相关的 IPC 逻辑
require('./utils/analysisGacha/getStarRailUrl'); // 星铁
require('./utils/analysisGacha/getGenshinUrl');
require('./utils/settings/checkError'); // 整理数据

// 在应用启动时初始化数据库和进程检测
app.whenReady().then(() => {
    initializeDatabase();
    initializeSettings();
    initializeUpdater();
    // 启动后台进程检测，每20秒检测一次（由 gameTracker.js 设置间隔）
    startGameTracking();
});
module.exports = { mainWindow }; // 确保 `mainWindow` 可供外部访问

// 使用异步 IIFE（立即调用函数）加载 electron-store 并初始化
async function initializeUpdater() {
    const Store = (await import('electron-store')).default;
    const store = new Store();

    const currentVersion = app.getVersion();
    // 检查是否首次启动或更新
    const savedVersion = store.get('appVersion');
    if (!savedVersion || savedVersion !== currentVersion) {
        // 显示引导窗口并更新版本号
        createGuideWindow(mainWindow);
        store.set('appVersion', currentVersion);
    }
    autoUpdater.autoDownload = false;
    // 检查用户是否跳过了此版本
    if (store.get('skippedVersion') !== currentVersion) {
        autoUpdater.checkForUpdates();
    }

    // 自动更新逻辑
    autoUpdater.on('update-available', (info) => {
        const releaseNotes = info.releaseNotes || '暂无更新日志';
        const releaseName = info.releaseName || '船新版本';
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus(); // 确保窗口获得焦点
        }
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: `${releaseName} 已推出！`,
            message: '发现新版本，是否下载更新？',
            detail: `更新日志：\n${releaseNotes}`,
            buttons: ['让我们开始吧！', '跳过此版本', '下次再提醒我']
        }).then(result => {
            if (result.response === 0) {
                console.log("现在开始下载");
                autoUpdater.downloadUpdate();
            } else if (result.response === 1) {
                // 用户选择跳过此版本，记录版本号
                store.set('skippedVersion', currentVersion);
                console.log(`用户选择跳过版本 ${autoUpdater.updateInfo.version}`);
            } else {
                console.log("用户选择下次提醒");
            }
        });
    });

    autoUpdater.on('download-progress', (progressObj) => {
        let percent = progressObj.percent.toFixed(2);
        let logMessage = `下载速度: ${progressObj.bytesPerSecond}`;
        logMessage += ` - 已下载 ${percent}%`;
        logMessage += ` (${progressObj.transferred}/${progressObj.total})`;
        console.log(logMessage);

        // 更新托盘图标的悬浮提示文字
        if (tray) {
            tray.setToolTip(`NekoGame - 正在后台更新：已下载 ${percent}%`);
        }

        // 可以将进度信息传递到前端并显示
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('download-progress', percent);
        }
    });

    autoUpdater.on('update-downloaded', () => {
        dialog.showMessageBox({
            type: 'info',
            title: '新版本已准备好！',
            message: '更新已准备好，要立刻重启安装喵？\n更新不会导致数据丢失。如果不放心可以备份',
            buttons: ['开始吧！', '稍等']
        }).then(result => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });

        // 恢复托盘提示文字
        if (tray) {
            tray.setToolTip('NekoGame');
        }
    });
}

// 定期触发数据更新通知
ipcMain.on('running-status-updated', (event, runningStatus) => {
    if (mainWindow && mainWindow.webContents && mainWindow.isVisible()) {
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
        const db = new sqlite3.Database(path.join(nekoGameFolderPath, "neko_game.db"));
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

ipcMain.on('request-running-status', (event) => {
    sendRunningStatus(); // 立即发送最新的运行状态
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


//从数据库获取游戏的每日时长数据
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


ipcMain.on('open-external', (event, url) => {
    if (url) {
        shell.openExternal(url);
    }
});

// 启动进程
ipcMain.handle('launch-game', (event, gamePath) => {
    return new Promise((resolve, reject) => {
        try {
            const gameDir = path.dirname(gamePath);
            const gameFile = path.basename(gamePath);

            // 使用 shell: true 并确保路径包含在引号内
            const gameProcess = spawn(`"${gameFile}"`, { cwd: gameDir, shell: true, detached: true });

            gameProcess.on('error', (error) => {
                console.error(`Failed to start game at ${gamePath}:`, error);
                reject(error);
            });

            // 在进程启动后立即返回成功
            console.log(`Game started successfully at ${gamePath}`);
            resolve(true); // 立即返回成功状态

            gameProcess.unref(); // 让游戏进程独立运行，不等待其退出
        } catch (error) {
            console.error(`Error starting game: ${error.message}`);
            reject(error);
        }
    });
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
