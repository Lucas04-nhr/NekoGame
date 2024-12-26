const Database = require("better-sqlite3");
const { app } = require("electron");
const path = require("path");

function loadHardwareAccelerationSettingSync() {
    try {
        const db = new Database(path.join(process.env.NEKO_GAME_FOLDER_PATH, "neko_game.db")); // 替换为实际数据库路径
        const row = db.prepare("SELECT value FROM settings WHERE key = 'hardwareAcceleration'").get();
        return row?.value === "false"; // 如果值为 "false"，启用硬件加速
    } catch (err) {
        console.error("获取硬件加速配置出现问题:", err);
        return true; // 默认启用硬件加速
    }
}

// 加载配置
const hardwareAccelerationDisabled = loadHardwareAccelerationSettingSync();
if (!hardwareAccelerationDisabled) {
    app.disableHardwareAcceleration();
    console.log("禁用了硬件加速");
} else {
    console.log("启用了硬件加速");
}
