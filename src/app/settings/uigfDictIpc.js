const { ipcMain } = require("electron");
const {
  downloadUIGFDict,
  downloadAllUIGFDicts,
  checkDictExists,
  loadDict,
} = require("../utils/settings/export/fetchUIGF");

// 下载单个游戏的字典
ipcMain.handle("download-uigf-dict", async (event, game, lang = "chs") => {
  try {
    const success = await downloadUIGFDict(game, lang);
    return {
      success,
      message: success
        ? `${game} 的 ${lang} 字典下载成功`
        : `${game} 的 ${lang} 字典下载失败`,
    };
  } catch (error) {
    console.error("下载字典时发生错误:", error);
    return {
      success: false,
      message: `下载失败: ${error.message}`,
    };
  }
});

// 下载所有游戏的字典
ipcMain.handle("download-all-uigf-dicts", async (event, lang = "chs") => {
  try {
    const results = await downloadAllUIGFDicts(lang);
    const totalGames = results.success.length + results.failed.length;
    const message = `下载完成！成功: ${results.success.length}/${totalGames}`;

    return {
      success: results.failed.length === 0,
      message,
      results,
    };
  } catch (error) {
    console.error("批量下载字典时发生错误:", error);
    return {
      success: false,
      message: `批量下载失败: ${error.message}`,
      results: { success: [], failed: [] },
    };
  }
});

// 检查字典文件是否存在
ipcMain.handle("check-dict-exists", (event, game, lang = "chs") => {
  try {
    const exists = checkDictExists(game, lang);
    return { exists };
  } catch (error) {
    console.error("检查字典文件时发生错误:", error);
    return { exists: false, error: error.message };
  }
});

// 读取字典数据
ipcMain.handle("load-dict", (event, game, lang = "chs") => {
  try {
    const dict = loadDict(game, lang);
    return {
      success: dict !== null,
      data: dict,
      message: dict ? "字典加载成功" : "字典文件不存在或读取失败",
    };
  } catch (error) {
    console.error("读取字典时发生错误:", error);
    return {
      success: false,
      data: null,
      message: `读取失败: ${error.message}`,
    };
  }
});

// 获取字典状态信息
ipcMain.handle("get-dict-status", (event, lang = "chs") => {
  try {
    const games = ["genshin", "starrail", "zzz"];
    const status = {};

    for (const game of games) {
      const exists = checkDictExists(game, lang);
      if (exists) {
        const dict = loadDict(game, lang);
        status[game] = {
          exists: true,
          itemCount: dict ? Object.keys(dict).length : 0,
          valid: dict !== null,
        };
      } else {
        status[game] = {
          exists: false,
          itemCount: 0,
          valid: false,
        };
      }
    }

    return { success: true, status };
  } catch (error) {
    console.error("获取字典状态时发生错误:", error);
    return {
      success: false,
      status: {},
      message: error.message,
    };
  }
});

console.log("UIGF 字典 IPC 处理程序已注册");
