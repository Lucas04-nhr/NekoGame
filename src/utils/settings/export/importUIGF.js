const fs = require("fs");
const { db2 } = require("../../../app/database");
const { ipcMain, dialog } = require("electron");
const { fetchItemId, itemCache, fetchItemName } = require("./UIGFapi");
const { checkUIGF } = require("./checkUIGF");
const { getHakushiMetadata } = require("../../metadata/metadataClient");

const UIGF_FIELDS = [
  "id",
  "uid",
  "gacha_id",
  "gacha_type",
  "item_id",
  "count",
  "time",
  "name",
  "lang",
  "item_type",
  "rank_type",
];

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
 * 标准化语言代码，增强鲁棒性
 * @param {string} lang - 原始语言代码
 * @returns {string} - 标准化后的语言代码
 */
function normalizeLanguageCode(lang) {
  if (!lang) return "CHS";

  const normalizedLang = lang.toLowerCase().replace(/[-_]/g, "");

  // 中文变体映射
  if (
    ["zhcn", "zh", "chs", "cn", "chinese", "china"].includes(normalizedLang)
  ) {
    return "CHS";
  }

  // 英文变体映射
  if (["en", "enus", "eng", "english", "us"].includes(normalizedLang)) {
    return "EN";
  }

  // 日文变体映射
  if (["jp", "ja", "jajp", "japanese", "japan"].includes(normalizedLang)) {
    return "JP";
  }

  // 韩文变体映射
  if (["kr", "ko", "kokr", "korean", "korea"].includes(normalizedLang)) {
    return "KR";
  }

  // 如果无法识别，默认返回中文
  console.warn(`未识别的语言代码: ${lang}，默认使用中文`);
  return "CHS";
}

/**
 * 从Hakushi元数据中根据物品名称获取物品ID
 * @param {string} itemName - 物品名称
 * @param {string} gameType - 游戏类型 (genshin, starrail, zzz)
 * @param {string} itemType - 物品类型 (character, weapon, lightcone, bangboo)
 * @param {string} lang - 语言代码 (支持各种变体如: zh-cn, zh_CN, CHS, chs, cn等)
 * @returns {string|null} - 物品ID或null
 */
function getItemIdFromHakushiMetadata(
  itemName,
  gameType,
  itemType,
  lang = "CHS"
) {
  try {
    const metadata = getHakushiMetadata(gameType, itemType);
    if (!metadata) {
      console.warn(`未找到 ${gameType} 的 ${itemType} 元数据`);
      return null;
    }

    // 标准化语言代码
    const standardLang = normalizeLanguageCode(lang);

    // 语言代码映射：将标准化的语言代码映射到元数据中的实际字段名
    const langMap = {
      CHS: "cn", // 中文简体
      EN: "en", // 英文
      JP: "jp", // 日文
      KR: "kr", // 韩文
    };

    const actualLangKey = langMap[standardLang];

    // 遍历元数据查找匹配的物品名称
    for (const [id, itemData] of Object.entries(metadata)) {
      if (itemData[actualLangKey] === itemName) {
        return id;
      }
    }
    return null;
  } catch (error) {
    console.error(`从Hakushi元数据获取物品ID失败: ${error.message}`);
    return null;
  }
}

/**
 * 从Hakushi元数据中根据物品ID获取物品名称
 * @param {string} itemId - 物品ID
 * @param {string} gameType - 游戏类型 (genshin, starrail, zzz)
 * @param {string} itemType - 物品类型 (character, weapon, lightcone, bangboo)
 * @param {string} lang - 语言代码 (支持各种变体如: zh-cn, zh_CN, CHS, chs, cn等)
 * @returns {string|null} - 物品名称或null
 */
function getItemNameFromHakushiMetadata(
  itemId,
  gameType,
  itemType,
  lang = "CHS"
) {
  try {
    const metadata = getHakushiMetadata(gameType, itemType);
    if (!metadata) {
      console.warn(`未找到 ${gameType} 的 ${itemType} 元数据`);
      return null;
    }

    const itemData = metadata[itemId];
    if (!itemData) {
      return null;
    }

    // 标准化语言代码
    const standardLang = normalizeLanguageCode(lang);

    // 语言代码映射：将标准化的语言代码映射到元数据中的实际字段名
    const langMap = {
      CHS: "cn", // 中文简体
      EN: "en", // 英文
      JP: "jp", // 日文
      KR: "kr", // 韩文
    };

    const actualLangKey = langMap[standardLang];

    if (itemData[actualLangKey]) {
      return itemData[actualLangKey];
    }
    return null;
  } catch (error) {
    console.error(`从Hakushi元数据获取物品名称失败: ${error.message}`);
    return null;
  }
}

