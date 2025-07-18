const fs = require("fs");
const path = require("path");
const { getHakushiMetadata } = require("../../metadata/metadataClient");

/**
 * 游戏配置信息
 */
const GAME_CONFIG = {
  genshin: {
    name: "原神",
    types: ["character", "weapon"],
    languages: ["CHS", "EN", "JP", "KR"],
  },
  starrail: {
    name: "崩坏：星穹铁道",
    types: ["character", "lightcone"],
    languages: ["CHS", "EN", "JP", "KR"],
  },
  zzz: {
    name: "绝区零",
    types: ["character", "weapon", "bangboo"],
    languages: ["CHS", "EN", "JP", "KR"],
  },
};

/**
 * 获取App数据目录
 * @returns {string} App数据目录路径
 */
function getAppDataDir() {
  const appDataPath = process.env.NEKO_GAME_FOLDER_PATH;
  if (!appDataPath) {
    throw new Error("环境变量 NEKO_GAME_FOLDER_PATH 未设置");
  }
  return appDataPath;
}

/**
 * 确保目录存在
 * @param {string} dirPath - 目录路径
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`创建目录: ${dirPath}`);
  }
}

/**
 * 为单个游戏生成字典文件
 * @param {string} game - 游戏名称 (genshin, starrail, zzz)
 * @param {string} lang - 语言代码 (CHS, EN, JP, KR)
 * @returns {Object} 生成结果
 */
function generateGameDict(game, lang = "CHS") {
  try {
    const gameConfig = GAME_CONFIG[game];
    if (!gameConfig) {
      throw new Error(`不支持的游戏: ${game}`);
    }

    if (!gameConfig.languages.includes(lang)) {
      throw new Error(`游戏 ${game} 不支持语言: ${lang}`);
    }

    console.log(`正在为 ${gameConfig.name} 生成 ${lang} 字典...`);

    const dict = {};
    let totalItems = 0;

    // 遍历该游戏的所有物品类型
    for (const type of gameConfig.types) {
      try {
        const metadata = getHakushiMetadata(game, type);
        if (!metadata) {
          console.warn(`未找到 ${game} 的 ${type} 元数据，跳过`);
          continue;
        }

        let typeCount = 0;
        // 遍历元数据中的所有物品
        for (const [itemId, itemData] of Object.entries(metadata)) {
          if (itemData && itemData[lang]) {
            dict[itemId] = itemData[lang];
            typeCount++;
            totalItems++;
          }
        }

        console.log(`  - ${type}: ${typeCount} 个物品`);
      } catch (typeError) {
        console.warn(
          `处理 ${game} 的 ${type} 类型时出错: ${typeError.message}`
        );
      }
    }

    // 保存字典文件
    const appDataDir = getAppDataDir();
    const dictDir = path.join(appDataDir, "game_dicts");
    ensureDirectoryExists(dictDir);

    const dictFileName = `${game}_${lang.toLowerCase()}_dict.json`;
    const dictFilePath = path.join(dictDir, dictFileName);

    fs.writeFileSync(dictFilePath, JSON.stringify(dict, null, 2), "utf8");

    const result = {
      success: true,
      game,
      language: lang,
      itemCount: totalItems,
      filePath: dictFilePath,
      fileName: dictFileName,
      message: `${gameConfig.name} ${lang} 字典生成成功，包含 ${totalItems} 个物品`,
    };

    console.log(`✅ ${result.message}`);
    return result;
  } catch (error) {
    const result = {
      success: false,
      game,
      language: lang,
      error: error.message,
      message: `生成 ${game} ${lang} 字典失败: ${error.message}`,
    };

    console.error(`❌ ${result.message}`);
    return result;
  }
}

/**
 * 为所有游戏生成字典文件
 * @param {Array<string>} languages - 要生成的语言列表，默认为 ["CHS"]
 * @returns {Object} 生成结果汇总
 */
function generateAllGameDicts(languages = ["CHS"]) {
  console.log("=== 开始生成游戏字典文件 ===");

  const results = {
    success: [],
    failed: [],
    total: {
      games: 0,
      items: 0,
      files: 0,
    },
  };

  const games = Object.keys(GAME_CONFIG);

  for (const game of games) {
    for (const lang of languages) {
      try {
        const result = generateGameDict(game, lang);

        if (result.success) {
          results.success.push(result);
          results.total.items += result.itemCount;
          results.total.files++;
        } else {
          results.failed.push(result);
        }

        results.total.games++;
      } catch (error) {
        const failedResult = {
          success: false,
          game,
          language: lang,
          error: error.message,
          message: `生成 ${game} ${lang} 字典时发生异常: ${error.message}`,
        };

        results.failed.push(failedResult);
        results.total.games++;
        console.error(`❌ ${failedResult.message}`);
      }
    }
  }

  // 输出汇总信息
  console.log("\n=== 字典生成完成 ===");
  console.log(`总计处理: ${results.total.games} 个游戏/语言组合`);
  console.log(`成功生成: ${results.success.length} 个字典文件`);
  console.log(`生成失败: ${results.failed.length} 个`);
  console.log(`物品总数: ${results.total.items} 个`);

  if (results.failed.length > 0) {
    console.log("\n失败详情:");
    results.failed.forEach((result) => {
      console.log(`  - ${result.game} (${result.language}): ${result.error}`);
    });
  }

  return results;
}

