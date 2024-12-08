const { ipcMain, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');
const {db} = require("../../../app/database");

// 改成从数据库中获取路径
function queryGamePathFromDb() {
    return new Promise((resolve, reject) => {
        const query = "SELECT path FROM games WHERE path LIKE '%ZenlessZoneZero.exe%'";
        db.get(query, (err, row) => {
            if (err) {
                global.Notify(false, `数据库查询失败: ${err.message}`)
                return reject(`数据库查询失败: ${err.message}`);
            }
            if (row && row.path) {
                const extractedPath = row.path.split('ZenlessZoneZero.exe')[0].trim();
                // 验证路径是否存在
                fs.access(extractedPath, fs.constants.F_OK, (accessErr) => {
                    if (accessErr) {
                        return reject(`游戏路径无效，请检查（路径: ${extractedPath}）`);
                    }
                    resolve(extractedPath);
                });
            } else {
                global.Notify(false, 'ZZZ需要手动录入游戏库，\n请检查确保添加的是ZenlessZoneZero.exe')
                reject('绝区零需要手动录入游戏库，请检查确保添加的是ZenlessZoneZero.exe');
            }
        });
    });
}

// 动态获取缓存文件夹版本
async function getCacheVersion() {
    const defaultVersion = '2.31.1.0'; // 默认版本号
    const remoteUrl = `https://gitee.com/sunmmerneko/utils/raw/master/getUrl/version-ZZZ.json?_=${Date.now()}`;
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
                    resolve(json.zzz_cache_version || defaultVersion);
                } catch (e) {
                    console.error('远程版本配置信息解析失败，使用默认版本:', defaultVersion);
                    resolve(defaultVersion);
                }
            });
        }).on('error', (err) => {
            global.Notify(false, `无法获取远程配置信息，使用默认版本\n${defaultVersion}\n${err.message}`);
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
ipcMain.handle('getZZZLink', async () => {
    return await getZZZUrl();
});

async function getZZZUrl(){
    try {
        const gameDir = await queryGamePathFromDb();
        if (!gameDir) {
            return { success: false, message: '无法获取游戏路径，绝区零暂时不支持动态获取，需要先导入游戏\n游戏名: ZenlessZoneZero.exe' };
        }

        const cacheVersion = await getCacheVersion(); // 获取缓存文件夹版本
        const cacheFilePath = path.join(gameDir, 'ZenlessZoneZero_Data','webCaches', cacheVersion, 'Cache', 'Cache_Data', 'data_2');
        if (!fs.existsSync(cacheFilePath)) {
            return { success: false, message: `未找到缓存文件夹，请确保游戏已启动并生成缓存 :${cacheFilePath}。` };
        }
        const wishLink = extractGachaLogUrl(cacheFilePath);
        if (!wishLink) {
            return { success: false, message: '未找到调频记录链接，请确保您已打开调频记录页面。' };
        }
        clipboard.writeText(wishLink);
        return { success: true, message: `祈愿记录链接已复制到剪贴板！\n${wishLink}` };
    } catch (error) {
        console.error('获取祈愿纪录失败:', error.message);
        return { success: false, message: `操作失败: ${error.message}` };
    }
}

module.exports = { getZZZUrl }
