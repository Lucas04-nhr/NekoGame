(() => {
    // 确保在绑定事件之前检查元素是否存在
    const minimizeToTray = document.getElementById("minimizeToTray");
    const silentMode = document.getElementById("silentMode");
    const autoLaunch = document.getElementById("autoLaunch");
    const checkErrorsButton = document.getElementById("checkErrors");

    // 加载设置
    if (minimizeToTray && silentMode && autoLaunch) {
        window.electronAPI.loadSettings().then(settings => {
            console.log("加载设置:", settings);
            minimizeToTray.checked = settings.minimizeToTray === "true";
            silentMode.checked = settings.silentMode === "true";
            autoLaunch.checked = settings.autoLaunch === "true";
        });
    }

    // 保存设置变化
    if (minimizeToTray) {
        minimizeToTray.addEventListener("change", () => {
            console.log("保存 minimizeToTray 设置:", minimizeToTray.checked);
            window.electronAPI.saveSetting("minimizeToTray", minimizeToTray.checked ? "true" : "false");
        });
    }

    if (silentMode) {
        silentMode.addEventListener("change", () => {
            console.log("保存 silentMode 设置:", silentMode.checked);
            window.electronAPI.saveSetting("silentMode", silentMode.checked ? "true" : "false");
        });
    }

    if (autoLaunch) {
        autoLaunch.addEventListener("change", () => {
            console.log("保存 autoLaunch 设置:", autoLaunch.checked);
            window.electronAPI.saveSetting("autoLaunch", autoLaunch.checked ? "true" : "false");
            window.electronAPI.setAutoLaunch(autoLaunch.checked);
        });
    }

    // 检查错误数据并显示反馈
    if (checkErrorsButton) {
        checkErrorsButton.addEventListener("click", () => {
            console.log("检查错误数据");
            window.electronAPI.checkErrors().then(result => {
                if (result) {
                    alert("错误数据已清理");
                } else {
                    alert("所有数据正常");
                }
            });
        });
    }
})();