/**
 * 综合查找物品名称（尝试所有可能的物品类型）
 * @param {string} itemId - 物品ID
 * @param {string} gameType - 游戏类型 (genshin, starrail, zzz)
 * @param {string} lang - 语言代码 (支持各种变体如: zh-cn, zh_CN, CHS, chs, cn等)
 * @returns {string|null} - 物品名称或null
 */
function findItemNameFromAllTypes(itemId, gameType, lang = "CHS") {
  const typeMap = {
    genshin: ["character", "weapon"],
    starrail: ["character", "lightcone"],
    zzz: ["character", "weapon", "bangboo"],
  };

  const types = typeMap[gameType] || [];
  for (const type of types) {
    const name = getItemNameFromHakushiMetadata(itemId, gameType, type, lang);
    if (name) {
      return name;
    }
  }
  return null;
}

/**
 * 综合查找物品ID（尝试所有可能的物品类型）
 * @param {string} itemName - 物品名称
 * @param {string} gameType - 游戏类型 (genshin, starrail, zzz)
 * @param {string} lang - 语言代码 (支持各种变体如: zh-cn, zh_CN, CHS, chs, cn等)
 * @returns {string|null} - 物品ID或null
 */
function findItemIdFromAllTypes(itemName, gameType, lang = "CHS") {
  const typeMap = {
    genshin: ["character", "weapon"],
    starrail: ["character", "lightcone"],
    zzz: ["character", "weapon", "bangboo"],
  };

  const types = typeMap[gameType] || [];
  for (const type of types) {
    const id = getItemIdFromHakushiMetadata(itemName, gameType, type, lang);
    if (id) {
      return id;
    }
  }
  return null;
}

/**
 * 优先使用Hakushi元数据，失败时回退到API
 * @param {string} itemName - 物品名称
 * @param {string} gameType - 游戏类型
 * @param {string} lang - 语言代码
 * @param {Function} fetchItemIdFn - API获取函数
 * @returns {Promise<string|null>} - 物品ID
 */
async function getItemIdWithFallback(itemName, gameType, lang, fetchItemIdFn) {
  // 标准化语言代码，然后判断是否为中文
  const standardLang = normalizeLanguageCode(lang);
  const hakushiLang = standardLang;

  // 首先尝试从Hakushi元数据获取
  const hakushiItemId = findItemIdFromAllTypes(itemName, gameType, hakushiLang);
  if (hakushiItemId) {
    console.log(`从Hakushi元数据获取到物品ID: ${itemName} -> ${hakushiItemId}`);
    return hakushiItemId;
  }

  // 如果Hakushi元数据没有，则回退到API
  if (fetchItemIdFn) {
    try {
      console.log(`Hakushi元数据未找到 ${itemName}，尝试API获取...`);
      const apiItemId = await fetchItemIdFn(itemName);
      if (apiItemId) {
        console.log(`从API获取到物品ID: ${itemName} -> ${apiItemId}`);
        return apiItemId;
      }
    } catch (error) {
      console.warn(`API获取物品ID失败: ${itemName}, 错误: ${error.message}`);
    }
  }

  console.warn(`无法获取物品ID: ${itemName}`);
  return null;
}

