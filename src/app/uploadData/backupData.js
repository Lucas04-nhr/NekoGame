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
    const date = new Date();
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const timestamp = date.toLocaleString('en-GB', { timeZone: 'Asia/Shanghai', ...options }).replace(/[/, :]/g, '_');

    // 返回备份路径
    return path.join(filePath, 'backup', `${fileName}-${timestamp}`);
}

// 清理旧的备份，最多保留10个备份
async function cleanOldBackups(filePath, fileName) {
    const backupFolderPath = path.join(filePath, 'backup');
    try {
        // 读取目录并筛选文件
        const files = await fs.readdir(backupFolderPath);

        // 过滤出符合文件名要求的备份文件
        const filteredFiles = files.filter(file => file.startsWith(fileName));

        // 按照文件修改时间排序
        const sortedFiles = filteredFiles.sort((a, b) => {
            const aStat = fs.statSync(path.join(backupFolderPath, a));
            const bStat = fs.statSync(path.join(backupFolderPath, b));
            return aStat.mtime - bStat.mtime;  // 从最旧的开始排序
        });

        // 保留最新的10个备份，删除其余的
        while (sortedFiles.length > 10) {
            const fileToDelete = sortedFiles.shift();
            await fs.unlink(path.join(backupFolderPath, fileToDelete));
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
