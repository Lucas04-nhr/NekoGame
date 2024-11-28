const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const iconv = require('iconv-lite');

const db = new sqlite3.Database(path.join(process.env.NEKO_GAME_FOLDER_PATH, "neko_game.db"), (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("Connected to the database.");
    }
});

// 注册表路径列表
const registryPaths = [
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKEY_CURRENT_USER\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
];

// 执行 REG QUERY 命令
function queryRegistryValue(regPath, keyName) {
    return new Promise((resolve, reject) => {
        const command = `reg query "${regPath}" /v ${keyName}`;
        exec(command, { encoding: 'binary' }, (err, stdout, stderr) => {
            if (err || stderr) {
                return reject(`注册表查询失败（${regPath}）: ${iconv.decode(stderr, 'gbk') || err.message}`);
            }

            // 将 stdout 从 GBK 转换为 UTF-8
            const decodedOutput = iconv.decode(Buffer.from(stdout, 'binary'), 'gbk');

            // 提取值
            const match = decodedOutput.match(new RegExp(`${keyName}\\s+REG_SZ\\s+(.+)`));
            if (match) {
                resolve(match[1].trim());
            } else {
                reject(`注册表值（${keyName}）未找到（${regPath}）`);
            }
        });
    });
}

// 从数据库查询路径并验证其有效性
function queryGamePathFromDb() {
    return new Promise((resolve, reject) => {
        const query = "SELECT path FROM games WHERE path LIKE '%Wuthering Waves.exe%'";
        db.get(query, (err, row) => {
            if (err) {
                return reject(`数据库查询失败: ${err.message}`);
            }
            if (row && row.path) {
                const extractedPath = row.path.split('Wuthering Waves.exe')[0].trim();
                const logFilePath = path.join(extractedPath, 'Client', 'Saved', 'Logs', 'Client.log');

                // 验证路径是否存在
                fs.access(logFilePath, fs.constants.F_OK, (accessErr) => {
                    if (accessErr) {
                        return reject(`游戏路径无效，日志文件不存在，请检查（路径: ${logFilePath}）`);
                    }
                    resolve(logFilePath);
                });
            } else {
                reject('非国服官方启动器需要手动录入游戏库，请检查确保添加的是Wuthering Waves.exe。');
            }
        });
    });
}

// 获取游戏路径
async function getGamePath() {
    const errors = []; // 存储错误信息
    for (const basePath of registryPaths) {
        const fullPath = `${basePath}\\KRInstall Wuthering Waves`;
        console.log(`查询路径: ${fullPath}`);
        try {
            const installPath = await queryRegistryValue(fullPath, 'InstallPath');
            console.log(`找到路径: ${installPath}`);
            return path.join(installPath, 'Wuthering Waves Game', 'Client', 'Saved', 'Logs', 'Client.log');
        } catch (err) {
            console.warn(err);
            errors.push(err);
        }
    }

    console.log("尝试从数据库中获取路径...");
    try {
        return await queryGamePathFromDb();
    } catch (err) {
        errors.push(err);
        throw new Error(`未找到有效的游戏路径，失败原因如下:\n- ${errors.join('\n- ')}`);
    }
}

// 读取日志文件并提取祈愿链接
function extractGachaUrl(logFilePath) {
    const tempLogFilePath = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'Client_temp.log'); // 使用全局定义的临时路径

    return new Promise((resolve, reject) => {
        // 尝试将日志文件复制到临时目录
        fs.copyFile(logFilePath, tempLogFilePath, (copyErr) => {
            if (copyErr) {
                return reject(`无法复制日志文件（路径: ${logFilePath}），可能不存在: ${copyErr.message}`);
            }
            // 从临时文件读取内容
            fs.readFile(tempLogFilePath, 'utf8', (readErr, data) => {
                fs.unlink(tempLogFilePath, (unlinkErr) => {
                    if (unlinkErr) console.warn('删除临时文件失败:', unlinkErr.message);
                });
                if (readErr) {
                    return reject(`读取日志文件失败（路径: ${tempLogFilePath}）: ${readErr.message}`);
                }
                // 使用正则提取符合模式的 URL
                const urlRegex = /https:\/\/aki-gm-resources\.aki-game\.com\/aki\/gacha\/index\.html#\/record\?[^ ]+/g;
                const matches = data.match(urlRegex);

                if (matches && matches.length > 0) {
                    let gachaUrl = matches[matches.length - 1]; // 获取最后一个匹配的 URL
                    // 清理 URL 中多余的部分
                    gachaUrl = gachaUrl.split('"')[0];
                    resolve(gachaUrl);
                } else {
                    reject('未找到祈愿链接');
                }
            });
        });
    });
}

module.exports = { getGamePath, extractGachaUrl };