async function importUIGFData(
  filePath,
  tableName,
  gameKey,
  fetchItemIdFn,
  gameType = null
) {
  try {
    const rawData = fs.readFileSync(filePath, "utf-8");
    const parsedData = JSON.parse(rawData);

    // 检测数据格式标准
    const isUIGF3 =
      parsedData.info && parsedData.list && parsedData.info.uigf_version;
    const isUIGF4 = parsedData[gameKey] && Array.isArray(parsedData[gameKey]);
    const isSRGF =
      parsedData.info && parsedData.list && parsedData.info.srgf_version;
    let formatType = "未知格式"; // 数据格式类型
    let recordCount = 0; // 记录总数

    if (!isUIGF3 && !isUIGF4 && !isSRGF) {
      throw new Error(`无效的 UIGF 格式: 缺少 '${gameKey}' 或 'list' 数据`);
    }
    if (isUIGF3 && gameType !== "genshin") {
      throw new Error(`UIGF 3.0 数据仅支持导入到原神`);
    }
    if (isSRGF && gameType !== "starrail") {
      throw new Error(`SRGF 格式仅支持崩坏：星穹铁道数据`);
    }
    if (isUIGF3) {
      formatType = "UIGF3.0";
      recordCount = parsedData.list.length;
    } else if (isSRGF) {
      formatType = "SRGF";
      recordCount = parsedData.list.length;
    } else if (isUIGF4) {
      formatType = "UIGF4.0";
      recordCount = parsedData[gameKey].reduce((total, playerData) => {
        return total + (playerData.list ? playerData.list.length : 0);
      }, 0);
    }

    const query = `INSERT OR IGNORE INTO ${tableName} (${UIGF_FIELDS.join(
      ", "
    )}) VALUES (${UIGF_FIELDS.map(() => "?").join(", ")})`;
    let insertedCount = 0;

    if (isUIGF4) {
      global.Notify(
        true,
        `${formatType}数据验证成功\n共查询到${recordCount}条记录\n正在导入`
      );
      // UIGF 4.0
      for (const playerData of parsedData[gameKey]) {
        const { uid, list, lang = "zh-cn" } = playerData;
        if (!list || !Array.isArray(list)) continue;
        insertedCount = await insertUIGF(
          query,
          insertedCount,
          uid,
          lang,
          fetchItemIdFn,
          list,
          gameType
        ); //导入数据
      }
    } else if (isUIGF3 || isSRGF) {
      // UIGF 3.0 & isSRGF1.0格式处理
      const { uid, lang = "zh-cn" } = parsedData.info;
      global.Notify(
        true,
        `${formatType}数据验证成功\n共查询到${recordCount}条记录\n正在导入`
      );
      insertedCount = await insertUIGF(
        query,
        insertedCount,
        uid,
        lang,
        fetchItemIdFn,
        parsedData.list,
        gameType
      ); //导入数据
    }
    console.log(`成功导入 ${insertedCount} 条 ${formatType} 记录`);
    return {
      success: true,
      message: `成功导入 ${insertedCount} 条 ${formatType} 记录`,
    };
  } catch (error) {
    console.error("导入 UIGF/SRGF 数据失败:", error.message);
    return { success: false, message: `导入数据失败: ${error.message}` };
  }
}

