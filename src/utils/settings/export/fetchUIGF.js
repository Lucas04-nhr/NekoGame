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
  const filePath = path.join(dataDir, fileName);

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

    // 确保数据目录存在
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 写入文件
    fs.writeFileSync(filePath, JSON.stringify(response.data, null, 2), "utf8");

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
  const filePath = path.join(process.env.NEKO_GAME_FOLDER_PATH, fileName);
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
  const filePath = path.join(process.env.NEKO_GAME_FOLDER_PATH, fileName);

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

module.exports = {
  downloadUIGFDict,
  downloadAllUIGFDicts,
  checkDictExists,
  loadDict,
};
