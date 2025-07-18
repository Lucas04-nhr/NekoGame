const path = require("path");
const { createWindow } = require("../main");
const axios = require("axios");
const { ipcMain, BrowserWindow, shell, app, dialog } = require("electron");

let guideWindow = null;
const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/Lucas04-nhr/NekoGame/releases/latest";
const GITHUB_RELEASES_PAGE = "https://github.com/Lucas04-nhr/NekoGame/releases";

async function initializeUpdater() {
  const Store = (await import("electron-store")).default;
  const store = new Store();

  const currentVersion = app.getVersion();
  // 检查是否首次启动或更新
  const savedVersion = store.get("appVersion");
  if (!savedVersion || savedVersion !== currentVersion) {
    // 显示引导窗口并更新版本号
    createGuideWindow(global.mainWindow);
    store.set("appVersion", currentVersion);
  }

  // 检查用户是否跳过了此版本
  if (store.get("skippedVersion") !== currentVersion) {
    checkForUpdates();
  }
}
async function checkForUpdates() {
  try {
    const Store = (await import("electron-store")).default;
    const store = new Store();
    const currentVersion = app.getVersion();

    const response = await axios.get(GITHUB_RELEASES_URL);
    const latestRelease = response.data;
    const latestVersion = latestRelease.tag_name.replace(/^v/, ""); // 移除 'v' 前缀

    // 简单的版本比较
    if (isNewerVersion(latestVersion, currentVersion)) {
      const releaseNotes = latestRelease.body || "暂无更新日志";
      const releaseName = latestRelease.name || "船新版本";

      if (global.mainWindow) {
        global.mainWindow.show();
        global.mainWindow.focus(); // 确保窗口获得焦点
      }

      dialog
        .showMessageBox(global.mainWindow, {
          type: "info",
          title: `${releaseName} 已推出！`,
          message: "发现新版本，是否前往下载页面？",
          detail: `当前版本：${currentVersion}\n最新版本：${latestVersion}\n\n更新日志：\n${releaseNotes}`,
          buttons: ["前往下载", "跳过此版本", "下次再提醒我"],
        })
        .then((result) => {
          if (result.response === 0) {
            console.log("打开下载页面");
            shell.openExternal(GITHUB_RELEASES_PAGE);
          } else if (result.response === 1) {
            // 用户选择跳过此版本，记录版本号
            store.set("skippedVersion", latestVersion);
            console.log(`用户选择跳过版本 ${latestVersion}`);
          } else {
            console.log("用户选择下次提醒");
          }
        });
    }
  } catch (error) {
    console.error("检查更新失败:", error.message);
  }
}

// 简单的版本比较函数
function isNewerVersion(newVersion, currentVersion) {
  const newParts = newVersion.split(".").map(Number);
  const currentParts = currentVersion.split(".").map(Number);

  for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
    const newPart = newParts[i] || 0;
    const currentPart = currentParts[i] || 0;

    if (newPart > currentPart) return true;
    if (newPart < currentPart) return false;
  }

  return false;
}

// 创建引导窗口
function createGuideWindow(mainWindow) {
  // if (!mainWindow) {
  //     createWindow(); // 如果主窗口未创建，则创建窗口
  // }
  guideWindow = new BrowserWindow({
    width: 570,
    height: 600,
    resizable: false,
    modal: true,
    parent: mainWindow,
    backgroundColor: "#1e1e1e",
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  guideWindow.loadFile(
    path.resolve(__dirname, "../pages/modalPages/guide.html")
  );
  // 拦截新窗口打开事件，使用默认浏览器打开外部链接
  guideWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // 拦截导航事件，阻止内部导航并改为默认浏览器打开
  guideWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== guideWindow.webContents.getURL()) {
      event.preventDefault(); // 阻止导航
      shell.openExternal(url); // 在默认浏览器中打开链接
    }
  });
  // 监听窗口关闭事件，将 guideWindow 设置为 null
  guideWindow.on("closed", () => {
    guideWindow.destroy();
    guideWindow = null;
  });
  return guideWindow;
}

// 监听前端的 "check-for-updates" 事件
ipcMain.on("check-for-updates", async () => {
  console.log("主动检查更新...");

  try {
    const response = await axios.get(GITHUB_RELEASES_URL);
    const latestRelease = response.data;
    const currentVersion = app.getVersion();
    const latestVersion = latestRelease.tag_name.replace(/^v/, "");

    if (isNewerVersion(latestVersion, currentVersion)) {
      // 有新版本，使用 checkForUpdates 函数处理
      await checkForUpdates();
    } else {
      console.log("当前已经是最新版本");
      // 显示对话框提示用户已经是最新版本
      dialog.showMessageBox(global.mainWindow, {
        type: "info",
        title: "已经是最新版本",
        message: "您的应用已经是最新版本！",
        buttons: ["好的"],
      });
      // 发送消息到渲染进程，表示没有更新
      global.mainWindow.webContents.send("update-status", "no-update");
    }
  } catch (error) {
    console.error("检查更新失败:", error.message);
    dialog.showMessageBox(global.mainWindow, {
      type: "error",
      title: "检查更新失败",
      message: "无法连接到更新服务器，请检查网络连接。",
      buttons: ["好的"],
    });
  }
});

// 监听前端的 "open-update-log" 事件
ipcMain.on("open-update-log", () => {
  createGuideWindow(global.mainWindow); // 打开更新日志窗口
});

initializeUpdater(); //初始化更新代码
module.exports = { initializeUpdater };
