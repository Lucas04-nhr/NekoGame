const fs = require("fs");
const path = require("path");
const { dialog } = require("electron");
const { db2 } = require("../../../app/database");
const { fetchItemId, itemCache, fetchItemName } = require("./UIGFapi");
const { checkUIGF } = require("./checkUIGF");
const { getHakushiMetadata } = require("../../metadata/metadataClient");

/**
 * 从Hakushi元数据或API获取物品ID
 * @param {string} gameType - 游戏类型
 * @param {string} itemName - 物品名称
 * @param {string} itemType - 物品类型
 * @param {string} rankType - 稀有度
 * @param {string} itemId - 物品ID (如果有)
 * @param {string} lang - 语言代码
 * @returns {Promise<string>} 物品ID
 */
async function getItemIdWithHakushi(
  gameType,
  itemName,
  itemType,
  rankType,
  itemId,
  lang = "zh-cn"
) {
  // 将UIGF语言代码转换为Hakushi语言代码
  const hakushiLang = lang.startsWith("zh") ? "CHS" : "EN";

  try {
    // 如果已有item_id，首先尝试用Hakushi验证/获取对应名称
    if (itemId) {
      // 验证ID是否存在（使用原始语言）
      const foundName = findItemNameFromAllTypes(itemId, gameType, hakushiLang);
      if (foundName) {
        // 验证成功后，强制获取中文名称
        const chineseName = findItemNameFromAllTypes(itemId, gameType, "CHS");
        console.log(
          `Hakushi元数据验证成功: ${itemName} (ID: ${itemId}) -> 标准化名称: ${
            chineseName || foundName
          }`
        );
        return { itemId, standardizedName: chineseName || foundName };
      } else {
        console.log(
          `Hakushi元数据验证失败: ${itemName} (ID: ${itemId})，未找到对应名称`
        );
      }
    }

    // 如果没有item_id或验证失败，尝试根据名称从Hakushi获取
    if (itemName) {
      const metadataItemId = findItemIdFromAllTypes(
        itemName,
        gameType,
        hakushiLang
      );
      if (metadataItemId) {
        // 强制获取中文标准化名称
        const standardizedName = findItemNameFromAllTypes(
          metadataItemId,
          gameType,
          "CHS"
        );
        console.log(
          `从Hakushi元数据获取ID: ${itemName} -> ${metadataItemId} (标准化名称: ${standardizedName})`
        );
        return { itemId: metadataItemId, standardizedName };
      } else {
        console.log(
          `从Hakushi元数据查找失败: ${itemName}，语言: ${hakushiLang}`
        );
      }
    }

    // 回退到API
    console.log(`回退到API获取ID: ${itemName}`);
    return await fetchItemId(itemName, "chs", gameType);
  } catch (error) {
    console.warn(`获取物品ID失败: ${error.message}，回退到API`);
    return await fetchItemId(itemName, "chs", gameType);
  }
}

/**
 * 从所有类型的Hakushi元数据中查找物品名称
 * @param {string} itemId - 物品ID
 * @param {string} gameType - 游戏类型
 * @param {string} lang - 语言代码
 * @returns {string|null} 物品名称
 */
function findItemNameFromAllTypes(itemId, gameType, lang = "CHS") {
  try {
    // 语言代码映射：将标准化的语言代码映射到元数据中的实际字段名
    const langMap = {
      CHS: "cn", // 中文简体
      EN: "en", // 英文
      JP: "jp", // 日文
      KR: "kr", // 韩文
    };

    const actualLangKey = langMap[lang] || lang.toLowerCase();

    // 根据游戏类型确定要查找的元数据类型
    const metadataTypes = {
      genshin: ["character", "weapon"],
      starrail: ["character", "lightcone"],
      zzz: ["character", "weapon", "bangboo"],
    };

    const typesToCheck = metadataTypes[gameType] || [];

    for (const type of typesToCheck) {
      try {
        const metadata = getHakushiMetadata(gameType, type);
        if (metadata && metadata[itemId]) {
          const nameData = metadata[itemId][actualLangKey];
          if (nameData) {
            return nameData;
          }
        }
      } catch (typeError) {
        // 继续检查下一个类型
        continue;
      }
    }

    return null;
  } catch (error) {
    console.warn(`查找物品名称失败: ${error.message}`);
    return null;
  }
}

/**
 * 从所有类型的Hakushi元数据中查找物品ID
 * @param {string} itemName - 物品名称
 * @param {string} gameType - 游戏类型
 * @param {string} lang - 语言代码
 * @returns {string|null} 物品ID
 */
