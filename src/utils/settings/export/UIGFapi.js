const axios = require("axios");
const fs = require("fs");
const path = require("path");

// 缓存文件路径
const CACHE_PATH = path.join(process.env.NEKO_GAME_FOLDER_PATH, "export", "itemCache.json");

let itemCache = {};

// 加载缓存
if (fs.existsSync(CACHE_PATH)) {
    try {
        itemCache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
    } catch (error) {
        console.error("加载缓存失败:", error.message);
        itemCache = {};
    }
}

// 保存缓存到文件
function saveCache() {
    try {
        const outputDir = path.dirname(CACHE_PATH);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(CACHE_PATH, JSON.stringify(itemCache, null, 4), "utf-8");
    } catch (error) {
        console.error("保存缓存失败:", error.message);
    }
}

// 查询 item_id
async function fetchItemId(name, lang = "chs", game = "genshin") {
    const url = "https://api.uigf.org/translate/";
    let retries = 0;

    // 检查缓存
    if (itemCache[name]) {
        console.log(`缓存命中: ${name} -> ${itemCache[name]}`);
        return itemCache[name];
    }

    while (retries < 3) {
        try {
            const requestBody = {
                lang: lang,
                type: "normal",
                game: game,
                item_name: name
            };

            // 发送请求
            const response = await axios.post(url, requestBody);

            if (response.data && response.data.item_id) {
                const itemId = response.data.item_id;
                itemCache[name] = itemId; // 缓存结果
                saveCache();
                global.Notify(true, `item_id未命中，已经通过UIGFapi获取\n已经成功保存在导出表中\n请求:${name} 回应:${itemId}`);
                return itemId;
            } else {
                throw new Error(
                    `未找到 item_id for name: ${name}, 返回数据: ${JSON.stringify(response.data)}`
                );
            }
        } catch (error) {
            retries++;
            console.error(`获取 item_id 失败 (尝试 ${retries}/3):`, error.message);
            await new Promise((resolve) => setTimeout(resolve, 300)); // 重试间隔
        }
    }
    throw new Error(`无法获取 item_id for name: ${name}`);
}

// 查询 name
async function fetchItemName(itemId, lang = "chs", game = "genshin") {
    const url = "https://api.uigf.org/translate/";
    let retries = 0;

    // 检查缓存
    const cachedName = Object.keys(itemCache).find(key => itemCache[key] === itemId);
    if (cachedName) {
        console.log(`缓存命中: ${itemId} -> ${cachedName}`);
        return cachedName;
    }

    while (retries < 3) {
        try {
            const requestBody = {
                lang: lang,
                type: "reverse",
                game: game,
                item_id: itemId
            };

            console.log(`查询 name 中：${JSON.stringify(requestBody)}`);

            // 发送请求
            const response = await axios.post(url, requestBody, {
                headers: { "Content-Type": "application/json" }
            });

            if (response.data && response.data.item_name) {
                const itemName = response.data.item_name;
                itemCache[itemName] = itemId; // 缓存结果
                saveCache(); // 保存到文件
                global.Notify(true, `name未命中，已经通过UIGFapi获取\n已经成功保存在导出表中\n请求:${itemId} 回应:${itemName}`);
                return itemName;
            } else {
                throw new Error(
                    `未找到 name for item_id: ${itemId}, 返回数据: ${JSON.stringify(response.data)}`
                );
            }
        } catch (error) {
            retries++;
            console.error(`获取 name 失败 (尝试 ${retries}/3):`, error.message);
            await new Promise((resolve) => setTimeout(resolve, 300)); // 重试间隔
        }
    }
    throw new Error(`无法获取 name for item_id: ${itemId}`);
}

module.exports = { fetchItemId, fetchItemName, itemCache };
