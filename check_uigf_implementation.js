#!/usr/bin/env node

// 简单的功能测试脚本
const path = require("path");
const fs = require("fs");

// 检查必要的文件是否存在
const requiredFiles = [
  "src/utils/settings/export/fetchUIGF.js",
  "src/app/settings/uigfDictIpc.js",
  "src/pages/settings.html",
  "src/js/settings.js",
  "src/css/settings.css",
  "src/main.js",
];

console.log("🔍 检查 UIGF 字典功能文件...\n");

let allFilesExist = true;

for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, file);
  const exists = fs.existsSync(fullPath);
  const status = exists ? "✅" : "❌";
  console.log(`${status} ${file}`);

  if (!exists) {
    allFilesExist = false;
  }
}

console.log("\n📋 检查功能实现...\n");

// 检查 fetchUIGF.js 导出的函数
try {
  const fetchUIGF = require("./src/utils/settings/export/fetchUIGF");
  const expectedFunctions = [
    "downloadUIGFDict",
    "downloadAllUIGFDicts",
    "checkDictExists",
    "loadDict",
  ];

  for (const func of expectedFunctions) {
    const exists = typeof fetchUIGF[func] === "function";
    const status = exists ? "✅" : "❌";
    console.log(`${status} fetchUIGF.${func}()`);

    if (!exists) {
      allFilesExist = false;
    }
  }
} catch (error) {
  console.log("❌ 无法加载 fetchUIGF 模块:", error.message);
  allFilesExist = false;
}

// 检查 main.js 中是否引入了 uigfDictIpc
try {
  const mainContent = fs.readFileSync("./src/main.js", "utf8");
  const hasImport = mainContent.includes("uigfDictIpc");
  const status = hasImport ? "✅" : "❌";
  console.log(`${status} main.js 中已引入 uigfDictIpc`);

  if (!hasImport) {
    allFilesExist = false;
  }
} catch (error) {
  console.log("❌ 无法读取 main.js:", error.message);
  allFilesExist = false;
}

// 检查 settings.html 中是否添加了 UI 元素
try {
  const htmlContent = fs.readFileSync("./src/pages/settings.html", "utf8");
  const hasUIElements =
    htmlContent.includes("dict-status") &&
    htmlContent.includes("download-all-dicts");
  const status = hasUIElements ? "✅" : "❌";
  console.log(`${status} settings.html 中已添加字典管理 UI`);

  if (!hasUIElements) {
    allFilesExist = false;
  }
} catch (error) {
  console.log("❌ 无法读取 settings.html:", error.message);
  allFilesExist = false;
}

// 检查 settings.js 中是否添加了相关功能
try {
  const jsContent = fs.readFileSync("./src/js/settings.js", "utf8");
  const hasFunctions =
    jsContent.includes("loadDictStatus") &&
    jsContent.includes("download-all-uigf-dicts");
  const status = hasFunctions ? "✅" : "❌";
  console.log(`${status} settings.js 中已添加字典管理功能`);

  if (!hasFunctions) {
    allFilesExist = false;
  }
} catch (error) {
  console.log("❌ 无法读取 settings.js:", error.message);
  allFilesExist = false;
}

console.log("\n📊 总结:\n");

if (allFilesExist) {
  console.log("🎉 所有文件和功能都已正确实现！");
  console.log("");
  console.log("📝 功能说明:");
  console.log("   1. 支持下载原神、星穹铁道、绝区零的物品字典");
  console.log("   2. 字典文件命名格式: {game}_dict_{lang}.json");
  console.log("   3. 目前支持中文简体(chs)语言");
  console.log('   4. 在设置页面的"数据管理"部分可以管理字典');
  console.log("   5. 支持状态检查、批量下载和手动刷新");
  console.log("");
  console.log("🚀 可以启动应用测试功能了！");
} else {
  console.log("⚠️  检测到一些问题，请检查上述标记为 ❌ 的项目。");
  process.exit(1);
}
