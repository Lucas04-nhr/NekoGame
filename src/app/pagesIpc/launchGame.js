const { ipcMain } = require("electron");
const { exec } = require("child_process");
const path = require("path");

ipcMain.handle("launch-game", (event, gamePath) => {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    let command;

    if (platform === "win32") {
      // Windows: 使用 PowerShell
      command = `Start-Process -FilePath "${gamePath}"`;
      exec(command, { shell: "powershell.exe" }, (error) => {
        if (error) {
          console.error(`启动游戏失败: ${error.message}`);
          reject(error);
        } else {
          console.log(`游戏启动成功: ${gamePath}`);
          resolve(true);
        }
      });
    } else if (platform === "darwin") {
      // macOS: 使用 open 命令
      command = `open "${gamePath}"`;
      exec(command, (error) => {
        if (error) {
          console.error(`启动游戏失败: ${error.message}`);
          reject(error);
        } else {
          console.log(`游戏启动成功: ${gamePath}`);
          resolve(true);
        }
      });
    }
  });
});
