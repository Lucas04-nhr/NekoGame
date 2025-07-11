const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');

// 获取数据路径
const dataPath = process.env.NEKO_GAME_FOLDER_PATH;
const commonItemsFile = path.join(dataPath, 'commonItems.json');

// 定义初始数据
const defaultCommonItems = {
    "zh-cn": ["安可", "卡卡罗", "凌阳", "鉴心", "维里奈", "千古洑流", "浩境粼光", "停驻之烟", "擎渊怒涛","漪澜浮录",
        "布洛妮娅", "瓦尔特", "克拉拉", "杰帕德", "姬子", "白露", "彦卿", "时节不居", "但战斗还未结束", "制胜的瞬间", "如泥酣眠", "银河铁道之夜", "无可取代的东西", "以世界之名",
        "七七", "莫娜", "刻晴", "迪卢克", "琴","提纳里","迪希雅","天空之脊", "和璞鸢", "四风原典", "天空之卷", "天空之翼", "阿莫斯之弓", "狼的末路", "天空之傲", "天空之刃", "风鹰剑",
        "「11号」","猫又", "格莉丝", "珂蕾妲", "莱卡恩", "丽娜", "钢铁肉垫", "硫磺石", "拘缚者", "燃狱齿轮", "啜泣摇篮", "嵌合编译器"],
    "zh-tw": ["安可", "卡卡羅", "凌陽", "鑑心", "維里奈", "千古洑流", "浩境粼光", "停駐之煙", "擎淵怒濤", "漪瀾浮錄",
        "布洛妮婭", "瓦爾特", "克拉拉", "傑帕德", "姬子", "白露", "彥卿", "時節不居", "但戰鬥還未結束", "制勝的瞬間", "如泥酣眠", "銀河鐵道之夜", "無可取代的東西", "以世界之名",
        "七七", "莫娜", "刻晴", "迪盧克", "琴", "提納里", "迪希雅", "天空之脊", "和璞鴻", "四風原典", "天空之卷", "天空之翼", "阿莫斯之弓", "狼的末路", "天空之傲", "天空之刃", "風鷹劍",
        "「11號」", "貓又", "格莉絲", "珂蕾妲", "萊卡恩", "麗娜", "鋼鐵肉墊", "硫磺石", "拘束者", "燃獄齒輪", "啜泣搖籃", "嵌合編譯器"]
};

async function initializeCommonItems() {
    try {
        if (!fs.existsSync(commonItemsFile)) {
            await fs.promises.writeFile(commonItemsFile, JSON.stringify(defaultCommonItems, null, 2), 'utf8');
            console.log('commonItems.json 文件已创建');
        }
    } catch (error) {
        console.error('初始化 commonItems 文件失败:', error);
    }
}

initializeCommonItems();

async function loadOrCreateCommonItems() {
    try {
        // 检测文件是否存在
        if (!fs.existsSync(commonItemsFile)) {
            // 文件不存在，则写入初始数据
            await fs.promises.writeFile(commonItemsFile, JSON.stringify(defaultCommonItems, null, 2), 'utf8');
            console.log('commonItems.json 文件已创建');
            return defaultCommonItems;
        } else {
            // 文件存在，读取数据
            const data = await fs.promises.readFile(commonItemsFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('加载或创建 commonItems 文件失败:', error);
        // 出现错误时默认返回初始数据
        return defaultCommonItems;
    }
}

ipcMain.handle('get-common-items', async (event, lang) => {
  const commonItemsData = await loadOrCreateCommonItems();
  console.log('传入的常驻记录语言版本是', lang);
  // 如果传入的 lang 对应的数组不存在，则使用默认简体 zh-cn
  return commonItemsData[lang] || commonItemsData['zh-cn'];
});
