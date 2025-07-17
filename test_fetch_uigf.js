// 测试 fetchUIGF.js 功能的脚本
const path = require("path");
const fs = require("fs");

// 模拟环境变量
process.env.NEKO_GAME_FOLDER_PATH = path.join(__dirname, "test_data");

// 引入我们的模块
const {
  downloadUIGFDict,
  downloadAllUIGFDicts,
  checkDictExists,
  loadDict,
} = require("./src/utils/settings/export/fetchUIGF");

async function testFetchUIGF() {
  console.log("开始测试 UIGF 字典下载功能...\n");

  // 确保测试目录存在
  if (!fs.existsSync(process.env.NEKO_GAME_FOLDER_PATH)) {
    fs.mkdirSync(process.env.NEKO_GAME_FOLDER_PATH, { recursive: true });
  }

  // 测试单个游戏字典下载
  console.log("=== 测试单个游戏字典下载 ===");
  const genshinResult = await downloadUIGFDict("genshin", "chs");
  console.log(`原神字典下载结果: ${genshinResult ? "成功" : "失败"}\n`);

  // 测试所有游戏字典下载
  console.log("=== 测试所有游戏字典下载 ===");
  const allResults = await downloadAllUIGFDicts("chs");
  console.log("下载结果:", allResults);
  console.log();

  // 测试字典文件检查
  console.log("=== 测试字典文件检查 ===");
  const games = ["genshin", "starrail", "zzz"];
  for (const game of games) {
    const exists = checkDictExists(game, "chs");
    console.log(`${game} 字典文件存在: ${exists}`);
  }
  console.log();

  // 测试字典数据读取
  console.log("=== 测试字典数据读取 ===");
  const genshinDict = loadDict("genshin", "chs");
  if (genshinDict) {
    const itemCount = Object.keys(genshinDict).length;
    console.log(`原神字典加载成功，包含 ${itemCount} 个条目`);

    // 显示前几个条目作为示例
    const items = Object.entries(genshinDict).slice(0, 5);
    console.log("示例条目:");
    items.forEach(([id, name]) => {
      console.log(`  ID: ${id} -> 名称: ${name}`);
    });
  } else {
    console.log("原神字典加载失败");
  }

  console.log("\n测试完成！");

  // 列出生成的文件
  console.log("\n生成的文件:");
  try {
    const files = fs.readdirSync(process.env.NEKO_GAME_FOLDER_PATH);
    files.forEach((file) => {
      const filePath = path.join(process.env.NEKO_GAME_FOLDER_PATH, file);
      const stats = fs.statSync(filePath);
      console.log(`  ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    });
  } catch (error) {
    console.log("  无法列出文件:", error.message);
  }
}

// 运行测试
testFetchUIGF().catch(console.error);
