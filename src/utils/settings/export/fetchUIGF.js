const axios = require("axios");
const fs = require("fs");
const path = require("path");

/**
 * 根据UIGF API下载物品名称字典
 * @param {string} game - 游戏名称 (genshin, starrail, zzz)
 * @param {string} lang - 语言代码 (目前只支持 chs)
 * @returns {Promise<boolean>} - 下载是否成功
 */
async function downloadUIGFDict(game, lang = "chs") {
  const supportedGames = ["genshin", "starrail", "zzz"];
  const supportedLangs = ["chs"]; // 目前只支持中文简体

  if (!supportedGames.includes(game)) {
    console.error(
      `不支持的游戏: ${game}, 支持的游戏: ${supportedGames.join(", ")}`
    );
    return false;
  }

  if (!supportedLangs.includes(lang)) {
    console.error(
      `不支持的语言: ${lang}, 支持的语言: ${supportedLangs.join(", ")}`
    );
    return false;
  }

  const apiUrl = `https://api.uigf.org/dict/${game}/${lang}.json`;
  const fileName = `${game}_dict_${lang}.json`;
  const dataDir = process.env.NEKO_GAME_FOLDER_PATH;
  const dictDir = path.join(dataDir, "dict");
  const filePath = path.join(dictDir, fileName);

  try {
    console.log(`正在下载 ${game} 的 ${lang} 字典...`);

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

    // 记录下载时间戳
    saveDownloadTimestamp(game, lang);

    console.log(`${game} 的 ${lang} 字典下载成功: ${filePath}`);
    console.log(`字典包含 ${Object.keys(response.data).length} 个条目`);

    return true;
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

    return false;
  }
}

/**
 * 下载所有支持游戏的字典
 * @param {string} lang - 语言代码 (默认 'chs')
 * @returns {Promise<{success: string[], failed: string[]}>} - 下载结果统计
 */
async function downloadAllUIGFDicts(lang = "chs") {
  const games = ["genshin", "starrail", "zzz"];
  const results = {
    success: [],
    failed: [],
  };

  console.log(`开始下载所有游戏的 ${lang} 字典...`);

  for (const game of games) {
    const success = await downloadUIGFDict(game, lang);
    if (success) {
      results.success.push(game);
    } else {
      results.failed.push(game);
    }
  }

  console.log("字典下载完成:");
  console.log(`成功: ${results.success.join(", ")}`);
  if (results.failed.length > 0) {
    console.log(`失败: ${results.failed.join(", ")}`);
  }

  // 字典下载完成后，更新数据库中已有记录的物品名称
  if (results.success.length > 0) {
    try {
      console.log("开始更新数据库中的物品名称...");
      const { updateAllGachaItemNames } = require("./updateItemNames");
      const updateResult = await updateAllGachaItemNames(lang);

      if (updateResult.total.updated > 0) {
        console.log(
          `物品名称更新完成: 共更新 ${updateResult.total.updated} 条记录`
        );
      } else {
        console.log("没有记录需要更新物品名称");
      }

      if (updateResult.total.errors > 0) {
        console.warn(
          `物品名称更新过程中出现 ${updateResult.total.errors} 个错误`
        );
      }
    } catch (error) {
      console.error("更新物品名称失败:", error.message);
    }
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
 */
function saveDownloadTimestamp(game, lang = "chs") {
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

  // 更新时间戳
  const key = `${game}_${lang}`;
  timestamps[key] = {
    timestamp: Date.now(),
    dateString: new Date().toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    game,
    lang,
  };

  // 保存时间戳文件
  try {
    fs.writeFileSync(
      timestampFile,
      JSON.stringify(timestamps, null, 2),
      "utf8"
    );
    console.log(`已记录 ${game} 的 ${lang} 字典下载时间`);
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
      console.log(`正在下载 ${game} 字典...`);
      const success = await downloadUIGFDict(game, lang);

      if (success) {
        results.success.push(game);
      } else {
        results.failed.push(game);
      }
    } catch (error) {
      console.error(`下载 ${game} 字典时发生错误:`, error.message);
      results.failed.push(game);
    }
  }

  console.log("启动时字典下载完成:");
  console.log(`成功: ${results.success.join(", ")}`);
  if (results.failed.length > 0) {
    console.log(`失败: ${results.failed.join(", ")}`);
  }

  // 字典下载完成后，更新数据库中已有记录的物品名称
  if (results.success.length > 0) {
    try {
      console.log("开始更新数据库中的物品名称...");
      const { updateAllGachaItemNames } = require("./updateItemNames");
      const updateResult = await updateAllGachaItemNames(lang);

      if (updateResult.total.updated > 0) {
        console.log(
          `物品名称更新完成: 共更新 ${updateResult.total.updated} 条记录`
        );
      } else {
        console.log("没有记录需要更新物品名称");
      }

      if (updateResult.total.errors > 0) {
        console.warn(
          `物品名称更新过程中出现 ${updateResult.total.errors} 个错误`
        );
      }
    } catch (error) {
      console.error("更新物品名称失败:", error.message);
    }
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
