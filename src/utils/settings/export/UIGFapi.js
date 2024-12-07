const axios = require("axios");

const itemCache = {"沐浴龙血的剑":12302,"以理服人":12305,"黑缨枪":13303,"弹弓":15304,"铁影阔剑":12301,"神射手之誓":15302,"魔导绪论":14301,"昭心":14409,"冷刃":11301,"坎蒂丝":10000072,"翡玉法球":14304,"黎明神剑":11302,
    "罗莎莉亚":10000045,"讨龙英杰谭":14302,"鸦羽弓":15301,"飞天御剑":11306,"西风枪":13407,"绝弦":15402,"七七":10000035,"砂糖":10000043,"西风秘典":14401,"西风大剑":12401,"娜维娅":10000091,"西风剑":11401,"绮良良":10000061,
    "夏沃蕾":10000090,"多莉":10000068,"重云":10000036,"祭礼弓":15403,"诺艾尔":10000034,"珐露珊":10000076,
    "迪奥娜":10000039,"闲云":10000093,"雨裁":12405,"米卡":10000080,"嘉明":10000092,"云堇":10000064,"五郎":10000055,"迪希雅":10000079,"钟剑":12402,"千织":10000094,"笛剑":11402,
    "弓藏":15405,"香菱":10000023,"菲米尼":10000085,"芭芭拉":10000014,"匣里灭辰":13401,"阿蕾奇诺":10000096,"天空之脊":13502,"雷泽":10000020,"托马":10000050,"提纳里":10000069,"班尼特":10000032,"祭残章":14403,
    "匣里龙吟":11405,"希格雯":10000095,"烟绯":10000048,"夏洛蒂":10000088,"卡齐娜":10000100,"辛焱":10000044, "丽莎":10000006,"神里绫华":10000002, "凯亚":10000015, "安柏":10000021, "温迪":10000022, "北斗" :10000023,"魈":10000026,
    "凝光":10000027,"可莉":10000029,"钟离":10000030,"菲谢尔":10000031,"达达利亚":10000033,"甘雨":10000037,"阿贝多":10000038,"莫娜":10000041,
    "迪卢克":10000016,"祭礼大剑":12403,"玛拉妮":10000102,"九条裟罗":10000056,"柯莱":10000067,"希诺宁":10000103,"纳西妲":10000073,"行秋":10000025,"久岐忍":10000065,"天空之傲":12501}

 // 缓存 item_id

async function fetchItemId(name, lang = "chs", game = "genshin") {
    const url = "https://api.uigf.org/translate/";
    let retries = 0;
    console.log(JSON.stringify(itemCache));

    while (retries < 3) {
        try {
            // 构造请求参数
            const requestBody = {
                lang: lang, // 语言，默认中文简体
                type: "normal", // 翻译为物品 ID
                game: game, // 游戏名称
                item_name: name // 需要翻译的物品名称
            };

            console.log(`查询 item_id 中：${JSON.stringify(requestBody)}`);

            // 发送 POST 请求
            const response = await axios.post(url, requestBody);

            if (response.data && response.data.item_id) {
                // 缓存结果
                itemCache[name] = response.data.item_id;
                return response.data.item_id;
            } else {
                throw new Error(
                    `未找到 item_id for name: ${name}, 返回数据: ${JSON.stringify(
                        response.data
                    )}`
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

async function fetchItemName(itemId, lang = "chs", game = "genshin") {
    const url = "https://api.uigf.org/translate/";
    let retries = 0;

    while (retries < 3) {
        try {
            // 构造请求参数
            const requestBody = {
                lang: lang,
                type: "reverse",
                game: game,
                item_id: itemId
            };

            console.log(`查询 name 中：${JSON.stringify(requestBody)}`);

            // 发送 POST 请求，附加必要头部
            const response = await axios.post(url, requestBody, {
                headers: {
                    "Content-Type": "application/json" // 指定请求体为 JSON 格式
                }
            });

            if (response.data && response.data.item_name) {
                const itemName = response.data.item_name;
                // 缓存结果
                itemCache[itemName] = itemId;
                return itemName;
            } else {
                throw new Error(
                    `未找到 name for item_id: ${itemId}, 返回数据: ${JSON.stringify(
                        response.data
                    )}`
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

module.exports = { fetchItemId, itemCache, fetchItemName };
