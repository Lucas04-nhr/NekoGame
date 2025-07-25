const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  dialog,
  shell,
} = require("electron");
const path = require("path");
//在调用database前设置
require("./app/settings/dataFile");

// Validate critical environment variables early
if (!process.env.NEKO_GAME_FOLDER_PATH) {
  console.error("NEKO_GAME_FOLDER_PATH environment variable is not set");
  // This will be set by dataFile.js, but let's ensure it's available
}

require("./app/console"); // 导入日志管理
require("./utils/syncMessage"); //导入消息通知

const {
  initializeDatabase,
  getSetting,
  setSetting,
} = require("./app/database");
const { startGameTracking, sendRunningStatus } = require("./app/gameTracker");
const gotTheLock = app.requestSingleInstanceLock();

// Add process error handlers
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  dialog.showErrorBox(
    "Uncaught Exception",
    `An unexpected error occurred: ${error.message}`
  );
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  dialog.showErrorBox("Unhandled Rejection", `Promise rejection: ${reason}`);
});

let tray = null;
let mainWindow;
global.mainWindow = mainWindow; // 将 mainWindow 保存在全局对象中
// let isWindowVisible = true;
let minimizeToTraySetting = false;
const isMac = process.platform === "darwin";

function createTray() {
  const iconPath = isMac
    ? path.join(__dirname, "assets", "macOS-tray.png") // Use PNG for macOS from correct path
    : path.join(__dirname, "assets", "icon.ico"); // Use ICO for Windows
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isMac ? "退出应用" : "退出应用",
      click: () => {
        tray.destroy();
        app.exit();
      },
    },
  ]);
  tray.setToolTip("Neko Game");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (!mainWindow) {
      createWindow(); // 如果主窗口未创建，则创建窗口
      sendRunningStatus(); // 立即发送最新的运行状态
    } else {
      if (mainWindow.isVisible()) {
        // mainWindow.hide();
        mainWindow.destroy(); // 销毁窗口并释放资源
        mainWindow = null; // 清除引用
        global.mainWindow = null; // 清除全局引用
        // isWindowVisible = false;
      } else {
        mainWindow.show();
        // 每次窗口显示时发送刷新事件
        sendRunningStatus(); // 立即发送最新的运行状态
        mainWindow.focus();
      }
    }
  });
  global.tray = tray;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1250,
    height: 700,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: "#1e1e1e",
    webPreferences: {
      sandbox: false,
      preload: path.join(__dirname, "preload.js"), // 指定 preload 脚本
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
      hardwareAcceleration: false, // Disable hardware acceleration to prevent SIGSEGV on macOS
    },
    frame: !isMac, // 在 macOS 上使用原生窗口框架，其他平台使用无框架
    titleBarStyle: isMac ? "hiddenInset" : undefined, // macOS 上隐藏标题栏但保留控制按钮
  });
  mainWindow.loadFile("src/index.html");
  loadBackground(mainWindow);

  // 打开开发者工具
  // mainWindow.webContents.once('dom-ready', () => {
  //    mainWindow.webContents.openDevTools();
  // });
  // 定义后全局导出 mainWindow
  global.mainWindow = mainWindow; // 更新global.mainWindow
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("set-app-path", app.getAppPath());

    // 应用自定义CSS（如果启用）
    const { getCSSContent } = require("./app/settings/customCSS");
    getCSSContent()
      .then((result) => {
        if (result.success) {
          const CUSTOM_CSS_ID = "neko-game-custom-css";
          mainWindow.webContents
            .executeJavaScript(
              `
          const existingStyle = document.getElementById('${CUSTOM_CSS_ID}');
          if (existingStyle) {
            existingStyle.remove();
          }
          const style = document.createElement('style');
          style.id = '${CUSTOM_CSS_ID}';
          style.textContent = \`${result.css.replace(/`/g, "\\`")}\`;
          document.head.appendChild(style);
        `
            )
            .catch(console.error);
        }
      })
      .catch(console.error);
  });
  // mainWindow.on('minimize', () => {
  //     isWindowVisible = false;
  // });
  // mainWindow.on('restore', () => {
  //     isWindowVisible = true;
  // });
  mainWindow.on("close", (event) => {
    if (minimizeToTraySetting) {
      event.preventDefault();
      // 隐藏窗口
      // mainWindow.hide();
      mainWindow.destroy(); // 销毁窗口并释放资源
      mainWindow = null; //清除引用
      global.mainWindow = null; // 清除全局引用
      // isWindowVisible = false;
    } else {
      mainWindow = null; // 清除引用
      global.mainWindow = null; // 清除全局引用
      app.quit();
    }
  });
}

