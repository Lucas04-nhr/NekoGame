const Database = require("better-sqlite3");
const axios = require("axios");
const { ipcMain } = require("electron");
const path = require("path");

const db = new Database(path.join(process.env.NEKO_GAME_FOLDER_PATH, "neko_game.db"));

const DEFAULT_PATHS = [
    "https://gitee.com/sunmmerneko/utils/raw/master/info/gacha/",
    "https://raw.githubusercontent.com/Summer-Neko/utils/main/info/gacha/",
];

// 获取自定义路径或默认路径
function getCustomPath() {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'customPath'").get();
    return row?.value || null;
}

// 设置自定义路径
function setCustomPath(value) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('customPath', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(value, value);
}

// 删除自定义路径（恢复默认路径）
function resetCustomPath() {
    db.prepare("DELETE FROM settings WHERE key = 'customPath'").run();
}

// 获取游戏数据
async function fetchGameData(repo) {
    const customPath = getCustomPath();
    const paths = customPath ? [customPath, ...DEFAULT_PATHS] : DEFAULT_PATHS;
    const maxRetries = 3; // 每个路径的最大重试次数

    for (const path of paths) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await axios.get(`${path}${repo}`, { timeout: 4000 });
                return response.data; // 成功时返回数据
            } catch (err) {
                console.error(`第 ${attempt} 次失败： ${path}${repo}: ${err.message}`);
                if (attempt === maxRetries) {
                    console.error(`已达到最大重试次数 ${path}${repo}`);
                } else {
                    console.log(`重试获取 ${path}${repo}...`);
                }
            }
        }
    }
    global.Notify(false, `所有获取数据的尝试均失败 ${repo}\n可以尝试自己配置数据源，或者检查网络`)
    console.error(`所有尝试均失败 ${repo}`);
    return null; // 所有路径和重试都失败
}


// IPC 通信处理
ipcMain.handle("get-game-data", async (event, repo) => {
    return await fetchGameData(repo);
});

ipcMain.handle("get-custom-path", () => {
    return getCustomPath();
});

ipcMain.handle("set-custom-path", (event, value) => {
    setCustomPath(value);
});

ipcMain.handle("reset-custom-path", () => {
    resetCustomPath();
});
