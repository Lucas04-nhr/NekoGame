const { ipcMain } = require("electron");
const hakushiClient = require("../../utils/metadata/hakushiClient");
const metadataClient = require("../../utils/metadata/metadataClient");

// 下载单个游戏的单个类型元数据
ipcMain.handle("download-hakushi-metadata", async (event, game, type) => {
  try {
    const result = await hakushiClient.downloadHakushiMetadata(game, type);
    return {
      success: result.success,
      skipped: result.skipped,
      message: result.success
        ? result.skipped
          ? `${game} 的 ${type} 元数据已是最新版本`
          : `${game} 的 ${type} 元数据下载成功`
        : `${game} 的 ${type} 元数据下载失败: ${result.reason}`,
      reason: result.reason,
    };
  } catch (error) {
    console.error("下载 Hakushi 元数据时发生错误:", error);
    return {
      success: false,
      skipped: false,
      message: `下载失败: ${error.message}`,
      reason: error.message,
    };
  }
});

// 下载指定游戏的所有元数据
ipcMain.handle("download-game-metadata", async (event, game) => {
  try {
    const results = await hakushiClient.downloadGameMetadata(game);
    const totalTypes =
      results.success.length + results.failed.length + results.skipped.length;
    const message = `${game} 元数据下载完成！成功: ${results.success.length}, 跳过: ${results.skipped.length}, 失败: ${results.failed.length}/${totalTypes}`;

    return {
      success: results.failed.length === 0,
      message,
      results,
    };
  } catch (error) {
    console.error("下载游戏元数据时发生错误:", error);
    return {
      success: false,
      message: `下载失败: ${error.message}`,
      results: { success: [], failed: [], skipped: [] },
    };
  }
});

// 下载所有游戏的所有元数据
ipcMain.handle("download-all-metadata", async (event) => {
  try {
    const results = await hakushiClient.downloadAllMetadata();

    // 计算总体统计
    const totalStats = Object.values(results).reduce(
      (acc, game) => {
        acc.success += game.success.length;
        acc.skipped += game.skipped.length;
        acc.failed += game.failed.length;
        return acc;
      },
      { success: 0, skipped: 0, failed: 0 }
    );

    const message = `所有元数据下载完成！成功: ${totalStats.success}, 跳过: ${totalStats.skipped}, 失败: ${totalStats.failed}`;

    return {
      success: totalStats.failed === 0,
      message,
      results,
      stats: totalStats,
    };
  } catch (error) {
    console.error("批量下载元数据时发生错误:", error);
    return {
      success: false,
      message: `批量下载失败: ${error.message}`,
      results: {},
      stats: { success: 0, skipped: 0, failed: 0 },
    };
  }
});

// 下载所有元数据和字典（使用统一客户端）
ipcMain.handle(
  "download-all-metadata-and-dicts",
  async (event, lang = "chs") => {
    try {
      const results = await metadataClient.downloadAllMetadata(lang);

      // 计算统计信息
      const stats = {
        uigf: results.uigf
          ? {
              success: results.uigf.success.length,
              skipped: results.uigf.skipped.length,
              failed: results.uigf.failed.length,
            }
          : { success: 0, skipped: 0, failed: 0 },
        hakushi: results.hakushi
          ? Object.values(results.hakushi).reduce(
              (acc, game) => {
                acc.success += game.success.length;
                acc.skipped += game.skipped.length;
                acc.failed += game.failed.length;
                return acc;
              },
              { success: 0, skipped: 0, failed: 0 }
            )
          : { success: 0, skipped: 0, failed: 0 },
      };

      const totalFailed = stats.uigf.failed + stats.hakushi.failed;
      const message = `所有数据下载完成！UIGF: ${stats.uigf.success} 成功, Hakushi: ${stats.hakushi.success} 成功, 总计失败: ${totalFailed}`;

      return {
        success: totalFailed === 0,
        message,
        results,
        stats,
      };
    } catch (error) {
      console.error("下载所有元数据和字典时发生错误:", error);
      return {
        success: false,
        message: `下载失败: ${error.message}`,
        results: { uigf: null, hakushi: null },
        stats: {
          uigf: { success: 0, skipped: 0, failed: 0 },
          hakushi: { success: 0, skipped: 0, failed: 0 },
        },
      };
    }
  }
);

