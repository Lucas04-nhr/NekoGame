const axios = require("axios");
const fs = require("fs");
const path = require("path");

// 游戏映射配置
const GAME_CONFIG = {
  genshin: {
    apiKey: "gi",
    types: ["character", "weapon"],
  },
  starrail: {
    apiKey: "hsr",
    types: ["character", "lightcone"],
  },
  zzz: {
    apiKey: "zzz",
    types: ["character", "weapon", "bangboo"],
  },
};

/**
 * 根据 Hakushi API 下载游戏元数据
 * @param {string} game - 游戏名称 (genshin, starrail, zzz)
 * @param {string} type - 数据类型 (character, weapon, lightcone, bangboo)
 * @param {boolean} forceDownload - 是否强制下载，忽略时间戳检查
 * @returns {Promise<{success: boolean, skipped: boolean, reason?: string}>} - 下载结果
 */
async function downloadHakushiMetadata(game, type, forceDownload = false) {
  if (!GAME_CONFIG[game]) {
    console.error(
      `不支持的游戏: ${game}, 支持的游戏: ${Object.keys(GAME_CONFIG).join(
        ", "
      )}`
    );
    return { success: false, skipped: false, reason: "不支持的游戏" };
  }

  if (!GAME_CONFIG[game].types.includes(type)) {
    console.error(
      `游戏 ${game} 不支持的数据类型: ${type}, 支持的类型: ${GAME_CONFIG[
        game
      ].types.join(", ")}`
    );
    return { success: false, skipped: false, reason: "不支持的数据类型" };
  }

  const gameApiKey = GAME_CONFIG[game].apiKey;
  const apiUrl = `https://api.hakush.in/${gameApiKey}/data/${type}.json`;
  const fileName = `${game}_${type}_metadata.json`;
  const dataDir = process.env.NEKO_GAME_FOLDER_PATH;
  const dictDir = path.join(dataDir, "dict");
  const filePath = path.join(dictDir, fileName);

  try {
    console.log(`正在检查 ${game} 的 ${type} 元数据更新...`);

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
      const localTimestamp = getMetadataTimestamp(game, type);

      // 如果本地有记录且服务器时间戳存在，比较时间戳
      if (
        localTimestamp &&
        serverTimestamp &&
        localTimestamp.isContentTimestamp
      ) {
        if (serverTimestamp <= localTimestamp.timestamp) {
          console.log(`${game} 的 ${type} 元数据已是最新版本，跳过下载`);
          console.log(
            `本地版本: ${new Date(localTimestamp.timestamp).toLocaleString(
              "zh-CN"
            )}`
          );
          console.log(
            `服务器版本: ${new Date(serverTimestamp).toLocaleString("zh-CN")}`
          );
          return { success: true, skipped: true, reason: "元数据已是最新版本" };
        }
      }
    }

    console.log(`正在下载 ${game} 的 ${type} 元数据...`);
    if (!forceDownload) {
      const localTimestamp = getMetadataTimestamp(game, type);
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

    // 发送请求下载元数据
    const response = await axios.get(apiUrl, {
      timeout: 15000, // 15秒超时，元数据可能比较大
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
      throw new Error("元数据格式无效");
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
    saveMetadataTimestamp(game, type, contentTimestamp);

    console.log(`${game} 的 ${type} 元数据下载成功: ${filePath}`);

    // 根据数据类型显示不同的统计信息
    if (Array.isArray(response.data)) {
      console.log(`元数据包含 ${response.data.length} 个条目`);
    } else if (typeof response.data === "object") {
      console.log(`元数据包含 ${Object.keys(response.data).length} 个条目`);
    }

    if (serverLastModified) {
      console.log(
        `元数据更新时间: ${new Date(serverLastModified).toLocaleString(
          "zh-CN"
        )}`
      );
    }

    return { success: true, skipped: false, reason: "下载成功" };
  } catch (error) {
    console.error(`下载 ${game} 的 ${type} 元数据失败:`, error.message);

    // 如果下载失败且文件已部分写入，删除该文件
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`已删除损坏的元数据文件: ${filePath}`);
      } catch (deleteError) {
        console.error(`删除损坏文件失败:`, deleteError.message);
      }
    }

    return { success: false, skipped: false, reason: error.message };
  }
}

