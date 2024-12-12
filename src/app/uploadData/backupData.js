const fs = require('fs').promises;  // 使用 fs.promises 进行异步操作
const path = require('path');

// 确保备份文件夹存在
async function ensureBackupFolderExists(filePath) {
    const backupFolderPath = path.join(filePath, 'backup');
    try {
        await fs.mkdir(backupFolderPath, { recursive: true });  // 异步创建备份文件夹
        return backupFolderPath;
    } catch (err) {
        console.error('创建备份文件夹失败:', err);
        throw err;
    }
}

function getBackupFilePath(filePath, fileName) {
    const timestamp = new Date().toISOString().replace(/[:T]/g, '_').split('.')[0];
    return path.join(filePath, 'backup', `${fileName}-${timestamp}`);
}

// 清理旧的备份，最多保留10个备份
async function cleanOldBackups(filePath, fileName) {
    const backupFolderPath = path.join(filePath, 'backup');
    try {
        const files = await fs.readdir(backupFolderPath);
        // 筛选符合备份格式的文件
        const filteredFiles = files.filter(file => file.startsWith(fileName) && file.includes('-'));
        const sortedFiles = await Promise.all(
            filteredFiles.map(async (file) => ({
                file,
                mtime: (await fs.stat(path.join(backupFolderPath, file))).mtime,
            }))
        );
        sortedFiles.sort((a, b) => a.mtime - b.mtime);
        while (sortedFiles.length > 10) {
            const { file } = sortedFiles.shift();
            await fs.unlink(path.join(backupFolderPath, file));
            console.log(`已删除旧备份: ${file}`);
        }
    } catch (err) {
        console.error('清理旧备份失败:', err);
    }
}

// 备份当前文件
async function backupFile(localPath, fileName) {
    const dirPath = path.dirname(localPath);
    const backupFolderPath = await ensureBackupFolderExists(dirPath);
    const backupFilePath = getBackupFilePath(dirPath, fileName);

    await fs.copyFile(localPath, backupFilePath);
    console.log(`文件备份成功: ${backupFilePath}`);

    await cleanOldBackups(dirPath, fileName);
}

module.exports = { backupFile };
