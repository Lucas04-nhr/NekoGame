const { ipcMain, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

// 动态获取日志路径
function getLogPath() {
    const basePath = path.join(process.env.USERPROFILE, 'AppData', 'LocalLow', 'miHoYo');
    const globalPath = path.join(basePath, 'Genshin Impact', 'output_log.txt');
    const chinaPath = path.join(basePath, '原神', 'output_log.txt');

    if (fs.existsSync(globalPath)) return globalPath;
    if (fs.existsSync(chinaPath)) return chinaPath;

    return null;
}

// 从日志文件中解析游戏路径
function extractGameDir(logContent) {
    const match = logContent.match(/([A-Z]:\\.+?\\(GenshinImpact_Data|YuanShen_Data))/);
    if (match) {
        return match[1];
    }
    return null;
}

// 动态获取缓存文件夹版本
async function getCacheVersion() {
    const defaultVersion = '2.31.0.0'; // 默认版本号
    const remoteUrl = `https://raw.githubusercontent.com/Summer-Neko/utils/main/GetUrl/version-Genshin.json?_=${Date.now()}`;
    const options = {
        headers: {
            'Cache-Control': 'no-cache'
        }
    };
    return new Promise((resolve) => {
        https.get(remoteUrl, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.genshin_cache_version || defaultVersion);
                } catch (e) {
                    console.error('远程版本配置信息解析失败，使用默认版本:', defaultVersion);
                    resolve(defaultVersion);
                }
            });
        }).on('error', (err) => {
            console.error('无法获取远程配置信息，使用默认版本:', defaultVersion, err.message);
            resolve(defaultVersion);
        });
    });
}


// 从缓存文件中提取祈愿记录链接
function extractGachaLogUrl(cachePath) {
    if (!fs.existsSync(cachePath)) {
        throw new Error('缓存文件不存在，请确认游戏已经启动过。');
    }

    const cacheData = fs.readFileSync(cachePath, 'latin1');
    const entries = cacheData.split('1/0/');

    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.includes('http') && entry.includes('getGachaLog')) {
            const rawUrl = entry.split('\0')[0];
            return simplifyUrl(rawUrl);
        }
    }

    return null;
}

function simplifyUrl(rawUrl) {
    const parsed = url.parse(rawUrl, true);
    const allowedKeys = ['authkey', 'authkey_ver', 'sign_type', 'game_biz', 'lang'];
    const filteredQuery = Object.keys(parsed.query)
        .filter((key) => allowedKeys.includes(key))
        .reduce((obj, key) => {
            obj[key] = parsed.query[key];
            return obj;
        }, {});

    return `${parsed.protocol}//${parsed.host}${parsed.pathname}?${new url.URLSearchParams(filteredQuery)}`;
}

// IPC 接口
ipcMain.handle('getGenshinWishLink', async () => {
    const logPath = getLogPath();
    if (!logPath) {
        return { success: false, message: '未找到原神日志文件，请确认游戏是否启动过。' };
    }

    try {
        const logContent = fs.readFileSync(logPath, 'utf-8');
        const gameDir = extractGameDir(logContent);
        if (!gameDir) {
            return { success: false, message: '无法解析游戏路径，请确保日志文件完整。或前往项目地址反馈信息' };
        }

        const cacheVersion = await getCacheVersion(); // 获取缓存文件夹版本
        const cacheFilePath = path.join(gameDir, 'webCaches', cacheVersion, 'Cache', 'Cache_Data', 'data_2');
        if (!fs.existsSync(cacheFilePath)) {
            return { success: false, message: `未找到缓存文件夹，请确保游戏已启动并生成缓存 :${cacheFilePath}。` };
        }

        const wishLink = extractGachaLogUrl(cacheFilePath);
        if (!wishLink) {
            return { success: false, message: '未找到祈愿记录链接，请确保您已打开祈愿记录页面。' };
        }

        clipboard.writeText(wishLink);
        return { success: true, message: `祈愿记录链接已复制到剪贴板！\n${wishLink}` };
    } catch (error) {
        console.error('Error during wish link retrieval:', error.message);
        return { success: false, message: `操作失败: ${error.message}` };
    }
});