async function insertUIGF(
  query,
  insertedCount,
  uid,
  lang,
  fetchItemIdFn,
  list,
  gameType
) {
  // 标准化语言代码，然后判断是否为中文
  const standardLang = normalizeLanguageCode(lang);
  const hakushiLang = standardLang;
  // 强制使用中文作为最终的物品名称语言
  const targetLang = "CHS";

  console.log(
    `开始处理 ${list.length} 条记录，游戏类型: ${
      gameType || "未知"
    }，将物品名称统一替换为中文`
  );

  // 统计元数据使用情况
  let metadataHits = 0;
  let apiFallbacks = 0;
  let failures = 0;

  for (const record of list) {
    const recordData = { ...record, uid, lang };
    // 检查字段完整性
    checkUIGF(
      recordData.id,
      recordData.uid,
      recordData.gacha_type,
      recordData.time,
      recordData.rank_type,
      recordData.name,
      recordData
    );

    // 始终尝试根据 item_id 进行Hakushi元数据匹配并替换为中文名称
    try {
      if (recordData.item_id) {
        // 根据 item_id 查找对应的中文名称
        const chineseName = findItemNameFromAllTypes(
          recordData.item_id,
          gameType,
          targetLang
        );

        if (chineseName) {
          // 在Hakushi元数据中找到了对应的中文名称，直接替换
          if (recordData.name && recordData.name !== chineseName) {
            console.log(
              `根据Hakushi元数据替换为中文名称: ID ${recordData.item_id} (${recordData.name} -> ${chineseName})`
            );
            recordData.name = chineseName;
          } else if (!recordData.name) {
            console.log(
              `根据Hakushi元数据补充中文名称: ID ${recordData.item_id} -> ${chineseName}`
            );
            recordData.name = chineseName;
          } else {
            console.log(
              `已是中文名称，Hakushi元数据验证成功: ${recordData.name} (ID: ${recordData.item_id})`
            );
          }
          metadataHits++;
        } else {
          // Hakushi元数据中没有找到对应的 item_id
          console.log(
            `Hakushi元数据中未找到 ID ${recordData.item_id}，保持原有数据`
          );
          apiFallbacks++;
        }
      } else if (!recordData.item_id && recordData.name) {
        // 如果没有 item_id，先尝试从原语言的Hakushi元数据获取item_id
        let metadataItemId = findItemIdFromAllTypes(
          recordData.name,
          gameType,
          hakushiLang
        );

        // 如果原语言找不到，再尝试从中文Hakushi元数据获取
        if (!metadataItemId && hakushiLang !== "CHS") {
          metadataItemId = findItemIdFromAllTypes(
            recordData.name,
            gameType,
            "CHS"
          );
        }

        if (metadataItemId) {
          recordData.item_id = metadataItemId;

          // 获取item_id后，再查找对应的中文名称
          const chineseName = findItemNameFromAllTypes(
            metadataItemId,
            gameType,
            targetLang
          );

          if (chineseName && chineseName !== recordData.name) {
            console.log(
              `根据物品名称获取ID并替换为中文: ${recordData.name} -> ${chineseName} (ID: ${metadataItemId})`
            );
            recordData.name = chineseName;
          }

          metadataHits++;
        } else {
          // 回退到API
          if (fetchItemIdFn) {
            const apiItemId = await fetchItemIdFn(recordData.name);
            if (apiItemId) {
              recordData.item_id = apiItemId;

              // 获取item_id后，尝试获取中文名称
              const chineseName = findItemNameFromAllTypes(
                apiItemId,
                gameType,
                targetLang
              );

              if (chineseName && chineseName !== recordData.name) {
                console.log(
                  `通过API获取ID并替换为中文: ${recordData.name} -> ${chineseName} (ID: ${apiItemId})`
                );
                recordData.name = chineseName;
              }

              apiFallbacks++;
            }
          }
        }

        if (!recordData.item_id) {
          failures++;
          global.Notify(
            false,
            `无法获取物品ID: ${recordData.name}\n已跳过此记录`
          );
          console.warn(`无法获取物品ID: ${recordData.name}，跳过此记录`);
          continue;
        }
      } else {
        // 既没有 item_id 也没有 name
        console.warn(`记录缺少必要信息，跳过处理`);
        apiFallbacks++;
      }
    } catch (err) {
      console.warn(`Hakushi元数据处理失败: ${err.message}`);
      apiFallbacks++;
    }
    // ZZZ数据星级转换处理
    if (gameType === "zzz" && recordData.rank_type) {
      recordData.rank_type = convertZzzRankType(recordData.rank_type);
    }

    // 插入数据
    const values = UIGF_FIELDS.map((field) => recordData[field] || "");
    await new Promise((resolve, reject) => {
      db2.run(query, values, function (err) {
        if (err) {
          reject(`插入失败: ${err.message}`);
        } else {
          if (this.changes > 0) insertedCount++;
          resolve();
        }
      });
    });
  }

  // 输出统计信息
  console.log(
    `数据处理完成 - Hakushi元数据命中: ${metadataHits}, API回退: ${apiFallbacks}, 失败: ${failures}`
  );
  if (metadataHits > 0) {
    console.log(
      `✅ Hakushi元数据有效，${metadataHits} 个物品通过元数据验证或获取ID`
    );
  }
  if (apiFallbacks > 0) {
    console.log(
      `🔄 ${apiFallbacks} 个物品未使用Hakushi元数据（保持原有数据或通过API获取）`
    );
  }
  if (failures > 0) {
    console.log(`⚠️ ${failures} 个物品无法获取ID，已跳过`);
  }

  return insertedCount;
}

ipcMain.handle("import-genshin-data", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title:
      "选择 原神 UIGF 数据文件 - 如果不需要导入其他工具的抽卡记录，进入对应界面点击刷新数据即可",
    filters: [{ name: "JSON 文件", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (canceled || filePaths.length === 0) {
    return { success: false, message: "未选择文件" };
  }

  const filePath = filePaths[0];
  return await importUIGFData(
    filePath,
    "genshin_gacha",
    "hk4e",
    fetchItemId,
    "genshin"
  );
});

ipcMain.handle("import-starRail-data", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title:
      "选择 崩铁 UIGF 数据文件 - 如果不需要导入其他工具的抽卡记录，进入对应界面点击刷新数据即可",
    filters: [{ name: "JSON 文件", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (canceled || filePaths.length === 0) {
    return { success: false, message: "未选择文件" };
  }

  const filePath = filePaths[0];
  return await importUIGFData(
    filePath,
    "starRail_gacha",
    "hkrpg",
    fetchItemId,
    "starrail"
  );
});

ipcMain.handle("import-zzz-data", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title:
      "选择 绝区零 UIGF 数据文件 - 如果不需要导入其他工具的抽卡记录，进入对应界面点击刷新数据即可",
    filters: [{ name: "JSON 文件", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (canceled || filePaths.length === 0) {
    return { success: false, message: "未选择文件" };
  }

  const filePath = filePaths[0];
  return await importUIGFData(filePath, "zzz_gacha", "nap", fetchItemId, "zzz");
});