/**
 * 下载指定游戏的所有元数据
 * @param {string} game - 游戏名称 (genshin, starrail, zzz)
 * @returns {Promise<{success: string[], failed: string[], skipped: string[]}>} - 下载结果统计
 */
async function downloadGameMetadata(game) {
  if (!GAME_CONFIG[game]) {
    console.error(`不支持的游戏: ${game}`);
    return { success: [], failed: [], skipped: [] };
  }

  const types = GAME_CONFIG[game].types;
  const results = {
    success: [],
    failed: [],
    skipped: [],
  };

  console.log(`开始下载 ${game} 的所有元数据...`);

  for (const type of types) {
    try {
      // 检查本地时间戳
      const localTimestamp = getMetadataTimestamp(game, type);

      // 发送 HEAD 请求检查服务器更新时间
      const gameApiKey = GAME_CONFIG[game].apiKey;
      const apiUrl = `https://api.hakush.in/${gameApiKey}/data/${type}.json`;
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
          `检查 ${game} ${type} 元数据更新时间失败，将尝试下载:`,
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
          console.log(`${game} 的 ${type} 元数据已是最新版本，跳过下载`);
          results.skipped.push(`${type}`);
          continue;
        }
      }

      const result = await downloadHakushiMetadata(game, type, true); // 强制下载，因为时间戳检查已在上面完成
      if (result.success) {
        if (result.skipped) {
          results.skipped.push(`${type}`);
        } else {
          results.success.push(`${type}`);
        }
      } else {
        results.failed.push(`${type}`);
      }
    } catch (error) {
      console.error(`处理 ${game} ${type} 元数据时发生错误:`, error.message);
      results.failed.push(`${type}`);
    }
  }

  console.log(`${game} 元数据下载完成:`);
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
 * 下载所有支持游戏的元数据
 * @returns {Promise<{[game: string]: {success: string[], failed: string[], skipped: string[]}}>} - 下载结果统计
 */
async function downloadAllMetadata() {
  const games = Object.keys(GAME_CONFIG);
  const allResults = {};

  console.log("开始检查并下载所有游戏的元数据...");

  for (const game of games) {
    console.log(`\n处理 ${game} 游戏元数据...`);
    allResults[game] = await downloadGameMetadata(game);
  }

  console.log("\n所有游戏元数据下载完成:");
  for (const [game, results] of Object.entries(allResults)) {
    console.log(
      `${game}: 成功 ${results.success.length}, 跳过 ${results.skipped.length}, 失败 ${results.failed.length}`
    );
  }

  // 元数据下载完成后，更新数据库中已有记录的物品名称
  const hasSuccessfulDownloads = Object.values(allResults).some(
    (results) => results.success.length > 0
  );
  if (hasSuccessfulDownloads) {
    try {
      console.log("\n开始更新数据库中的物品名称...");
      const {
        updateAllGachaItemNames,
      } = require("../settings/export/updateItemNames");
      const updateResult = await updateAllGachaItemNames();

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

  return allResults;
}

/**
 * 检查元数据文件是否存在
 * @param {string} game - 游戏名称
 * @param {string} type - 数据类型
 * @returns {boolean} - 文件是否存在
 */
function checkMetadataExists(game, type) {
  const fileName = `${game}_${type}_metadata.json`;
  const dictDir = path.join(process.env.NEKO_GAME_FOLDER_PATH, "dict");
  const filePath = path.join(dictDir, fileName);
  return fs.existsSync(filePath);
}

/**
 * 读取元数据文件
 * @param {string} game - 游戏名称
 * @param {string} type - 数据类型
 * @returns {Object|null} - 元数据或null
 */
function loadMetadata(game, type) {
  const fileName = `${game}_${type}_metadata.json`;
  const dictDir = path.join(process.env.NEKO_GAME_FOLDER_PATH, "dict");
  const filePath = path.join(dictDir, fileName);

  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`元数据文件不存在: ${filePath}`);
      return null;
    }

    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`读取元数据文件失败: ${filePath}`, error.message);
    return null;
  }
}

/**
 * 保存元数据下载时间戳
 * @param {string} game - 游戏名称
 * @param {string} type - 数据类型
 * @param {number|null} contentTimestamp - 内容更新时间戳（来自 last-modified 头），如果为 null 则使用当前时间
 */