function findItemIdFromAllTypes(itemName, gameType, lang = "CHS") {
  try {
    // 语言代码映射：将标准化的语言代码映射到元数据中的实际字段名
    const langMap = {
      CHS: "cn", // 中文简体
      EN: "en", // 英文
      JP: "jp", // 日文
      KR: "kr", // 韩文
    };

    const actualLangKey = langMap[lang] || lang.toLowerCase();

    const metadataTypes = {
      genshin: ["character", "weapon"],
      starrail: ["character", "lightcone"],
      zzz: ["character", "weapon", "bangboo"],
    };

    const typesToCheck = metadataTypes[gameType] || [];

    for (const type of typesToCheck) {
      try {
        const metadata = getHakushiMetadata(gameType, type);
        if (metadata) {
          for (const [id, data] of Object.entries(metadata)) {
            if (data[actualLangKey] === itemName) {
              return id;
            }
          }
        }
      } catch (typeError) {
        // 继续检查下一个类型
        continue;
      }
    }

    return null;
  } catch (error) {
    console.warn(`查找物品ID失败: ${error.message}`);
    return null;
  }
}

/**
 * 检测UIGF v4文件中包含的游戏数据
 * @param {string} filePath - UIGF文件路径
 * @returns {object} 检测结果
 */
async function detectUIGFGames(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    const uigfData = JSON.parse(data);

    // 验证UIGF v4格式
    if (!uigfData.info || uigfData.info.version !== "v4.0") {
      throw new Error("不是有效的UIGF v4格式文件");
    }

    const detectedGames = [];
    const gameMapping = {
      hk4e: { name: "原神", key: "hk4e" },
      hkrpg: { name: "崩坏：星穹铁道", key: "hkrpg" },
      nap: { name: "绝区零", key: "nap" },
    };

    // 检查每个游戏的数据
    for (const [gameKey, gameInfo] of Object.entries(gameMapping)) {
      if (
        uigfData[gameKey] &&
        Array.isArray(uigfData[gameKey]) &&
        uigfData[gameKey].length > 0
      ) {
        const gameData = uigfData[gameKey];
        const uidData = [];

        // 计算总记录数和每个UID的记录数
        let totalRecords = 0;
        gameData.forEach((playerData) => {
          if (playerData.uid) {
            const recordCount =
              playerData.list && Array.isArray(playerData.list)
                ? playerData.list.length
                : 0;
            uidData.push({
              uid: playerData.uid,
              recordCount: recordCount,
            });
            totalRecords += recordCount;
          }
        });

        if (totalRecords > 0) {
          detectedGames.push({
            key: gameInfo.key,
            name: gameInfo.name,
            uids: uidData.map((u) => u.uid), // 保持兼容性
            uidData: uidData, // 新增：详细的UID数据
            recordCount: totalRecords,
          });
        }
      }
    }

    if (detectedGames.length === 0) {
      throw new Error("文件中未找到有效的游戏数据");
    }

    return {
      success: true,
      detectedGames: detectedGames,
      filePath: filePath,
    };
  } catch (error) {
    console.error("检测UIGF文件失败:", error);
    return {
      success: false,
      message: `检测文件失败: ${error.message}`,
    };
  }
}

/**
 * 导入UIGF v4联合数据
 * @param {object} options - 导入选项 {filePath: string, selectedUIDs?: object}
 * @returns {object} 导入结果
 */
