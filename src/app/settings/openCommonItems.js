const { ipcMain, shell } = require('electron');
const path = require('path');

const commonItemsFile = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'commonItems.json');

ipcMain.handle('open-common-items', async () => {
    try {
        // 使用 shell.openPath 打开文件，使用系统默认的编辑器
        const result = await shell.openPath(commonItemsFile);
        if (result) {
            console.error('打开文件时返回错误:', result);
            global.Notify(false, `打开文件时错误,\n${result}`);
        }
    } catch (error) {
        console.error('无法打开 commonItems.json 文件:', error);
        global.Notify(false, "无法打开 commonItems.json 文件,\n请查看日志获取详情");
    }
});
