const { PlatformGamePathDetector } = require("./getPlatformGamePath");

// 创建跨平台游戏路径检测器实例
const pathDetector = new PlatformGamePathDetector();

// 鸣潮游戏配置
const wutheringWavesConfig = {
  executable: "Wuthering Waves.exe",
  appName: "Wuthering Waves", // macOS app name (without .app)
  registryKey: "KRInstall Wuthering Waves", // Windows registry key
};

// 获取鸣潮游戏路径（跨平台）
async function getGamePath() {
  try {
    return await pathDetector.getGamePath(wutheringWavesConfig);
  } catch (error) {
    throw new Error(`无法获取鸣潮游戏路径: ${error.message}`);
  }
}

// 读取日志文件并提取祈愿链接
function extractGachaUrl(logFilePath) {
  const tempLogFilePath = path.join(
    process.env.NEKO_GAME_FOLDER_PATH,
    "Client_temp.log"
  ); // 使用全局定义的临时路径

  return new Promise((resolve, reject) => {
    // 尝试将日志文件复制到临时目录
    fs.copyFile(logFilePath, tempLogFilePath, (copyErr) => {
      if (copyErr) {
        return reject(
          `无法复制日志文件（路径: ${logFilePath}），可能不存在: ${copyErr.message}`
        );
      }
      // 从临时文件读取内容
      fs.readFile(tempLogFilePath, "utf8", (readErr, data) => {
        fs.unlink(tempLogFilePath, (unlinkErr) => {
          if (unlinkErr) console.warn("删除临时文件失败:", unlinkErr.message);
        });
        if (readErr) {
          return reject(
            `读取日志文件失败（路径: ${tempLogFilePath}）: ${readErr.message}`
          );
        }
        // 使用正则提取符合模式的 URL
        const urlRegex =
          /https:\/\/aki-gm-resources\.(?:aki-game\.com|oversea\.aki-game\.net)\/aki\/gacha\/index\.html#\/record\?[^ ]+/g;
        const matches = data.match(urlRegex);

        if (matches && matches.length > 0) {
          let gachaUrl = matches[matches.length - 1]; // 获取最后一个匹配的 URL
          // 清理 URL 中多余的部分
          gachaUrl = gachaUrl.split('"')[0];
          resolve(gachaUrl);
        } else {
          reject("未找到祈愿链接");
        }
      });
    });
  });
}

module.exports = { getGamePath, extractGachaUrl };
