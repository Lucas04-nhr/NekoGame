const fs = require('fs');
const { app, ipcMain, dialog } = require('electron');
const path = require('path');
const fse = require('fs-extra');

// 获取用户数据文件夹路径
const userDataPath = app.getPath('userData');
const customPathFile = path.join(userDataPath, 'customDataPath.json');

// 默认路径
const defaultDataPath = path.join(userDataPath, 'NekoGame');

// 确保默认路径存在
if (!fs.existsSync(defaultDataPath)) {
    fs.mkdirSync(defaultDataPath, { recursive: true });
}

// 获取当前数据路径函数
function getDataPath() {
    if (fs.existsSync(customPathFile)) {
        try {
            const { currentPath } = JSON.parse(fs.readFileSync(customPathFile, 'utf-8'));
            if (fs.existsSync(currentPath)) {
                return currentPath;
            }
        } catch (error) {
            console.error('读取自定义路径失败，使用默认路径:', error.message);
        }
    }
    return defaultDataPath;
}

// 初始化数据路径
process.env.NEKO_GAME_FOLDER_PATH = getDataPath();

// 保存配置文件函数
function savePathConfig({ currentPath, toDeletePath }) {
    const config = { currentPath, toDeletePath };
    fs.writeFileSync(customPathFile, JSON.stringify(config), 'utf-8');
}

// 复制文件夹函数
async function copyNekoGameFolder(source, destination) {
    try {
        await fse.copy(source, destination, { overwrite: true });
        console.log(`成功将文件夹从 ${source} 复制到 ${destination}`);
    } catch (error) {
        console.error(`文件夹复制失败: ${error.message}`);
        // 如果复制失败，删除目标文件夹
        try {
            await fse.remove(destination);
            console.log(`复制失败后清理目标文件夹: ${destination}`);
        } catch (cleanupError) {
            console.error(`清理目标文件夹失败: ${cleanupError.message}`);
        }
        throw new Error(`文件夹复制失败\n${error.message}`);
    }
}

// 删除文件夹函数
async function deleteNekoGameFolder(folderPath) {
    try {
        await fse.remove(folderPath);
        console.log(`成功删除文件夹: ${folderPath}`);
    } catch (error) {
        console.error(`删除文件夹失败: ${error.message}`);
    }
}

// 启动时检查并删除上一次路径
function deletePreviousPathOnStartup() {
    if (fs.existsSync(customPathFile)) {
        try {
            const { toDeletePath, currentPath } = JSON.parse(fs.readFileSync(customPathFile, 'utf-8'));
            if (toDeletePath && toDeletePath !== currentPath && fs.existsSync(toDeletePath)) {
                console.log(`正在删除上一次路径: ${toDeletePath}`);
                deleteNekoGameFolder(toDeletePath);
                // 清除 `toDeletePath`
                savePathConfig({ currentPath, toDeletePath: null });
            }
        } catch (error) {
            console.error('删除上一次路径失败:', error.message);
        }
    }
}

// 在应用启动时调用
deletePreviousPathOnStartup();

// IPC 事件处理
// 选择自定义路径
ipcMain.handle('browse-dataFile', async () => {
    let currentPath = process.env.NEKO_GAME_FOLDER_PATH; // 获取当前路径
    // 检查路径是否存在，不存在则设置为默认路径
    if (!fs.existsSync(currentPath)) {
        currentPath = app.getPath('userData');
    }
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        defaultPath: currentPath
    });
    if (canceled || filePaths.length === 0) {
        return { success: false, message: '路径选择取消' };
    }

    const selectedBasePath = filePaths[0];
    const newNekoGamePath = path.join(selectedBasePath, 'NekoGame');

    if (currentPath !== newNekoGamePath) {
        // 检查目标路径是否已存在 NekoGame 文件夹
        if (fs.existsSync(newNekoGamePath)) {
            const choice = dialog.showMessageBoxSync({
                type: 'question',
                title: '检测到已有数据',
                message: `目标路径已存在 NekoGame 文件夹，是否直接使用此数据文件夹？\n选择“否”将覆盖目标路径数据。`,
                buttons: ['是', '否'],
                defaultId: 0,
            });

            if (choice === 0) {
                // 用户选择直接使用
                savePathConfig({ currentPath: newNekoGamePath, toDeletePath: null });
                app.relaunch();
                app.exit();
                return { success: true, path: newNekoGamePath, message: '路径已切换，正在重启应用...' };
            }
        }

        // 用户选择覆盖或目标路径不存在
        try {
            // 确保目标路径存在
            fs.mkdirSync(newNekoGamePath, { recursive: true });

            // 复制文件夹到新路径
            await copyNekoGameFolder(currentPath, newNekoGamePath);

            // 保存路径配置
            savePathConfig({ currentPath: newNekoGamePath, toDeletePath: currentPath });

            // 重新启动应用
            app.relaunch();
            app.exit();

            return { success: true, path: newNekoGamePath, message: '路径已更新，正在重启应用...' };
        } catch (error) {
            console.error(`路径切换失败: ${error.message}`);
            return { success: false, message: `路径切换失败: ${error.message}` };
        }
    }

    return { success: true, path: newNekoGamePath };
});

// 恢复默认路径
ipcMain.handle('reset-dataFile', async () => {
    const currentPath = process.env.NEKO_GAME_FOLDER_PATH;
    if (currentPath !== defaultDataPath) {
        try {
            // 确保默认路径存在
            fs.mkdirSync(defaultDataPath, { recursive: true });

            // 复制文件夹到默认路径
            await copyNekoGameFolder(currentPath, defaultDataPath);

            // 保存路径配置
            savePathConfig({ currentPath: defaultDataPath, toDeletePath: currentPath });

            // 重新启动应用
            app.relaunch();
            app.exit();

            return { success: true, path: defaultDataPath, message: '已恢复默认路径，正在重启应用...' };
        } catch (error) {
            console.error('恢复默认路径失败:', error.message);
            return { success: false, message: `恢复默认路径失败: ${error.message}` };
        }
    }

    return { success: true, path: defaultDataPath };
});

// 获取当前路径
ipcMain.handle('get-dataFile-path', async () => {
    return { path: getDataPath() };
});