function saveMetadataTimestamp(game, type, contentTimestamp = null) {
  const dictDir = path.join(process.env.NEKO_GAME_FOLDER_PATH, "dict");
  const timestampFile = path.join(dictDir, "hakushi_metadata_timestamps.json");
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
    console.warn("读取元数据时间戳文件失败，将创建新文件:", error.message);
    timestamps = {};
  }

  // 使用内容更新时间戳或当前时间
  const finalTimestamp = contentTimestamp || Date.now();
  const timestampDate = new Date(finalTimestamp);

  // 更新时间戳
  const key = `${game}_${type}`;
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
    type,
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
    console.log(`已记录 ${game} 的 ${type} 元数据${timestampType}`);
  } catch (error) {
    console.error("保存元数据时间戳文件失败:", error.message);
  }
}

/**
 * 获取元数据下载时间戳
 * @param {string} game - 游戏名称
 * @param {string} type - 数据类型
 * @returns {Object|null} - 时间戳信息或null
 */
function getMetadataTimestamp(game, type) {
  const dictDir = path.join(process.env.NEKO_GAME_FOLDER_PATH, "dict");
  const timestampFile = path.join(dictDir, "hakushi_metadata_timestamps.json");

  try {
    if (!fs.existsSync(timestampFile)) {
      return null;
    }

    const data = fs.readFileSync(timestampFile, "utf8");
    const timestamps = JSON.parse(data);
    const key = `${game}_${type}`;

    return timestamps[key] || null;
  } catch (error) {
    console.error("读取元数据时间戳文件失败:", error.message);
    return null;
  }
}

/**
 * 获取所有元数据的下载时间戳
 * @returns {Object} - 所有游戏和类型的时间戳信息
 */
function getAllMetadataTimestamps() {
  const result = {};

  for (const [game, config] of Object.entries(GAME_CONFIG)) {
    result[game] = {};
    for (const type of config.types) {
      result[game][type] = getMetadataTimestamp(game, type);
    }
  }

  return result;
}

/**
 * 自动下载所有元数据（启动时调用）
 * @returns {Promise<{[game: string]: {success: string[], failed: string[], skipped: string[]}}>} - 下载结果
 */
async function autoDownloadMetadataOnStartup() {
  console.log("启动时自动下载 Hakushi 元数据...");

  const allResults = {};
  const games = Object.keys(GAME_CONFIG);

  for (const game of games) {
    const results = {
      success: [],
      failed: [],
      skipped: [],
    };

    console.log(`正在检查 ${game} 元数据...`);

    for (const type of GAME_CONFIG[game].types) {
      try {
        const result = await downloadHakushiMetadata(game, type); // 使用默认的时间戳检查

        if (result.success) {
          if (result.skipped) {
            results.skipped.push(type);
          } else {
            results.success.push(type);
          }
        } else {
          results.failed.push(type);
        }
      } catch (error) {
        console.error(`处理 ${game} ${type} 元数据时发生错误:`, error.message);
        results.failed.push(type);
      }
    }

    allResults[game] = results;
  }

  console.log("启动时元数据检查完成:");
  for (const [game, results] of Object.entries(allResults)) {
    console.log(
      `${game}: 成功 ${results.success.length}, 跳过 ${results.skipped.length}, 失败 ${results.failed.length}`
    );
  }

  // 元数据下载完成后，更新数据库中已有记录的物品名称
  const hasSuccessfulDownloads = Object.values(allResults).some(
    (results) => results.success.length > 0
  );
  if (hasSuccessfulDownloads) {
    try {
      console.log("\n开始更新数据库中的物品名称...");
      const {
        updateAllGachaItemNames,
      } = require("../settings/export/updateItemNames");
      const updateResult = await updateAllGachaItemNames();

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

  return allResults;
}

module.exports = {
  downloadHakushiMetadata,
  downloadGameMetadata,
  downloadAllMetadata,
  checkMetadataExists,
  loadMetadata,
  saveMetadataTimestamp,
  getMetadataTimestamp,
  getAllMetadataTimestamps,
  autoDownloadMetadataOnStartup,
  GAME_CONFIG,
};
