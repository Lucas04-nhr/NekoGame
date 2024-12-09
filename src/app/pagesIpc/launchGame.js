const { ipcMain } = require('electron');
const { exec } = require('child_process');

ipcMain.handle('launch-game', (event, gamePath) => {
    return new Promise((resolve, reject) => {
        exec(`Start-Process -FilePath "${gamePath}"`, { shell: 'powershell.exe' }, (error) => {
            if (error) {
                console.error(`启动游戏失败: ${error.message}`);
                reject(error);
            } else {
                console.log(`游戏启动成功: ${gamePath}`);
                resolve(true);
            }
        });
    });
});