async function importCombinedUIGFData(options) {
  let filePath, selectedUIDs;

  // 兼容旧版本的字符串参数
  if (typeof options === "string") {
    filePath = options;
    selectedUIDs = null;
  } else {
    filePath = options.filePath;
    selectedUIDs = options.selectedUIDs;
  }

  try {
    const data = fs.readFileSync(filePath, "utf8");
    const uigfData = JSON.parse(data);

    // 验证UIGF v4格式
    if (!uigfData.info || uigfData.info.version !== "v4.0") {
      throw new Error("不是有效的UIGF v4格式文件");
    }

    const importResults = [];

    // 导入原神数据
    if (
      uigfData.hk4e &&
      Array.isArray(uigfData.hk4e) &&
      uigfData.hk4e.length > 0
    ) {
      try {
        // 过滤选中的UID数据
        let filteredData = uigfData.hk4e;
        if (selectedUIDs && selectedUIDs.hk4e) {
          filteredData = uigfData.hk4e.filter((playerData) =>
            selectedUIDs.hk4e.includes(playerData.uid)
          );
        }

        if (filteredData.length > 0) {
          const genshinResult = await importGenshinData(filteredData);
          importResults.push({
            game: "原神",
            success: genshinResult.success,
            message: genshinResult.message,
            count: genshinResult.count || 0,
          });
        }
      } catch (error) {
        importResults.push({
          game: "原神",
          success: false,
          message: `导入失败: ${error.message}`,
          count: 0,
        });
      }
    }

    // 导入崩铁数据
    if (
      uigfData.hkrpg &&
      Array.isArray(uigfData.hkrpg) &&
      uigfData.hkrpg.length > 0
    ) {
      try {
        // 过滤选中的UID数据
        let filteredData = uigfData.hkrpg;
        if (selectedUIDs && selectedUIDs.hkrpg) {
          filteredData = uigfData.hkrpg.filter((playerData) =>
            selectedUIDs.hkrpg.includes(playerData.uid)
          );
        }

        if (filteredData.length > 0) {
          const hsrResult = await importStarRailData(filteredData);
          importResults.push({
            game: "崩坏：星穹铁道",
            success: hsrResult.success,
            message: hsrResult.message,
            count: hsrResult.count || 0,
          });
        }
      } catch (error) {
        importResults.push({
          game: "崩坏：星穹铁道",
          success: false,
          message: `导入失败: ${error.message}`,
          count: 0,
        });
      }
    }

    // 导入绝区零数据
    if (
      uigfData.nap &&
      Array.isArray(uigfData.nap) &&
      uigfData.nap.length > 0
    ) {
      try {
        // 过滤选中的UID数据
        let filteredData = uigfData.nap;
        if (selectedUIDs && selectedUIDs.nap) {
          filteredData = uigfData.nap.filter((playerData) =>
            selectedUIDs.nap.includes(playerData.uid)
          );
        }

        if (filteredData.length > 0) {
          const zzzResult = await importZzzData(filteredData);
          importResults.push({
            game: "绝区零",
            success: zzzResult.success,
            message: zzzResult.message,
            count: zzzResult.count || 0,
          });
        }
      } catch (error) {
        importResults.push({
          game: "绝区零",
          success: false,
          message: `导入失败: ${error.message}`,
          count: 0,
        });
      }
    }

    // 生成总结消息
    const successCount = importResults.filter((r) => r.success).length;
    const totalCount = importResults.reduce((sum, r) => sum + r.count, 0);

    let message = `联合导入完成！\n`;
    message += `成功导入 ${successCount}/${importResults.length} 个游戏的数据\n`;
    message += `总计导入 ${totalCount} 条记录\n\n`;

    importResults.forEach((result) => {
      const status = result.success ? "✓" : "✗";
      message += `${status} ${result.game}: ${result.count} 条记录\n`;
    });

    return {
      success: successCount > 0,
      message: message.trim(),
      results: importResults,
    };
  } catch (error) {
    console.error("联合导入失败:", error);
    return {
      success: false,
      message: `联合导入失败: ${error.message}`,
    };
  }
}

/**
 * 导入原神数据
 * @param {array} genshinData - 原神数据数组
 * @returns {object} 导入结果
 */
async function importGenshinData(genshinData) {
  let totalImported = 0;
  const processed = new Set();

  for (const playerData of genshinData) {
    const { uid, list, lang = "zh-cn" } = playerData;
    if (!list || !Array.isArray(list)) continue;

    for (const record of list) {
      try {
        const {
          id,
          gacha_id,
          gacha_type,
          item_id,
          count,
          time,
          name,
          item_type,
          rank_type,
        } = record;

        // 检查必要字段
        checkUIGF(id, uid, gacha_type, time, rank_type, name, record);

        // 防止重复导入
        const recordKey = `${uid}-${id}`;
        if (processed.has(recordKey)) continue;
        processed.add(recordKey);

        // 获取物品ID和标准化名称 (优先使用Hakushi元数据)
        const itemResult = await getItemIdWithHakushi(
          "genshin",
          name,
          item_type,
          rank_type,
          item_id,
          lang
        );

        // 使用标准化名称或原始名称
        const finalName =
          itemResult && itemResult.standardizedName
            ? itemResult.standardizedName
            : name;
        const finalItemId =
          itemResult && itemResult.itemId ? itemResult.itemId : itemResult;

        // 插入数据库
        await new Promise((resolve, reject) => {
          db2.run(
            `INSERT OR REPLACE INTO genshin_gacha (
              uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type, id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uid,
              gacha_id,
              gacha_type,
              finalItemId,
              count || "1",
              time,
              finalName,
              lang,
              item_type,
              rank_type,
              id,
            ],
            function (err) {
              if (err) {
                console.error("插入原神数据失败:", err);
                reject(err);
              } else {
                resolve();
              }
            }
          );
        });

        totalImported++;
      } catch (error) {
        console.error("处理原神记录失败:", error);
        continue;
      }
    }
  }

  return {
    success: true,
    message: `成功导入 ${totalImported} 条原神记录`,
    count: totalImported,
  };
}

/**
 * 导入崩铁数据
 * @param {array} hsrData - 崩铁数据数组
 * @returns {object} 导入结果
 */
async function importStarRailData(hsrData) {
  let totalImported = 0;
  const processed = new Set();

  for (const playerData of hsrData) {
    const { uid, list, lang = "zh-cn" } = playerData;
    if (!list || !Array.isArray(list)) continue;

    for (const record of list) {
      try {
        const {
          id,
          gacha_id,
          gacha_type,
          item_id,
          count,
          time,
          name,
          item_type,
          rank_type,
        } = record;

        // 检查必要字段
        checkUIGF(id, uid, gacha_type, time, rank_type, name, record);

        // 防止重复导入
        const recordKey = `${uid}-${id}`;
        if (processed.has(recordKey)) continue;
        processed.add(recordKey);

        // 获取物品ID和标准化名称 (优先使用Hakushi元数据)
        const itemResult = await getItemIdWithHakushi(
          "starrail",
          name,
          item_type,
          rank_type,
          item_id,
          lang
        );

        // 使用标准化名称或原始名称
        const finalName =
          itemResult && itemResult.standardizedName
            ? itemResult.standardizedName
            : name;
        const finalItemId =
          itemResult && itemResult.itemId ? itemResult.itemId : itemResult;

        // 插入数据库
        await new Promise((resolve, reject) => {
          db2.run(
            `INSERT OR REPLACE INTO starrail_gacha (
              uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type, id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uid,
              gacha_id,
              gacha_type,
              finalItemId,
              count || "1",
              time,
              finalName,
              lang,
              item_type,
              rank_type,
              id,
            ],
            function (err) {
              if (err) {
                console.error("插入崩铁数据失败:", err);
                reject(err);
              } else {
                resolve();
              }
            }
          );
        });

        totalImported++;
      } catch (error) {
        console.error("处理崩铁记录失败:", error);
        continue;
      }
    }
  }

  return {
    success: true,
    message: `成功导入 ${totalImported} 条崩铁记录`,
    count: totalImported,
  };
}