ipcMain.handle("load-settings", async () => {
  const settings = {};
  const keys = [
    "minimizeToTray",
    "silentMode",
    "autoLaunch",
    "hardwareAcceleration",
  ];

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

// 窗口控制事件
ipcMain.on("window-minimize", () => mainWindow.minimize());
ipcMain.on("window-maximize", () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.on("window-close", () => mainWindow.close());

// 开发者工具控制
ipcMain.on("toggle-dev-tools", () => {
  if (mainWindow && mainWindow.webContents) {
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    } else {
      mainWindow.webContents.openDevTools();
    }
  }
});
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
  dialog.showErrorBox("Neko Game 已运行", "应用已在运行，请检查喵。"); // 提示用户已有进程
  app.exit(); // 使用 app.exit 退出当前实例
}
require("./utils/analysisGacha/analysisIpc"); // 引入分析相关的 IPC 逻辑
// 设置页面
require("./utils/settings/checkError");
require("./utils/settings/export/exportExcel");
const { loadBackground } = require("./utils/settings/background");
// 自定义CSS功能
require("./app/settings/customCSS");
// 页面功能
require("./app/appIPC");
app
  .whenReady()
  .then(() => {
    try {
      console.log("Starting app initialization...");
      initializeDatabase();
      console.log("Database initialized successfully");
      initializeSettings();
      console.log("Settings initialized successfully");
      // 启动后台进程检测，每20秒检测一次（由 gameTracker.js 设置间隔）
      startGameTracking();
      console.log("Game tracking started successfully");
      module.exports = { createWindow };
      require("./app/update"); // 初始化更新
      require("./app/uploadData/uploadDataIpc"); // 初始化上传代码
      require("./app/settings/uigfDictIpc"); // 初始化UIGF字典下载功能
      require("./app/settings/hakushiMetadataIpc"); // 初始化Hakushi元数据下载功能
      require("./app/settings/githubPAT"); // 初始化GitHub PAT设置

      // 初始化自定义CSS功能
      const { initializeCustomCSS } = require("./app/settings/customCSS");
      initializeCustomCSS();

      // 启动时自动下载所有元数据和字典
      setTimeout(async () => {
        try {
          console.log("开始启动时自动下载元数据和字典...");

          // 使用统一的元数据客户端下载所有数据
          const metadataClient = require("./utils/metadata/metadataClient");
          const results = await metadataClient.autoDownloadAllOnStartup("chs");

          console.log("启动时元数据和字典下载完成");

          // 输出下载结果统计
          if (results.uigf) {
            console.log(
              `UIGF字典: 成功 ${results.uigf.success.length}, 跳过 ${results.uigf.skipped.length}, 失败 ${results.uigf.failed.length}`
            );
          }
          if (results.hakushi) {
            const hakushiStats = Object.values(results.hakushi).reduce(
              (acc, game) => {
                acc.success += game.success.length;
                acc.skipped += game.skipped.length;
                acc.failed += game.failed.length;
                return acc;
              },
              { success: 0, skipped: 0, failed: 0 }
            );
            console.log(
              `Hakushi元数据: 成功 ${hakushiStats.success}, 跳过 ${hakushiStats.skipped}, 失败 ${hakushiStats.failed}`
            );
          }
        } catch (error) {
          console.error("启动时下载元数据和字典失败:", error);

          // 如果统一客户端失败，回退到单独的UIGF下载
          try {
            console.log("回退到单独下载UIGF字典...");
            const {
              autoDownloadDictsOnStartup,
            } = require("./utils/settings/export/fetchUIGF");
            await autoDownloadDictsOnStartup("chs");
            console.log("UIGF字典下载完成");
          } catch (fallbackError) {
            console.error("UIGF字典下载也失败了:", fallbackError);
          }
        }
      }, 3000); // 延迟3秒启动，确保应用完全初始化

      console.log("App initialization completed successfully");
    } catch (error) {
      console.error("Error during app initialization:", error);
      dialog.showErrorBox(
        "Initialization Error",
        `Failed to initialize app: ${error.message}`
      );
      app.quit();
    }
  })
  .catch((error) => {
    console.error("App ready failed:", error);
    dialog.showErrorBox(
      "App Ready Failed",
      `App failed to start: ${error.message}`
    );
    app.quit();
  });

// 触发运行状态更新通知
ipcMain.on("running-status-updated", (event, runningStatus) => {
  if (mainWindow && mainWindow.webContents && mainWindow.isVisible()) {
    mainWindow.webContents.send("running-status-updated", runningStatus);
  }
});

ipcMain.on("request-running-status", (event) => {
  sendRunningStatus(); // 立即发送最新的运行状态
});

// 开机自启动
ipcMain.handle("set-auto-launch", (event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: enabled });
});

ipcMain.on("open-external", (event, url) => {
  if (url) {
    shell.openExternal(url);
  }
});

app.on("window-all-closed", () => {
  // 在托盘模式下不退出应用
  if (!isMac) {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
