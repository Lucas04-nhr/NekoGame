const hakushiClient = require("./hakushiClient");

/**
 * 统一的元数据管理客户端
 * 基于 Hakushi API 的元数据下载和管理
 */

/**
 * 启动时自动下载所有元数据
 * @returns {Promise<Object>} - 下载结果
 */
async function autoDownloadAllOnStartup() {
  console.log("=== 启动时自动更新 Hakushi 元数据 ===");

  try {
    // 下载 Hakushi 元数据
    console.log("\n检查 Hakushi 元数据更新...");
    const result = await hakushiClient.autoDownloadMetadataOnStartup();
    console.log("\n=== Hakushi 元数据更新完成 ===");
    return result;
  } catch (error) {
    console.error("启动时元数据更新发生错误:", error.message);
    throw error;
  }
}

/**
 * 手动下载所有元数据
 * @returns {Promise<Object>} - 下载结果
 */
async function downloadAllMetadata() {
  console.log("=== 手动下载 Hakushi 元数据 ===");

  try {
    // 下载 Hakushi 元数据
    console.log("\n下载 Hakushi 元数据...");
    const result = await hakushiClient.downloadAllMetadata();
    console.log("\n=== Hakushi 元数据下载完成 ===");
    return result;
  } catch (error) {
    console.error("手动下载元数据发生错误:", error.message);
    throw error;
  }
}

/**
 * 获取指定游戏和类型的 Hakushi 元数据
 * @param {string} game - 游戏名称 (genshin, starrail, zzz)
 * @param {string} type - 数据类型 (character, weapon, lightcone, bangboo)
 * @returns {Object|null} - 元数据或null
 */
function getHakushiMetadata(game, type) {
  return hakushiClient.loadMetadata(game, type);
}

/**
 * 检查指定游戏和类型的 Hakushi 元数据是否存在
 * @param {string} game - 游戏名称
 * @param {string} type - 数据类型
 * @returns {boolean} - 文件是否存在
 */
function hasHakushiMetadata(game, type) {
  return hakushiClient.checkMetadataExists(game, type);
}

/**
 * 获取所有时间戳信息
 * @returns {Object} - 包含 Hakushi 时间戳的对象
 */
function getAllTimestamps() {
  try {
    return hakushiClient.getAllMetadataTimestamps();
  } catch (error) {
    console.error("获取时间戳信息失败:", error.message);
    return {};
  }
}

/**
 * 获取支持的游戏配置
 * @returns {Object} - 游戏配置信息
 */
function getSupportedGames() {
  return {
    hakushi: hakushiClient.GAME_CONFIG,
  };
}

module.exports = {
  // 启动和批量操作
  autoDownloadAllOnStartup,
  downloadAllMetadata,

  // Hakushi 元数据相关
  getHakushiMetadata,
  hasHakushiMetadata,

  // 时间戳和配置
  getAllTimestamps,
  getSupportedGames,

  // 原始客户端访问（高级用法）
  hakushiClient,
};
