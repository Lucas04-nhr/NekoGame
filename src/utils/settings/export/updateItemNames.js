const { loadMetadata } = require("../../metadata/hakushiClient");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// 获取数据库连接
const nekoGameFolderPath = process.env.NEKO_GAME_FOLDER_PATH;
const db2 = new sqlite3.Database(
  path.join(nekoGameFolderPath, "gacha_data.db"),
  (err) => {
    if (err) {
      console.error("Database connection failed:", err.message);
    }
  }
);

// 游戏数据类型映射 - 定义每个游戏需要加载哪些类型的元数据
const GAME_METADATA_TYPES = {
  genshin: ["character", "weapon"],
  starrail: ["character", "lightcone"],
  zzz: ["character", "weapon", "bangboo"],
};

// 游戏语言字段映射 - 不同游戏使用不同的中文字段名
const GAME_LANGUAGE_FIELDS = {
  genshin: ["CHS", "EN", "JP", "KR"],
  starrail: ["cn", "en", "jp", "kr"],
  zzz: ["CHS", "EN", "JA", "KO"],
};

/**
 * 为指定游戏构建完整的物品名称字典
 * @param {string} game - 游戏名称 (genshin, starrail, zzz)
 * @param {string} preferredLang - 首选语言 (默认为游戏的第一个中文字段)
 * @returns {Object|null} - 物品ID到名称的映射对象
 */
function buildItemNameDict(game, preferredLang = null) {
  const types = GAME_METADATA_TYPES[game];
  const langFields = GAME_LANGUAGE_FIELDS[game];

  if (!types || !langFields) {
    console.warn(`不支持的游戏: ${game}`);
    return null;
  }

  // 如果没有指定首选语言，使用游戏的第一个语言字段（通常是中文）
  const primaryLang = preferredLang || langFields[0];

  const itemDict = {};
  let totalItems = 0;

  // 加载所有类型的元数据并合并
  for (const type of types) {
    const metadata = loadMetadata(game, type);
    if (!metadata) {
      console.warn(`无法加载 ${game} 的 ${type} 元数据`);
      continue;
    }

    // 遍历元数据，提取物品ID和名称
    Object.entries(metadata).forEach(([itemId, itemData]) => {
      if (itemData && itemData[primaryLang]) {
        itemDict[itemId] = itemData[primaryLang];
        totalItems++;
      } else {
        // 如果首选语言不存在，按优先级尝试回退到其他语言
        let foundName = null;
        for (const fallbackLang of langFields) {
          if (itemData[fallbackLang]) {
            foundName = itemData[fallbackLang];
            break;
          }
        }

        if (foundName) {
          itemDict[itemId] = foundName;
          totalItems++;
        } else {
          console.warn(
            `物品 ${itemId} 缺少所有支持的语言字段: ${langFields.join(", ")}`
          );
        }
      }
    });

    console.log(
      `已加载 ${game} 的 ${type} 元数据: ${Object.keys(metadata).length} 个条目`
    );
  }

  if (totalItems > 0) {
    console.log(
      `${game} 完整字典构建完成，包含 ${totalItems} 个物品，使用语言字段: ${primaryLang}`
    );
    return itemDict;
  } else {
    console.warn(`${game} 未能构建有效的物品字典`);
    return null;
  }
}

/**
 * 根据item_id和Hakushi元数据更新记录的name字段
 * @param {string} tableName - 表名 (genshin_gacha, starrail_gacha, zzz_gacha)
 * @param {string} game - 游戏名称 (genshin, starrail, zzz)
 * @param {string} preferredLang - 首选语言字段 (可选，默认使用游戏的首选中文字段)
 * @returns {Promise<{updated: number, errors: number}>} 更新结果
 */
