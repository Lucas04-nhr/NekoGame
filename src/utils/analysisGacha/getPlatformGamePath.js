const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { db } = require("../../app/database");

// 跨平台游戏路径检测
class PlatformGamePathDetector {
  constructor() {
    this.platform = process.platform;
  }

  // 从数据库查询路径并验证其有效性
  queryGamePathFromDb(gameExecutable) {
    return new Promise((resolve, reject) => {
      const query = `SELECT path FROM games WHERE path LIKE '%${gameExecutable}%'`;
      db.get(query, (err, row) => {
        if (err) {
          return reject(`数据库查询失败: ${err.message}`);
        }
        if (row && row.path) {
          const extractedPath = row.path.split(gameExecutable)[0].trim();

          // 根据平台构建日志文件路径
          let logFilePath;
          if (this.platform === "win32") {
            logFilePath = path.join(
              extractedPath,
              "Client",
              "Saved",
              "Logs",
              "Client.log"
            );
          } else if (this.platform === "darwin") {
            // macOS 游戏可能在 Applications 或用户目录下
            logFilePath = path.join(
              extractedPath,
              "Contents",
              "Resources",
              "Client",
              "Saved",
              "Logs",
              "Client.log"
            );
          } else {
            // Linux
            logFilePath = path.join(
              extractedPath,
              "Client",
              "Saved",
              "Logs",
              "Client.log"
            );
          }

          // 验证路径是否存在
          fs.access(logFilePath, fs.constants.F_OK, (accessErr) => {
            if (accessErr) {
              return reject(
                `游戏路径无效，日志文件不存在，请检查（路径: ${logFilePath}）`
              );
            }
            resolve(logFilePath);
          });
        } else {
          reject("数据库中未找到游戏路径，请在游戏库中手动导入游戏信息");
        }
      });
    });
  }

  // Windows 注册表查询（仅在 Windows 上可用）
  async queryWindowsRegistry(gameKey) {
    if (this.platform !== "win32") {
      throw new Error("注册表查询仅在 Windows 平台可用");
    }

    try {
      // 动态导入 winreg，如果不存在则跳过
      const winreg = require("winreg");

      const registryPaths = [
        "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "HKEY_CURRENT_USER\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
      ];

      for (const regPath of registryPaths) {
        try {
          const fullPath = `${regPath}\\${gameKey}`;
          const installPath = await this.queryRegistryValue(
            fullPath,
            "InstallPath"
          );
          return installPath;
        } catch (err) {
          console.warn(`注册表查询失败: ${err.message}`);
        }
      }
      throw new Error("未在注册表中找到游戏安装路径");
    } catch (requireErr) {
      throw new Error("winreg 模块不可用，请手动添加游戏路径");
    }
  }

  // macOS 游戏路径检测
  async queryMacOSGamePaths(gameAppName) {
    if (this.platform !== "darwin") {
      throw new Error("macOS 路径查询仅在 macOS 平台可用");
    }

    const commonPaths = [
      `/Applications/${gameAppName}.app`,
      `${os.homedir()}/Applications/${gameAppName}.app`,
      `${os.homedir()}/Desktop/${gameAppName}.app`,
      `${os.homedir()}/Downloads/${gameAppName}.app`,
    ];

    for (const gamePath of commonPaths) {
      try {
        await fs.promises.access(gamePath, fs.constants.F_OK);
        return gamePath;
      } catch (err) {
        // 继续检查下一个路径
      }
    }

    throw new Error(`未找到游戏应用: ${gameAppName}.app`);
  }

  // Linux 游戏路径检测
  async queryLinuxGamePaths(gameExecutable) {
    if (this.platform !== "linux") {
      throw new Error("Linux 路径查询仅在 Linux 平台可用");
    }

    const commonPaths = [
      `${os.homedir()}/.local/share/Steam/steamapps/common`,
      `${os.homedir()}/Games`,
      `/opt/games`,
      `/usr/games`,
    ];

    for (const basePath of commonPaths) {
      try {
        const files = await fs.promises.readdir(basePath);
        for (const file of files) {
          const fullPath = path.join(basePath, file);
          const execPath = path.join(fullPath, gameExecutable);
          try {
            await fs.promises.access(execPath, fs.constants.F_OK);
            return execPath;
          } catch (err) {
            // 继续检查
          }
        }
      } catch (err) {
        // 目录不存在，继续检查下一个
      }
    }

    throw new Error(`未找到游戏可执行文件: ${gameExecutable}`);
  }

  // 跨平台游戏路径获取
  async getGamePath(gameConfig) {
    const { executable, appName, registryKey } = gameConfig;
    const errors = [];

    console.log("尝试从数据库中获取游戏路径...");
    try {
      return await this.queryGamePathFromDb(executable);
    } catch (dbErr) {
      console.warn("数据库查询失败，尝试平台特定的路径检测:", dbErr);
      errors.push(dbErr);
    }

    // 根据平台尝试不同的检测方法
    try {
      if (this.platform === "win32" && registryKey) {
        const installPath = await this.queryWindowsRegistry(registryKey);
        return path.join(installPath, "Client", "Saved", "Logs", "Client.log");
      } else if (this.platform === "darwin" && appName) {
        const appPath = await this.queryMacOSGamePaths(appName);
        return path.join(
          appPath,
          "Contents",
          "Resources",
          "Client",
          "Saved",
          "Logs",
          "Client.log"
        );
      } else if (this.platform === "linux" && executable) {
        const execPath = await this.queryLinuxGamePaths(executable);
        return path.join(
          path.dirname(execPath),
          "Client",
          "Saved",
          "Logs",
          "Client.log"
        );
      }
    } catch (platformErr) {
      errors.push(platformErr);
    }

    // 如果所有方法都失败，抛出综合错误
    throw new Error(
      `无法自动定位游戏路径，请在游戏库中手动导入游戏信息\n失败原因:\n- ${errors.join(
        "\n- "
      )}`
    );
  }

  // Windows 注册表值查询辅助方法
  queryRegistryValue(regPath, keyName) {
    return new Promise((resolve, reject) => {
      const iconv = require("iconv-lite");
      const command = `reg query "${regPath}" /v ${keyName}`;
      exec(command, { encoding: "binary" }, (err, stdout, stderr) => {
        if (err || stderr) {
          return reject(
            `注册表查询失败（${regPath}）: ${
              iconv.decode(stderr, "gbk") || err.message
            }`
          );
        }

        const decodedOutput = iconv.decode(
          Buffer.from(stdout, "binary"),
          "gbk"
        );
        const match = decodedOutput.match(
          new RegExp(`${keyName}\\s+REG_SZ\\s+(.+)`)
        );
        if (match) {
          resolve(match[1].trim());
        } else {
          reject(`注册表值（${keyName}）未找到（${regPath}）`);
        }
      });
    });
  }
}

module.exports = { PlatformGamePathDetector };
