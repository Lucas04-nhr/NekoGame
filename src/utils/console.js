const fs = require('fs');
const path = require('path');

// 获取日志文件路径
const logDirectory = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'logs');
const logFileName = 'NekoGame';
const maxLogSize = 5 * 1024 * 1024;
const logRetentionDays = 8; // 保留 8 天的日志
const currentDate = new Date().toISOString().split('T')[0];
const logFilePath = path.join(logDirectory, `${logFileName}-${currentDate}.log`); // 按日期命名日志文件

// 确保日志文件夹存在
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}
// 创建写入流
let logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
// 检查日志文件大小并进行轮转
function checkLogFileSize() {
    fs.stat(logFilePath, (err, stats) => {
        if (err) return;
        // 如果日志文件大小超过了最大值，则进行轮转
        if (stats.size >= maxLogSize) {
            const archivedLogFilePath = path.join(logDirectory, `${logFileName}-${currentDate}-${Date.now()}.log`);
            fs.renameSync(logFilePath, archivedLogFilePath); // 将当前日志文件重命名并归档
            // 重新创建新的日志文件
            logStream.close();
            logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
            deleteOldLogs(); // 删除旧的日志文件
        }
    });
}

// 删除超过保留期限的日志文件
function deleteOldLogs() {
    fs.readdir(logDirectory, (err, files) => {
        if (err) return;

        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(logDirectory, file);
            const stats = fs.statSync(filePath);
            // 如果文件是日志文件且超过保留期限，则删除
            if (file.startsWith(logFileName) && stats.isFile()) {
                const fileAgeDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24); // 计算文件的年龄（天）
                if (fileAgeDays > logRetentionDays) {
                    fs.unlinkSync(filePath); // 删除过期日志文件
                    console.log(`Deleted old log file: ${file}`);
                }
            }
        });
    });
}

// 重定向 console.log、console.error 输出到日志文件
console.log = function (message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] LOG: ${message}\n`);
    process.stdout.write(`[${timestamp}] LOG: ${message}\n`); // 在控制台显示
    checkLogFileSize(); // 每次写日志后检查日志文件大小
};

console.error = function (message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ERROR: ${message}\n`);
    process.stderr.write(`[${timestamp}] ERROR: ${message}\n`);
    checkLogFileSize();
};

console.warn = function (message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] WARN: ${message}\n`);
    process.stderr.write(`[${timestamp}] WARN: ${message}\n`);
    checkLogFileSize();
};

console.info = function (message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] INFO: ${message}\n`);
    process.stdout.write(`[${timestamp}] INFO: ${message}\n`);
    checkLogFileSize(); // 每次写日志后检查日志文件大小
};
