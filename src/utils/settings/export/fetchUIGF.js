const axios = require("axios");
const fs = require("fs");
const path = require("path");

/**
 * 根据UIGF API下载物品名称字典
 * @param {string} game - 游戏名称 (genshin, starrail, zzz)
 * @param {string} lang - 语言代码 (目前只支持 chs)
 * @param {boolean} forceDownload - 是否强制下载，忽略时间戳检查
 * @returns {Promise<{success: boolean, skipped: boolean, reason?: string}>} - 下载结果
 */
async function downloadUIGFDict(game, lang = "chs", forceDownload = false) {
  const supportedGames = ["genshin", "starrail", "zzz"];
  const supportedLangs = ["chs"]; // 目前只支持中文简体

  if (!supportedGames.includes(game)) {
    console.error(
      `不支持的游戏: ${game}, 支持的游戏: ${supportedGames.join(", ")}`
    );
    return { success: false, skipped: false, reason: "不支持的游戏" };
  }

  if (!supportedLangs.includes(lang)) {
    console.error(
      `不支持的语言: ${lang}, 支持的语言: ${supportedLangs.join(", ")}`
    );
    return { success: false, skipped: false, reason: "不支持的语言" };
  }

  const apiUrl = `https://api.uigf.org/dict/${game}/${lang}.json`;
  const fileName = `${game}_dict_${lang}.json`;
  const dataDir = process.env.NEKO_GAME_FOLDER_PATH;
  const dictDir = path.join(dataDir, "dict");
  const filePath = path.join(dictDir, fileName);

  try {
    console.log(`正在检查 ${game} 的 ${lang} 字典更新...`);

    // 先发送 HEAD 请求检查 last-modified 时间
    const headResponse = await axios.head(apiUrl, {
      timeout: 10000, // 10秒超时
      headers: {
        "User-Agent": "NekoGame/1.0",
      },
    });

    // 获取服务器的内容更新时间
    const serverLastModified = headResponse.headers["last-modified"];
    let serverTimestamp = null;
    if (serverLastModified) {
      serverTimestamp = new Date(serverLastModified).getTime();
      if (isNaN(serverTimestamp)) {
        console.warn(`无效的 last-modified 头: ${serverLastModified}`);
        serverTimestamp = null;
      }
    }

    // 如果不强制下载，检查本地已有的时间戳
    if (!forceDownload) {
      const localTimestamp = getDownloadTimestamp(game, lang);

      // 如果本地有记录且服务器时间戳存在，比较时间戳
      if (
        localTimestamp &&
        serverTimestamp &&
        localTimestamp.isContentTimestamp
      ) {
        if (serverTimestamp <= localTimestamp.timestamp) {
          console.log(`${game} 的 ${lang} 字典已是最新版本，跳过下载`);
          console.log(
            `本地版本: ${new Date(localTimestamp.timestamp).toLocaleString(
              "zh-CN"
            )}`
          );
          console.log(
            `服务器版本: ${new Date(serverTimestamp).toLocaleString("zh-CN")}`
          );
          return { success: true, skipped: true, reason: "字典已是最新版本" };
        }
      }
    }

    console.log(`正在下载 ${game} 的 ${lang} 字典...`);
    if (!forceDownload) {
      const localTimestamp = getDownloadTimestamp(game, lang);
      if (localTimestamp && serverTimestamp) {
        console.log(
          `本地版本: ${new Date(localTimestamp.timestamp).toLocaleString(
            "zh-CN"
          )}`
        );
        console.log(
          `服务器版本: ${new Date(serverTimestamp).toLocaleString("zh-CN")}`
        );
      }
    }

    // 发送请求下载字典
    const response = await axios.get(apiUrl, {
      timeout: 10000, // 10秒超时
      headers: {
        "User-Agent": "NekoGame/1.0",
      },
    });

    // 检查响应状态
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 验证响应数据格式
    if (!response.data || typeof response.data !== "object") {
      throw new Error("字典数据格式无效");
    }

    // 确保数据目录和字典子目录存在
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(dictDir)) {
      fs.mkdirSync(dictDir, { recursive: true });
    }

    // 写入文件
    fs.writeFileSync(filePath, JSON.stringify(response.data, null, 2), "utf8");

    // 使用之前获取的服务器时间戳
    const contentTimestamp = serverTimestamp;

    // 记录内容更新时间戳
    saveDownloadTimestamp(game, lang, contentTimestamp);

    console.log(`${game} 的 ${lang} 字典下载成功: ${filePath}`);
    console.log(`字典包含 ${Object.keys(response.data).length} 个条目`);
    if (serverLastModified) {
      console.log(
        `字典内容更新时间: ${new Date(serverLastModified).toLocaleString(
          "zh-CN"
        )}`
      );
    }

    return { success: true, skipped: false, reason: "下载成功" };
  } catch (error) {
    console.error(`下载 ${game} 的 ${lang} 字典失败:`, error.message);

    // 如果下载失败且文件已部分写入，删除该文件
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`已删除损坏的字典文件: ${filePath}`);
      } catch (deleteError) {
        console.error(`删除损坏文件失败:`, deleteError.message);
      }
    }

    return { success: false, skipped: false, reason: error.message };
  }
}

