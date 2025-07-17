const { loadDict } = require("./fetchUIGF");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

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

/**
 * 根据item_id和字典更新记录的name字段
 * @param {string} tableName - 表名 (genshin_gacha, starrail_gacha, zzz_gacha)
 * @param {string} game - 游戏名称 (genshin, starrail, zzz)
 * @param {string} lang - 语言代码
 * @returns {Promise<{updated: number, errors: number}>} 更新结果
 */
async function updateItemNamesInTable(tableName, game, lang = "chs") {
  return new Promise((resolve, reject) => {
    console.log(`开始更新 ${tableName} 表中的物品名称...`);

    // 加载字典
    const dict = loadDict(game, lang);
    if (!dict) {
      console.warn(`无法加载 ${game} 的字典，跳过更新`);
      resolve({ updated: 0, errors: 0 });
      return;
    }

    console.log(`已加载 ${game} 字典，包含 ${Object.keys(dict).length} 个条目`);

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
 * @param {string} lang - 语言代码
 * @returns {Promise<Object>} 总体更新结果
 */
async function updateAllGachaItemNames(lang = "chs") {
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
        lang
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
 * @param {string} lang - 语言代码
 * @returns {Promise<Object>} 检查结果
 */
async function checkItemNamesNeedUpdate(lang = "chs") {
  const gameConfigs = [
    { table: "genshin_gacha", game: "genshin" },
    { table: "starrail_gacha", game: "starrail" },
    { table: "zzz_gacha", game: "zzz" },
  ];

  const results = {};

  for (const config of gameConfigs) {
    try {
      const dict = loadDict(config.game, lang);
      if (!dict) {
        results[config.game] = {
          needUpdate: 0,
          total: 0,
          dictAvailable: false,
          message: "字典不可用",
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
  updateItemNamesInTable,
  updateAllGachaItemNames,
  checkItemNamesNeedUpdate,
};
