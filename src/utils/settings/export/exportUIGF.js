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
        export_app_version: "2.3.12",
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
