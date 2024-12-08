const { ipcMain } = require('electron');
const path = require("path");
const { execFile } = require('child_process');

// 启动进程
ipcMain.handle('launch-game', (event, gamePath) => {
    return new Promise((resolve, reject) => {
        try {
            const gameDir = path.dirname(gamePath);
            const gameFile = path.basename(gamePath);
            // 使用 execFile 来直接执行可执行文件
            execFile(gameFile, [], { cwd: gameDir, env: process.env, detached: true }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`打开游戏失败 ${gamePath}:`, error);
                    reject(error);
                    return;
                }
                // 输出调试信息（可选）
                if (stdout) {
                    console.log(`stdout: ${stdout}`);
                }
                if (stderr) {
                    console.error(`stderr: ${stderr}`);
                }
                // 游戏打开成功
                global.Notify('游戏启动成功')
                console.log(`游戏打开成功: ${gamePath}`);
                resolve(true);
            });
        } catch (error) {
            console.error(`打开游戏失败: ${error.message}`);
            reject(error);
        }
    });
});