async function updateItemNamesInTable(tableName, game, preferredLang = null) {
  return new Promise((resolve, reject) => {
    console.log(`开始更新 ${tableName} 表中的物品名称...`);

    // 构建物品字典
    const dict = buildItemNameDict(game, preferredLang);
    if (!dict) {
      console.warn(`无法为 ${game} 构建物品字典，跳过更新`);
      resolve({ updated: 0, errors: 0 });
      return;
    }

    console.log(
      `已构建 ${game} 物品字典，包含 ${Object.keys(dict).length} 个条目`
    );

    let updated = 0;
    let errors = 0;

    // 查询所有有item_id但name可能需要更新的记录
    const selectQuery = `SELECT id, item_id, name FROM ${tableName} WHERE item_id IS NOT NULL AND item_id != ''`;

    db2.all(selectQuery, [], (err, rows) => {
      if (err) {
        console.error(`查询 ${tableName} 失败:`, err.message);
        reject(err);
        return;
      }

      if (rows.length === 0) {
        console.log(`${tableName} 中没有需要更新的记录`);
        resolve({ updated: 0, errors: 0 });
        return;
      }

      console.log(`${tableName} 中找到 ${rows.length} 条记录需要检查`);

      // 逐条更新记录
      let processedCount = 0;

      rows.forEach((row) => {
        const { id, item_id, name: currentName } = row;
        const dictName = dict[item_id];

        if (dictName && dictName !== currentName) {
          // 更新name字段
          const updateQuery = `UPDATE ${tableName} SET name = ? WHERE id = ?`;

          db2.run(updateQuery, [dictName, id], function (err) {
            processedCount++;

            if (err) {
              console.error(`更新记录 ${id} 失败:`, err.message);
              errors++;
            } else {
              updated++;
              console.log(`更新记录 ${id}: "${currentName}" -> "${dictName}"`);
            }

            // 检查是否所有记录都已处理完成
            if (processedCount === rows.length) {
              console.log(
                `${tableName} 更新完成: 成功 ${updated} 条，错误 ${errors} 条`
              );
              resolve({ updated, errors });
            }
          });
        } else {
          // 不需要更新
          processedCount++;
          if (processedCount === rows.length) {
            console.log(
              `${tableName} 更新完成: 成功 ${updated} 条，错误 ${errors} 条`
            );
            resolve({ updated, errors });
          }
        }
      });
    });
  });
}

/**
 * 更新所有游戏的抽卡记录物品名称
 * @param {string} preferredLang - 首选语言字段 (可选，默认使用各游戏的首选中文字段)
 * @returns {Promise<Object>} 总体更新结果
 */
async function updateAllGachaItemNames(preferredLang = null) {
  console.log("开始更新所有抽卡记录的物品名称...");

  const gameConfigs = [
    { table: "genshin_gacha", game: "genshin" },
    { table: "starrail_gacha", game: "starrail" },
    { table: "zzz_gacha", game: "zzz" },
  ];

  const results = {
    genshin: { updated: 0, errors: 0 },
    starrail: { updated: 0, errors: 0 },
    zzz: { updated: 0, errors: 0 },
  };

  let totalUpdated = 0;
  let totalErrors = 0;

  for (const config of gameConfigs) {
    try {
      const result = await updateItemNamesInTable(
        config.table,
        config.game,
        preferredLang
      );
      results[config.game] = result;
      totalUpdated += result.updated;
      totalErrors += result.errors;
    } catch (error) {
      console.error(`更新 ${config.game} 失败:`, error.message);
      results[config.game] = { updated: 0, errors: 1 };
      totalErrors++;
    }
  }

  console.log("所有抽卡记录物品名称更新完成:");
  console.log(`总计更新: ${totalUpdated} 条记录`);
  if (totalErrors > 0) {
    console.log(`总计错误: ${totalErrors} 条`);
  }

  // 显示详细结果
  Object.entries(results).forEach(([game, result]) => {
    if (result.updated > 0 || result.errors > 0) {
      console.log(
        `${game}: 更新 ${result.updated} 条，错误 ${result.errors} 条`
      );
    }
  });

  return {
    total: { updated: totalUpdated, errors: totalErrors },
    details: results,
  };
}

/**
 * 检查是否有记录需要更新物品名称
 * @param {string} preferredLang - 首选语言字段 (可选，默认使用各游戏的首选中文字段)
 * @returns {Promise<Object>} 检查结果
 */
