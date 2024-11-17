const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// 注册表路径列表
const registryPaths = [
    'HKEY_CURRENT_USER\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
];

// 执行 REG QUERY 命令
function queryRegistryValue(regPath, keyName) {
    return new Promise((resolve, reject) => {
        const command = `reg query "${regPath}" /v ${keyName}`;
        exec(command, { encoding: 'utf8' }, (err, stdout, stderr) => {
            if (err || stderr) {
                return reject(new Error(`查询注册表失败: ${stderr || err.message}`));
            }

            // 提取值
            const match = stdout.match(new RegExp(`${keyName}\\s+REG_SZ\\s+(.+)`));
            if (match) {
                resolve(match[1].trim());
            } else {
                reject(new Error('未找到指定值'));
            }
        });
    });
}

// 获取游戏路径
async function getGamePath() {
    for (const basePath of registryPaths) {
        const fullPath = `${basePath}\\KRInstall Wuthering Waves`;
        console.log(`查询路径: ${fullPath}`);
        try {
            const installPath = await queryRegistryValue(fullPath, 'InstallPath');
            console.log(`找到路径: ${installPath}`);
            return installPath;
        } catch (err) {
            console.warn(`路径 ${fullPath} 查询失败: ${err.message}`);
        }
    }
    throw new Error('未找到游戏安装路径');
}

// 读取日志文件并提取祈愿链接
function extractGachaUrl(gamePath) {
    const logFilePath = path.join(gamePath, 'Wuthering Waves Game', 'Client', 'Saved', 'Logs', 'Client.log');
    return new Promise((resolve, reject) => {
        fs.readFile(logFilePath, 'utf8', (err, data) => {
            if (err) return reject(new Error('读取日志文件失败'));

            // 使用正则提取符合模式的 URL
            const urlRegex = /https:\/\/aki-gm-resources\.aki-game\.com\/aki\/gacha\/index\.html#\/record\?[^ ]+/g;
            const matches = data.match(urlRegex);

            if (matches && matches.length > 0) {
                let gachaUrl = matches[matches.length - 1];  // 获取最后一个匹配的 URL

                // 清理 URL 中多余的部分（去除 JSON 数据或其他无关部分）
                // 假设 `resources_id` 后面是有多余的 JSON 数据，将其删除
                gachaUrl = gachaUrl.split('"')[0];  // 清理掉不需要的部分
                resolve(gachaUrl);
            } else {
                reject(new Error('未找到祈愿链接'));
            }
        });
    });
}

module.exports = { getGamePath, extractGachaUrl };
