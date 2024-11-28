const { ipcMain, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

function getGamePath() {
    const appData = path.join(os.homedir(), 'AppData', 'LocalLow', 'miHoYo', '崩坏：星穹铁道');
    const logPaths = [
        path.join(appData, 'Player.log'),
        path.join(appData, 'Player-prev.log'),
    ];
    for (const logPath of logPaths) {
        if (fs.existsSync(logPath)) {
            const content = fs.readFileSync(logPath, 'utf-8');
            const match = content.match(/Loading player data from (.+?)data\.unity3d/);
            if (match) {
                return match[1].trim();
            }
        }
    }
    return null;
}

function getLatestCachePath(gamePath) {
    const cacheBasePath = path.join(gamePath, 'webCaches');
    if (!fs.existsSync(cacheBasePath)) return null;
    const folders = fs.readdirSync(cacheBasePath).filter((folder) =>
        /^\d+\.\d+\.\d+\.\d+$/.test(folder)
    );
    let latestCachePath = null;
    let maxVersion = 0;
    folders.forEach((folder) => {
        const version = parseInt(folder.split('.').join(''), 10);
        if (version > maxVersion) {
            maxVersion = version;
            latestCachePath = path.join(cacheBasePath, folder, 'Cache', 'Cache_Data', 'data_2');
        }
    });
    return latestCachePath;
}

function extractGachaLogUrl(cachePath) {
    if (!fs.existsSync(cachePath)) return null;
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

// 添加 IPC 接口
ipcMain.handle('getStarRailUrl', async () => {
    const gamePath = getGamePath();
    if (!gamePath) return { success: false, message: '未找到日志文件，请启动过游戏后再尝试。' };
    const cachePath = getLatestCachePath(gamePath);
    if (!cachePath) return { success: false, message: '未找到缓存文件，请确保你下载了这款游戏。' };
    const gachaUrl = extractGachaLogUrl(cachePath);
    if (!gachaUrl) return { success: false, message: '未找到抽卡记录链接。' };
    clipboard.writeText(gachaUrl);
    return { success: true, message: `获取成功，抽卡记录链接已复制到剪贴板。\n${gachaUrl}` };
});
