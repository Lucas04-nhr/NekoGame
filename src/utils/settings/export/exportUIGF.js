const fs = require("fs");
const path = require("path");
const { db2 } = require("../../../app/database");
const { ipcMain, dialog } = require("electron");
const { fetchItemId, itemCache } = require("./UIGFapi");

// 游戏类型
const fieldSchemas = {
  hk4e: [
    "gacha_id",
    "gacha_type",
    "item_id",
    "count",
    "time",
    "name",
    "item_type",
    "rank_type",
    "id",
    "uigf_gacha_type",
  ],
  hkrpg: [
    "gacha_id",
    "gacha_type",
    "item_id",
    "count",
    "time",
    "name",
    "item_type",
    "rank_type",
    "id",
  ],
  nap: [
    "gacha_id",
    "gacha_type",
    "item_id",
    "count",
    "time",
    "name",
    "item_type",
    "rank_type",
    "id",
  ],
};
async function validateAndFormatRecord(record, schema, gameType) {
  const formattedRecord = {};
  for (const field of schema) {
    if (record[field] !== undefined && record[field] !== null) {
      formattedRecord[field] = record[field].toString();
    } else {
      // 如果确实字段内容
      formattedRecord[field] = "";
    }
  }
  // 如果 item_id 缺失，通过 UIGFapi 获取
  if (!formattedRecord.item_id && record.name) {
    try {
      const itemId = await fetchItemId(record.name, "chs", gameType);
      formattedRecord.item_id = itemId.toString();
    } catch (error) {
      console.warn(`无法获取 item_id，name: ${record.name}`, error.message);
    }
  }
  // 补充 uigf_gacha_type
  if (record.gacha_type) {
    // 如果 gacha_type 为 301 或 400，统一映射为 301 角色活动祈愿
    const normalizedGachaType =
      record.gacha_type === "400" ? "301" : record.gacha_type.toString();
    formattedRecord.uigf_gacha_type = normalizedGachaType;
  }
  return formattedRecord;
}

// 导出方法
async function exportUIGFData({
  tableName,
  type,
  outputFileName,
  schema,
  gameType,
  selectedUIDs,
  customPath = null,
}) {
  const query = `SELECT * FROM ${tableName} WHERE uid IN (${selectedUIDs
    .map(() => "?")
    .join(",")}) ORDER BY id ASC`;

  let outputPath, outputFile;

  if (customPath) {
    // 使用用户指定的路径
    outputFile = customPath;
    outputPath = path.dirname(customPath);
  } else {
    // 使用默认路径
    outputPath = path.join(process.env.NEKO_GAME_FOLDER_PATH, "export");
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath);
    }
    outputFile = path.resolve(outputPath, outputFileName);
  }

  try {
    const records = await new Promise((resolve, reject) => {
      db2.all(query, selectedUIDs, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (records.length === 0) {
      throw new Error(`没有找到 UID: ${selectedUIDs.join(", ")} 的记录`);
    }

    const formattedData = {
      info: {
        export_timestamp: Math.floor(Date.now() / 1000),
        export_app: "NekoGame",
        export_app_version: "2.5.0",
        version: "v4.0",
      },
      [type]: [],
    };

    const groupedByUID = {};
    for (const record of records) {
      if (!groupedByUID[record.uid]) {
        groupedByUID[record.uid] = {
          uid: record.uid,
          timezone: 8,
          lang: record.lang || "zh-cn",
          list: [],
        };
      }
      const formattedRecord = await validateAndFormatRecord(
        record,
        schema,
        gameType
      );
      groupedByUID[record.uid].list.push(formattedRecord);
    }

    formattedData[type] = Object.values(groupedByUID);

    fs.writeFileSync(
      outputFile,
      JSON.stringify(formattedData, null, 4),
      "utf-8"
    );
    console.log(`抽卡数据已成功导出: ${outputFile}`);

    return { success: true, filePath: outputFile };
  } catch (error) {
    console.error("导出 UIGF 数据时发生错误:", error.message);
    throw error; // 抛出错误以便调用者处理
  }
}

// IPC 处理
ipcMain.handle("export-genshin-data", async (event, selectedUIDs) => {
  const defaultFileName = `UIGF4_genshin_gacha_${selectedUIDs.join(
    "_"
  )}_NekoGame.json`;
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "保存原神抽卡记录",
    defaultPath: defaultFileName,
    filters: [{ name: "JSON 文件", extensions: ["json"] }],
  });

  if (canceled) {
    return { success: false, message: "用户取消了保存操作" };
  }

  try {
    await exportUIGFData({
      tableName: "genshin_gacha",
      type: "hk4e",
      outputFileName: path.basename(filePath),
      schema: fieldSchemas.hk4e,
      gameType: "genshin",
      selectedUIDs,
      customPath: filePath,
    });
    return { success: true, message: `原神抽卡记录已成功导出到:\n${filePath}` };
  } catch (error) {
    return { success: false, message: `导出失败: ${error.message}` };
  }
});

ipcMain.handle("export-starRail-data", async (event, selectedUIDs) => {
  const defaultFileName = `UIGF4_starRail_gacha_${selectedUIDs.join(
    "_"
  )}_NekoGame.json`;
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "保存崩坏：星穹铁道抽卡记录",
    defaultPath: defaultFileName,
    filters: [{ name: "JSON 文件", extensions: ["json"] }],
  });

  if (canceled) {
    return { success: false, message: "用户取消了保存操作" };
  }

  try {
    await exportUIGFData({
      tableName: "starRail_gacha",
      type: "hkrpg",
      outputFileName: path.basename(filePath),
      schema: fieldSchemas.hkrpg,
      gameType: "starRail",
      selectedUIDs,
      customPath: filePath,
    });
    return {
      success: true,
      message: `崩坏：星穹铁道抽卡记录已成功导出到:\n${filePath}`,
    };
  } catch (error) {
    return { success: false, message: `导出失败: ${error.message}` };
  }
});

