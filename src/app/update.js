const path = require('path');
const { createWindow} = require('../main');
const { autoUpdater} = require('electron-updater');
const { ipcMain, BrowserWindow, shell,app, dialog} = require('electron');

let guideWindow = null;
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
                console.log(`用户选择跳过版本 ${currentVersion}`);
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
        backgroundColor: '#1e1e1e',
        frame: false,
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


// 监听前端的 "check-for-updates" 事件
ipcMain.on('check-for-updates', () => {
    console.log("主动检查更新...");
    autoUpdater.checkForUpdates();  // 调用主动更新检查方法

    // 监听 'update-not-available' 事件，表示没有更新可用
    autoUpdater.once('update-not-available', () => {
        console.log('当前已经是最新版本');
        // 显示对话框提示用户已经是最新版本
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: '已经是最新版本',
            message: '您的应用已经是最新版本！',
            buttons: ['好的']
        });
        // 发送消息到渲染进程，表示没有更新
        mainWindow.webContents.send('update-status', 'no-update');  // 发送没有更新
    });
});

// 监听前端的 "open-update-log" 事件
ipcMain.on('open-update-log', () => {
    createGuideWindow(mainWindow);  // 打开更新日志窗口
});


initializeUpdater(); //初始化更新代码
module.exports = { initializeUpdater };