/**
 * ZZZ星级验证函数
 * 验证星级值的有效性，如果遇到5级物品则报错
 * @param {number|string} rankType - 原始星级值
 * @returns {number} - 验证后的星级值
 */
function convertZzzRankType(rankType) {
  const rank = parseInt(rankType);

  // 检查是否为5级物品，如果是则报错
  if (rank === 5) {
    throw new Error(`原始文件错误：检测到5级物品，ZZZ游戏中不应该存在5级物品`);
  }

  // 验证有效的星级范围 (2-4)
  if (rank >= 2 && rank <= 4) {
    return rank;
  }

  // 如果是其他值，记录警告但保持原值
  console.warn(`[ZZZ星级验证] 未知的rank_type值: ${rank}，保持原值`);
  return rank;
}

/**
 * 导入绝区零数据
 * @param {array} zzzData - 绝区零数据数组
 * @returns {object} 导入结果
 */
async function importZzzData(zzzData) {
  let totalImported = 0;
  const processed = new Set();

  for (const playerData of zzzData) {
    const { uid, list, lang = "zh-cn" } = playerData;
    if (!list || !Array.isArray(list)) continue;

    for (const record of list) {
      try {
        const {
          id,
          gacha_id,
          gacha_type,
          item_id,
          count,
          time,
          name,
          item_type,
          rank_type,
        } = record;

        // 检查必要字段
        checkUIGF(id, uid, gacha_type, time, rank_type, name, record);

        // 防止重复导入
        const recordKey = `${uid}-${id}`;
        if (processed.has(recordKey)) continue;
        processed.add(recordKey);

        // 转换ZZZ星级
        const convertedRankType = convertZzzRankType(rank_type);

        // 获取物品ID和标准化名称 (优先使用Hakushi元数据)
        const itemResult = await getItemIdWithHakushi(
          "zzz",
          name,
          item_type,
          convertedRankType,
          item_id,
          lang
        );

        // 使用标准化名称或原始名称
        const finalName =
          itemResult && itemResult.standardizedName
            ? itemResult.standardizedName
            : name;
        const finalItemId =
          itemResult && itemResult.itemId ? itemResult.itemId : itemResult;

        // 插入数据库
        await new Promise((resolve, reject) => {
          db2.run(
            `INSERT OR REPLACE INTO zzz_gacha (
              uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type, id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uid,
              gacha_id,
              gacha_type,
              finalItemId,
              count || "1",
              time,
              finalName,
              lang,
              item_type,
              convertedRankType,
              id,
            ],
            function (err) {
              if (err) {
                console.error("插入绝区零数据失败:", err);
                reject(err);
              } else {
                resolve();
              }
            }
          );
        });

        totalImported++;
      } catch (error) {
        console.error("处理绝区零记录失败:", error);
        continue;
      }
    }
  }

  return {
    success: true,
    message: `成功导入 ${totalImported} 条绝区零记录`,
    count: totalImported,
  };
}

module.exports = {
  detectUIGFGames,
  importCombinedUIGFData,
};