ipcMain.handle("export-zzz-data", async (event, selectedUIDs) => {
  const defaultFileName = `UIGF4_zzz_gacha_${selectedUIDs.join(
    "_"
  )}_NekoGame.json`;
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "保存绝区零抽卡记录",
    defaultPath: defaultFileName,
    filters: [{ name: "JSON 文件", extensions: ["json"] }],
  });

  if (canceled) {
    return { success: false, message: "用户取消了保存操作" };
  }

  try {
    await exportUIGFData({
      tableName: "zzz_gacha",
      type: "nap",
      outputFileName: path.basename(filePath),
      schema: fieldSchemas.nap,
      gameType: "zzz",
      selectedUIDs,
      customPath: filePath,
    });
    return {
      success: true,
      message: `绝区零抽卡记录已成功导出到:\n${filePath}`,
    };
  } catch (error) {
    return { success: false, message: `导出失败: ${error.message}` };
  }
});

// 联合导出UIGF v4数据
ipcMain.handle("export-combined-uigf-data", async (event, selectedData) => {
  try {
    // 计算总UID数量用于文件名
    const totalUIDs = [
      ...selectedData.genshin,
      ...selectedData.starRail,
      ...selectedData.zzz,
    ];

    if (totalUIDs.length === 0) {
      return { success: false, message: "未选择任何UID" };
    }

    const defaultFileName = `UIGF4_Combined_NekoGame.json`;
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "保存联合抽卡记录 (UIGF v4)",
      defaultPath: defaultFileName,
      filters: [{ name: "JSON 文件", extensions: ["json"] }],
    });

    if (canceled) {
      return { success: false, message: "用户取消了保存操作" };
    }

    // 初始化合并的数据结构
    const combinedData = {
      info: {
        export_timestamp: Math.floor(Date.now() / 1000),
        export_app: "NekoGame",
        export_app_version: "2.5.0",
        version: "v4.0",
      },
      hk4e: [], // 原神
      hkrpg: [], // 崩铁
      nap: [], // 绝区零
    };

    // 获取数据的函数
    const getGameData = async (tableName, gameType, schema, selectedUIDs) => {
      if (selectedUIDs.length === 0) return [];

      const query = `SELECT * FROM ${tableName} WHERE uid IN (${selectedUIDs
        .map(() => "?")
        .join(",")}) ORDER BY id ASC`;

      return new Promise((resolve, reject) => {
        db2.all(query, selectedUIDs, async (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          const groupedByUID = {};
          for (const record of rows) {
            if (!groupedByUID[record.uid]) {
              groupedByUID[record.uid] = {
                uid: record.uid,
                timezone: 8,
                lang: record.lang || "zh-cn",
                list: [],
              };
            }
            const formattedRecord = await validateAndFormatRecord(
              record,
              schema,
              gameType
            );
            groupedByUID[record.uid].list.push(formattedRecord);
          }

          resolve(Object.values(groupedByUID));
        });
      });
    };

    // 并行获取各游戏数据
    const [genshinData, starRailData, zzzData] = await Promise.all([
      selectedData.genshin.length > 0
        ? getGameData(
            "genshin_gacha",
            "genshin",
            fieldSchemas.hk4e,
            selectedData.genshin
          )
        : Promise.resolve([]),
      selectedData.starRail.length > 0
        ? getGameData(
            "starRail_gacha",
            "starRail",
            fieldSchemas.hkrpg,
            selectedData.starRail
          )
        : Promise.resolve([]),
      selectedData.zzz.length > 0
        ? getGameData("zzz_gacha", "zzz", fieldSchemas.nap, selectedData.zzz)
        : Promise.resolve([]),
    ]);

    // 组装数据
    if (genshinData.length > 0) combinedData.hk4e = genshinData;
    if (starRailData.length > 0) combinedData.hkrpg = starRailData;
    if (zzzData.length > 0) combinedData.nap = zzzData;

    // 移除空的游戏数据节点
    if (combinedData.hk4e.length === 0) delete combinedData.hk4e;
    if (combinedData.hkrpg.length === 0) delete combinedData.hkrpg;
    if (combinedData.nap.length === 0) delete combinedData.nap;

    // 写入合并后的文件
    fs.writeFileSync(filePath, JSON.stringify(combinedData, null, 4), "utf-8");

    const exportedGames = [];
    if (selectedData.genshin.length > 0)
      exportedGames.push(`原神(${selectedData.genshin.length}个UID)`);
    if (selectedData.starRail.length > 0)
      exportedGames.push(`崩铁(${selectedData.starRail.length}个UID)`);
    if (selectedData.zzz.length > 0)
      exportedGames.push(`绝区零(${selectedData.zzz.length}个UID)`);

    return {
      success: true,
      message: `联合导出成功!\n已导出: ${exportedGames.join(
        ", "
      )}\n文件路径: ${filePath}`,
    };
  } catch (error) {
    console.error("联合导出失败:", error);
    return { success: false, message: `联合导出失败: ${error.message}` };
  }
});