async function checkItemNamesNeedUpdate(preferredLang = null) {
  const gameConfigs = [
    { table: "genshin_gacha", game: "genshin" },
    { table: "starrail_gacha", game: "starrail" },
    { table: "zzz_gacha", game: "zzz" },
  ];

  const results = {};

  for (const config of gameConfigs) {
    try {
      const dict = buildItemNameDict(config.game, preferredLang);
      if (!dict) {
        results[config.game] = {
          needUpdate: 0,
          total: 0,
          dictAvailable: false,
          message: "元数据不可用",
        };
        continue;
      }

      const checkResult = await new Promise((resolve, reject) => {
        // 查询所有有item_id的记录
        const selectQuery = `SELECT item_id, name FROM ${config.table} WHERE item_id IS NOT NULL AND item_id != ''`;

        db2.all(selectQuery, [], (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          let needUpdate = 0;
          let total = rows.length;

          // 检查每条记录是否需要更新
          rows.forEach((row) => {
            const dictName = dict[row.item_id];
            if (dictName && dictName !== row.name) {
              needUpdate++;
            }
          });

          resolve({
            total,
            needUpdate,
            dictAvailable: true,
            dictSize: Object.keys(dict).length,
          });
        });
      });

      results[config.game] = checkResult;
    } catch (error) {
      console.error(`检查 ${config.game} 失败:`, error.message);
      results[config.game] = {
        needUpdate: 0,
        total: 0,
        dictAvailable: false,
        error: error.message,
      };
    }
  }

  return results;
}

module.exports = {
  buildItemNameDict,
  updateItemNamesInTable,
  updateAllGachaItemNames,
  checkItemNamesNeedUpdate,
  updateAllGachaItemNamesWithGameDict,
  checkItemNamesNeedUpdateWithGameDict,
  GAME_METADATA_TYPES,
  GAME_LANGUAGE_FIELDS,
};

/**
 * 使用游戏字典文件更新单个游戏的抽卡数据物品名称
 * @param {string} game - 游戏名称
 * @param {string} lang - 语言代码
 * @returns {Promise<Object>} 更新结果
 */
async function updateGachaItemNamesWithGameDict(game, lang = "CHS") {
  const { loadGameDict } = require("./generateGameDict");

  try {
    // 加载游戏字典
    const dict = loadGameDict(game, lang);
    if (!dict) {
      return {
        success: false,
        message: `无法加载 ${game} ${lang} 字典文件`,
        updated: 0,
        total: 0,
      };
    }

    // 确定数据库表名
    const tableMap = {
      genshin: "genshin_gacha",
      starrail: "starrail_gacha",
      zzz: "zzz_gacha",
    };

    const tableName = tableMap[game];
    if (!tableName) {
      return {
        success: false,
        message: `不支持的游戏: ${game}`,
        updated: 0,
        total: 0,
      };
    }

    console.log(`正在使用字典更新 ${game} 的物品名称...`);

    return new Promise((resolve, reject) => {
      // 查询需要更新的记录
      const selectQuery = `SELECT ROWID, item_id, name FROM ${tableName} WHERE item_id IS NOT NULL`;

      db2.all(selectQuery, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        let updated = 0;
        let total = rows.length;
        let processed = 0;

        if (total === 0) {
          resolve({
            success: true,
            message: `${game} 表中没有数据`,
            updated: 0,
            total: 0,
          });
          return;
        }

        // 处理每条记录
        rows.forEach((row) => {
          const dictName = dict[row.item_id];

          // 如果字典中有对应的名称且与当前名称不同，则更新
          if (dictName && dictName !== row.name) {
            const updateQuery = `UPDATE ${tableName} SET name = ? WHERE ROWID = ?`;

            db2.run(updateQuery, [dictName, row.ROWID], function (updateErr) {
              processed++;

              if (!updateErr) {
                updated++;
                console.log(
                  `更新 ${game}: ${row.item_id} ${row.name} -> ${dictName}`
                );
              } else {
                console.error(
                  `更新失败 ${game}: ${row.item_id}`,
                  updateErr.message
                );
              }

              // 所有记录处理完成
              if (processed === total) {
                resolve({
                  success: true,
                  message: `${game} 物品名称更新完成，更新了 ${updated}/${total} 条记录`,
                  updated,
                  total,
                  dictSize: Object.keys(dict).length,
                });
              }
            });
          } else {
            processed++;
            // 如果不需要更新，直接跳过
            if (processed === total) {
              resolve({
                success: true,
                message: `${game} 物品名称更新完成，更新了 ${updated}/${total} 条记录`,
                updated,
                total,
                dictSize: Object.keys(dict).length,
              });
            }
          }
        });
      });
    });
  } catch (error) {
    console.error(`更新 ${game} 物品名称失败:`, error.message);
    return {
      success: false,
      message: `更新 ${game} 物品名称失败: ${error.message}`,
      updated: 0,
      total: 0,
    };
  }
}