// 检查元数据文件是否存在
ipcMain.handle("check-metadata-exists", (event, game, type) => {
  try {
    const exists = hakushiClient.checkMetadataExists(game, type);
    return { exists };
  } catch (error) {
    console.error("检查元数据文件时发生错误:", error);
    return { exists: false, error: error.message };
  }
});

// 读取元数据
ipcMain.handle("load-metadata", (event, game, type) => {
  try {
    const metadata = hakushiClient.loadMetadata(game, type);
    return {
      success: metadata !== null,
      data: metadata,
      message: metadata ? "元数据加载成功" : "元数据文件不存在或读取失败",
    };
  } catch (error) {
    console.error("读取元数据时发生错误:", error);
    return {
      success: false,
      data: null,
      message: `读取失败: ${error.message}`,
    };
  }
});

// 获取元数据状态信息
ipcMain.handle("get-metadata-status", (event) => {
  try {
    const status = {};
    const timestamps = hakushiClient.getAllMetadataTimestamps();

    for (const [game, config] of Object.entries(hakushiClient.GAME_CONFIG)) {
      status[game] = {};

      for (const type of config.types) {
        const exists = hakushiClient.checkMetadataExists(game, type);
        const timestamp = timestamps[game] && timestamps[game][type];

        if (exists) {
          const metadata = hakushiClient.loadMetadata(game, type);
          let itemCount = 0;

          if (metadata) {
            if (Array.isArray(metadata)) {
              itemCount = metadata.length;
            } else if (typeof metadata === "object") {
              itemCount = Object.keys(metadata).length;
            }
          }

          status[game][type] = {
            exists: true,
            itemCount,
            valid: metadata !== null,
            lastDownload: timestamp ? timestamp.dateString : "未知",
            lastDownloadTimestamp: timestamp ? timestamp.timestamp : null,
            isContentTimestamp: timestamp
              ? timestamp.isContentTimestamp
              : false,
          };
        } else {
          status[game][type] = {
            exists: false,
            itemCount: 0,
            valid: false,
            lastDownload: timestamp ? timestamp.dateString : "从未下载",
            lastDownloadTimestamp: timestamp ? timestamp.timestamp : null,
            isContentTimestamp: timestamp
              ? timestamp.isContentTimestamp
              : false,
          };
        }
      }
    }

    return { success: true, status };
  } catch (error) {
    console.error("获取元数据状态时发生错误:", error);
    return {
      success: false,
      status: {},
      message: error.message,
    };
  }
});

// 获取综合状态（UIGF + Hakushi）
ipcMain.handle("get-all-metadata-status", (event, lang = "chs") => {
  try {
    const timestamps = metadataClient.getAllTimestamps(lang);
    const supportedGames = metadataClient.getSupportedGames();

    const status = {
      uigf: {},
      hakushi: {},
    };

    // UIGF 状态
    for (const game of supportedGames.uigf) {
      const exists = metadataClient.hasUIGFDict(game, lang);
      const timestamp = timestamps.uigf && timestamps.uigf[game];

      if (exists) {
        const dict = metadataClient.getUIGFDict(game, lang);
        status.uigf[game] = {
          exists: true,
          itemCount: dict ? Object.keys(dict).length : 0,
          valid: dict !== null,
          lastDownload: timestamp ? timestamp.dateString : "未知",
          lastDownloadTimestamp: timestamp ? timestamp.timestamp : null,
          isContentTimestamp: timestamp ? timestamp.isContentTimestamp : false,
        };
      } else {
        status.uigf[game] = {
          exists: false,
          itemCount: 0,
          valid: false,
          lastDownload: timestamp ? timestamp.dateString : "从未下载",
          lastDownloadTimestamp: timestamp ? timestamp.timestamp : null,
          isContentTimestamp: timestamp ? timestamp.isContentTimestamp : false,
        };
      }
    }

    // Hakushi 状态
    for (const [game, config] of Object.entries(supportedGames.hakushi)) {
      status.hakushi[game] = {};

      for (const type of config.types) {
        const exists = metadataClient.hasHakushiMetadata(game, type);
        const timestamp =
          timestamps.hakushi &&
          timestamps.hakushi[game] &&
          timestamps.hakushi[game][type];

        if (exists) {
          const metadata = metadataClient.getHakushiMetadata(game, type);
          let itemCount = 0;

          if (metadata) {
            if (Array.isArray(metadata)) {
              itemCount = metadata.length;
            } else if (typeof metadata === "object") {
              itemCount = Object.keys(metadata).length;
            }
          }

          status.hakushi[game][type] = {
            exists: true,
            itemCount,
            valid: metadata !== null,
            lastDownload: timestamp ? timestamp.dateString : "未知",
            lastDownloadTimestamp: timestamp ? timestamp.timestamp : null,
            isContentTimestamp: timestamp
              ? timestamp.isContentTimestamp
              : false,
          };
        } else {
          status.hakushi[game][type] = {
            exists: false,
            itemCount: 0,
            valid: false,
            lastDownload: timestamp ? timestamp.dateString : "从未下载",
            lastDownloadTimestamp: timestamp ? timestamp.timestamp : null,
            isContentTimestamp: timestamp
              ? timestamp.isContentTimestamp
              : false,
          };
        }
      }
    }

    return { success: true, status };
  } catch (error) {
    console.error("获取综合元数据状态时发生错误:", error);
    return {
      success: false,
      status: { uigf: {}, hakushi: {} },
      message: error.message,
    };
  }
});