/**
 * 下载所有支持游戏的字典
 * @param {string} lang - 语言代码 (默认 'chs')
 * @returns {Promise<{success: string[], failed: string[], skipped: string[]}>} - 下载结果统计
 */
async function downloadAllUIGFDicts(lang = "chs") {
  const games = ["genshin", "starrail", "zzz"];
  const results = {
    success: [],
    failed: [],
    skipped: [],
  };

  console.log(`开始检查并下载所有游戏的 ${lang} 字典...`);

  for (const game of games) {
    try {
      // 检查本地时间戳
      const localTimestamp = getDownloadTimestamp(game, lang);

      // 发送 HEAD 请求检查服务器更新时间
      const apiUrl = `https://api.uigf.org/dict/${game}/${lang}.json`;
      let serverTimestamp = null;

      try {
        const headResponse = await axios.head(apiUrl, {
          timeout: 10000,
          headers: { "User-Agent": "NekoGame/1.0" },
        });

        const serverLastModified = headResponse.headers["last-modified"];
        if (serverLastModified) {
          serverTimestamp = new Date(serverLastModified).getTime();
          if (isNaN(serverTimestamp)) {
            serverTimestamp = null;
          }
        }
      } catch (headError) {
        console.warn(
          `检查 ${game} 字典更新时间失败，将尝试下载:`,
          headError.message
        );
      }

      // 如果本地有记录且服务器时间戳存在，比较时间戳
      if (
        localTimestamp &&
        serverTimestamp &&
        localTimestamp.isContentTimestamp
      ) {
        if (serverTimestamp <= localTimestamp.timestamp) {
          console.log(`${game} 的 ${lang} 字典已是最新版本，跳过下载`);
          results.skipped.push(game);
          continue;
        }
      }

      const result = await downloadUIGFDict(game, lang, true); // 强制下载，因为时间戳检查已在上面完成
      if (result.success) {
        if (result.skipped) {
          results.skipped.push(game);
        } else {
          results.success.push(game);
        }
      } else {
        results.failed.push(game);
      }
    } catch (error) {
      console.error(`处理 ${game} 字典时发生错误:`, error.message);
      results.failed.push(game);
    }
  }

  console.log("字典检查和下载完成:");
  console.log(`成功: ${results.success.join(", ")}`);
  if (results.skipped.length > 0) {
    console.log(`跳过: ${results.skipped.join(", ")}`);
  }
  if (results.failed.length > 0) {
    console.log(`失败: ${results.failed.join(", ")}`);
  }

  return results;
}

/**
 * 检查字典文件是否存在
 * @param {string} game - 游戏名称
 * @param {string} lang - 语言代码
 * @returns {boolean} - 文件是否存在
 */
function checkDictExists(game, lang = "chs") {
  const fileName = `${game}_dict_${lang}.json`;
  const dictDir = path.join(process.env.NEKO_GAME_FOLDER_PATH, "dict");
  const filePath = path.join(dictDir, fileName);
  return fs.existsSync(filePath);
}

/**
 * 读取字典文件
 * @param {string} game - 游戏名称
 * @param {string} lang - 语言代码
 * @returns {Object|null} - 字典数据或null
 */
function loadDict(game, lang = "chs") {
  const fileName = `${game}_dict_${lang}.json`;
  const dictDir = path.join(process.env.NEKO_GAME_FOLDER_PATH, "dict");
  const filePath = path.join(dictDir, fileName);

  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`字典文件不存在: ${filePath}`);
      return null;
    }

    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`读取字典文件失败: ${filePath}`, error.message);
    return null;
  }
}

/**
 * 保存字典下载时间戳
 * @param {string} game - 游戏名称
 * @param {string} lang - 语言代码
 * @param {number|null} contentTimestamp - 内容更新时间戳（来自 last-modified 头），如果为 null 则使用当前时间
 */