/**
 * 使用游戏字典文件更新所有游戏的抽卡数据物品名称
 * @param {string} lang - 语言代码，默认为 "CHS"
 * @returns {Promise<Object>} 更新结果汇总
 */
async function updateAllGachaItemNamesWithGameDict(lang = "CHS") {
  console.log("=== 开始使用游戏字典更新物品名称 ===");

  const games = ["genshin", "starrail", "zzz"];
  const results = {
    success: [],
    failed: [],
    total: {
      updated: 0,
      records: 0,
      games: 0,
    },
  };

  for (const game of games) {
    try {
      const result = await updateGachaItemNamesWithGameDict(game, lang);

      if (result.success) {
        results.success.push({
          game,
          ...result,
        });
        results.total.updated += result.updated;
        results.total.records += result.total;
      } else {
        results.failed.push({
          game,
          ...result,
        });
      }

      results.total.games++;
    } catch (error) {
      const failedResult = {
        game,
        success: false,
        message: `处理 ${game} 时发生异常: ${error.message}`,
        updated: 0,
        total: 0,
      };

      results.failed.push(failedResult);
      results.total.games++;
      console.error(`❌ ${failedResult.message}`);
    }
  }

  // 输出汇总信息
  console.log("\n=== 物品名称更新完成 ===");
  console.log(`处理游戏数: ${results.total.games}`);
  console.log(`成功更新: ${results.success.length} 个游戏`);
  console.log(`更新失败: ${results.failed.length} 个游戏`);
  console.log(`总更新记录: ${results.total.updated}/${results.total.records}`);

  if (results.failed.length > 0) {
    console.log("\n失败详情:");
    results.failed.forEach((result) => {
      console.log(`  - ${result.game}: ${result.message}`);
    });
  }

  return results;
}

/**
 * 检查使用游戏字典需要更新的物品名称数量
 * @param {string} lang - 语言代码，默认为 "CHS"
 * @returns {Promise<Object>} 检查结果
 */
async function checkItemNamesNeedUpdateWithGameDict(lang = "CHS") {
  const { loadGameDict } = require("./generateGameDict");

  const games = ["genshin", "starrail", "zzz"];
  const results = {};

  for (const game of games) {
    try {
      // 加载游戏字典
      const dict = loadGameDict(game, lang);
      if (!dict) {
        results[game] = {
          needUpdate: 0,
          total: 0,
          dictAvailable: false,
          message: `字典文件不存在: ${game} ${lang}`,
        };
        continue;
      }

      // 确定数据库表名
      const tableMap = {
        genshin: "genshin_gacha",
        starrail: "starrail_gacha",
        zzz: "zzz_gacha",
      };

      const tableName = tableMap[game];

      const checkResult = await new Promise((resolve, reject) => {
        const selectQuery = `SELECT item_id, name FROM ${tableName} WHERE item_id IS NOT NULL`;

        db2.all(selectQuery, [], (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          let needUpdate = 0;
          let total = rows.length;

          // 检查每条记录是否需要更新
          rows.forEach((row) => {
            const dictName = dict[row.item_id];
            if (dictName && dictName !== row.name) {
              needUpdate++;
            }
          });

          resolve({
            total,
            needUpdate,
            dictAvailable: true,
            dictSize: Object.keys(dict).length,
          });
        });
      });

      results[game] = checkResult;
    } catch (error) {
      console.error(`检查 ${game} 失败:`, error.message);
      results[game] = {
        needUpdate: 0,
        total: 0,
        dictAvailable: false,
        error: error.message,
      };
    }
  }

  return results;
}
