const { ipcMain} = require('electron');
const path = require("path");
const { spawn } = require('child_process');

// 启动进程
ipcMain.handle('launch-game', (event, gamePath) => {
    return new Promise((resolve, reject) => {
        try {
            const gameDir = path.dirname(gamePath);
            const gameFile = path.basename(gamePath);

            // 使用 shell: true 并确保路径包含在引号内
            const gameProcess = spawn(`"${gameFile}"`, { cwd: gameDir, shell: true, detached: true });

            gameProcess.on('error', (error) => {
                console.error(`打开游戏失败 ${gamePath}:`, error);
                reject(error);
            });

            // 在进程启动后立即返回成功
            console.log(`游戏打开成功: ${gamePath}`);
            resolve(true); // 立即返回成功状态

            gameProcess.unref(); // 让游戏进程独立运行，不等待其退出
        } catch (error) {
            console.error(`打开游戏失败: ${error.message}`);
            reject(error);
        }
    });
});