// 启动时自动下载所有元数据和字典
ipcMain.handle("auto-download-all-startup", async (event, lang = "chs") => {
  try {
    const results = await metadataClient.autoDownloadAllOnStartup(lang);

    // 计算统计信息
    const stats = {
      uigf: results.uigf
        ? {
            success: results.uigf.success.length,
            skipped: results.uigf.skipped.length,
            failed: results.uigf.failed.length,
          }
        : { success: 0, skipped: 0, failed: 0 },
      hakushi: results.hakushi
        ? Object.values(results.hakushi).reduce(
            (acc, game) => {
              acc.success += game.success.length;
              acc.skipped += game.skipped.length;
              acc.failed += game.failed.length;
              return acc;
            },
            { success: 0, skipped: 0, failed: 0 }
          )
        : { success: 0, skipped: 0, failed: 0 },
    };

    const totalFailed = stats.uigf.failed + stats.hakushi.failed;
    const message = `启动下载完成！UIGF: ${stats.uigf.success} 成功, Hakushi: ${stats.hakushi.success} 成功, 总计失败: ${totalFailed}`;

    return {
      success: totalFailed === 0,
      message,
      results,
      stats,
    };
  } catch (error) {
    console.error("启动时下载所有数据发生错误:", error);
    return {
      success: false,
      message: `启动下载失败: ${error.message}`,
      results: { uigf: null, hakushi: null },
      stats: {
        uigf: { success: 0, skipped: 0, failed: 0 },
        hakushi: { success: 0, skipped: 0, failed: 0 },
      },
    };
  }
});

// 获取支持的游戏配置
ipcMain.handle("get-supported-games", (event) => {
  try {
    const supportedGames = metadataClient.getSupportedGames();
    return { success: true, supportedGames };
  } catch (error) {
    console.error("获取支持的游戏配置时发生错误:", error);
    return {
      success: false,
      supportedGames: { uigf: [], hakushi: {} },
      message: error.message,
    };
  }
});

// 手动更新物品名称（基于已下载的 Hakushi 元数据）
ipcMain.handle(
  "update-item-names-from-hakushi",
  async (event, preferredLang = null) => {
    try {
      const {
        updateAllGachaItemNames,
      } = require("../../utils/settings/export/updateItemNames");
      const results = await updateAllGachaItemNames(preferredLang);

      return {
        success: true,
        message: `基于 Hakushi 元数据更新完成！共更新 ${results.total.updated} 条记录`,
        results,
      };
    } catch (error) {
      console.error("基于 Hakushi 元数据更新物品名称失败:", error);
      return {
        success: false,
        message: `更新失败: ${error.message}`,
        results: { total: { updated: 0, errors: 1 }, details: {} },
      };
    }
  }
);

// 检查基于 Hakushi 元数据需要更新的物品名称数量
ipcMain.handle(
  "check-hakushi-item-names-need-update",
  async (event, preferredLang = null) => {
    try {
      const {
        checkItemNamesNeedUpdate,
      } = require("../../utils/settings/export/updateItemNames");
      const results = await checkItemNamesNeedUpdate(preferredLang);

      return {
        success: true,
        results,
      };
    } catch (error) {
      console.error("检查基于 Hakushi 元数据的物品名称更新需求失败:", error);
      return {
        success: false,
        message: `检查失败: ${error.message}`,
        results: {},
      };
    }
  }
);

console.log("Hakushi 元数据 IPC 处理程序已注册");