/**
 * 读取游戏字典文件
 * @param {string} game - 游戏名称
 * @param {string} lang - 语言代码
 * @returns {Object|null} 字典数据或null
 */
function loadGameDict(game, lang = "CHS") {
  try {
    const appDataDir = getAppDataDir();
    const dictDir = path.join(appDataDir, "game_dicts");
    const dictFileName = `${game}_${lang.toLowerCase()}_dict.json`;
    const dictFilePath = path.join(dictDir, dictFileName);

    if (!fs.existsSync(dictFilePath)) {
      console.warn(`字典文件不存在: ${dictFilePath}`);
      return null;
    }

    const dictContent = fs.readFileSync(dictFilePath, "utf8");
    const dict = JSON.parse(dictContent);

    console.log(
      `加载字典: ${game} ${lang} (${Object.keys(dict).length} 个物品)`
    );
    return dict;
  } catch (error) {
    console.error(`加载字典失败 ${game} ${lang}: ${error.message}`);
    return null;
  }
}

/**
 * 检查游戏字典文件是否存在
 * @param {string} game - 游戏名称
 * @param {string} lang - 语言代码
 * @returns {boolean} 文件是否存在
 */
function checkGameDictExists(game, lang = "CHS") {
  try {
    const appDataDir = getAppDataDir();
    const dictDir = path.join(appDataDir, "game_dicts");
    const dictFileName = `${game}_${lang.toLowerCase()}_dict.json`;
    const dictFilePath = path.join(dictDir, dictFileName);

    return fs.existsSync(dictFilePath);
  } catch (error) {
    console.error(`检查字典文件时出错: ${error.message}`);
    return false;
  }
}

/**
 * 获取所有字典文件的状态信息
 * @param {Array<string>} languages - 要检查的语言列表
 * @returns {Object} 字典状态信息
 */
function getGameDictStatus(languages = ["CHS"]) {
  const status = {};
  const games = Object.keys(GAME_CONFIG);

  for (const game of games) {
    status[game] = {};

    for (const lang of languages) {
      const exists = checkGameDictExists(game, lang);
      const gameConfig = GAME_CONFIG[game];

      if (exists) {
        try {
          const dict = loadGameDict(game, lang);
          status[game][lang] = {
            exists: true,
            itemCount: dict ? Object.keys(dict).length : 0,
            valid: dict !== null,
            gameName: gameConfig.name,
          };
        } catch (error) {
          status[game][lang] = {
            exists: true,
            itemCount: 0,
            valid: false,
            error: error.message,
            gameName: gameConfig.name,
          };
        }
      } else {
        status[game][lang] = {
          exists: false,
          itemCount: 0,
          valid: false,
          gameName: gameConfig.name,
        };
      }
    }
  }

  return status;
}

/**
 * 清理所有字典文件
 * @returns {Object} 清理结果
 */
function cleanAllGameDicts() {
  try {
    const appDataDir = getAppDataDir();
    const dictDir = path.join(appDataDir, "game_dicts");

    if (!fs.existsSync(dictDir)) {
      return {
        success: true,
        message: "字典目录不存在，无需清理",
        deletedFiles: 0,
      };
    }

    const files = fs.readdirSync(dictDir);
    const dictFiles = files.filter((file) => file.endsWith("_dict.json"));

    let deletedCount = 0;
    for (const file of dictFiles) {
      const filePath = path.join(dictDir, file);
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`删除字典文件: ${file}`);
    }

    return {
      success: true,
      message: `成功清理 ${deletedCount} 个字典文件`,
      deletedFiles: deletedCount,
    };
  } catch (error) {
    return {
      success: false,
      message: `清理字典文件失败: ${error.message}`,
      error: error.message,
      deletedFiles: 0,
    };
  }
}

module.exports = {
  generateGameDict,
  generateAllGameDicts,
  loadGameDict,
  checkGameDictExists,
  getGameDictStatus,
  cleanAllGameDicts,
  GAME_CONFIG,
};