function saveDownloadTimestamp(game, lang = "chs", contentTimestamp = null) {
  const dictDir = path.join(process.env.NEKO_GAME_FOLDER_PATH, "dict");
  const timestampFile = path.join(dictDir, "uigf_download_timestamps.json");
  let timestamps = {};

  // 确保dict目录存在
  if (!fs.existsSync(dictDir)) {
    fs.mkdirSync(dictDir, { recursive: true });
  }

  // 读取现有时间戳
  try {
    if (fs.existsSync(timestampFile)) {
      const data = fs.readFileSync(timestampFile, "utf8");
      timestamps = JSON.parse(data);
    }
  } catch (error) {
    console.warn("读取时间戳文件失败，将创建新文件:", error.message);
    timestamps = {};
  }

  // 使用内容更新时间戳或当前时间
  const finalTimestamp = contentTimestamp || Date.now();
  const timestampDate = new Date(finalTimestamp);

  // 更新时间戳
  const key = `${game}_${lang}`;
  timestamps[key] = {
    timestamp: finalTimestamp,
    dateString: timestampDate.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    game,
    lang,
    isContentTimestamp: contentTimestamp !== null, // 标记是否为内容更新时间
  };

  // 保存时间戳文件
  try {
    fs.writeFileSync(
      timestampFile,
      JSON.stringify(timestamps, null, 2),
      "utf8"
    );
    const timestampType =
      contentTimestamp !== null ? "内容更新时间" : "下载时间";
    console.log(`已记录 ${game} 的 ${lang} 字典${timestampType}`);
  } catch (error) {
    console.error("保存时间戳文件失败:", error.message);
  }
}

/**
 * 获取字典下载时间戳
 * @param {string} game - 游戏名称
 * @param {string} lang - 语言代码
 * @returns {Object|null} - 时间戳信息或null
 */
function getDownloadTimestamp(game, lang = "chs") {
  const dictDir = path.join(process.env.NEKO_GAME_FOLDER_PATH, "dict");
  const timestampFile = path.join(dictDir, "uigf_download_timestamps.json");

  try {
    if (!fs.existsSync(timestampFile)) {
      return null;
    }

    const data = fs.readFileSync(timestampFile, "utf8");
    const timestamps = JSON.parse(data);
    const key = `${game}_${lang}`;

    return timestamps[key] || null;
  } catch (error) {
    console.error("读取时间戳文件失败:", error.message);
    return null;
  }
}

/**
 * 获取所有字典的下载时间戳
 * @param {string} lang - 语言代码
 * @returns {Object} - 所有游戏的时间戳信息
 */
function getAllDownloadTimestamps(lang = "chs") {
  const games = ["genshin", "starrail", "zzz"];
  const result = {};

  for (const game of games) {
    result[game] = getDownloadTimestamp(game, lang);
  }

  return result;
}

/**
 * 自动下载所有字典（启动时调用）
 * @param {string} lang - 语言代码
 * @returns {Promise<{success: string[], failed: string[], skipped: string[]}>} - 下载结果
 */
async function autoDownloadDictsOnStartup(lang = "chs") {
  console.log("启动时自动下载 UIGF 字典...");

  const games = ["genshin", "starrail", "zzz"];
  const results = {
    success: [],
    failed: [],
    skipped: [],
  };

  for (const game of games) {
    try {
      console.log(`正在检查 ${game} 字典...`);
      const result = await downloadUIGFDict(game, lang); // 使用默认的时间戳检查

      if (result.success) {
        if (result.skipped) {
          results.skipped.push(game);
        } else {
          results.success.push(game);
        }
      } else {
        results.failed.push(game);
      }
    } catch (error) {
      console.error(`处理 ${game} 字典时发生错误:`, error.message);
      results.failed.push(game);
    }
  }

  console.log("启动时字典检查完成:");
  console.log(`成功: ${results.success.join(", ")}`);
  if (results.skipped.length > 0) {
    console.log(`跳过: ${results.skipped.join(", ")}`);
  }
  if (results.failed.length > 0) {
    console.log(`失败: ${results.failed.join(", ")}`);
  }

  return results;
}

module.exports = {
  downloadUIGFDict,
  downloadAllUIGFDicts,
  checkDictExists,
  loadDict,
  saveDownloadTimestamp,
  getDownloadTimestamp,
  getAllDownloadTimestamps,
  autoDownloadDictsOnStartup,
};
