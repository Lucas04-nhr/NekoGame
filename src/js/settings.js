(() => {
    // 确保在绑定事件之前检查元素是否存在
    const minimizeToTray = document.getElementById("minimizeToTray");
    const silentMode = document.getElementById("silentMode");
    const autoLaunch = document.getElementById("autoLaunch");
    const checkErrorsButton = document.getElementById("checkErrors");
    const openDataPathButton = document.getElementById("openDataPath");

    const getStarRailUrlButton = document.getElementById("getStarRailUrl");
    const getGenshinWishLinkButton = document.getElementById('getGenshinWishLink');

    if (getStarRailUrlButton) {
        getStarRailUrlButton.addEventListener("click", async () => {
            const result = await window.electronAPI.invoke('getStarRailUrl');
            alert(result.message);
        });
    }

    if (getGenshinWishLinkButton) {
        getGenshinWishLinkButton.addEventListener('click', async () => {
            const result = await window.electronAPI.invoke('getGenshinWishLink');
            alert(result.message);
        });
    }

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
    // 监听点击事件
    [minimizeToTray, silentMode, autoLaunch].forEach(setting => {
        if (setting) {
            setting.addEventListener("click", () => {
                window.electronAPI.saveSetting(setting.id, setting.checked.toString());
                if (setting.id === "autoLaunch") {
                    window.electronAPI.setAutoLaunch(setting.checked);
                }
            });
        }
    });

    // 检查错误数据并显示反馈
    if (checkErrorsButton) {
        checkErrorsButton.addEventListener("click", () => {
            console.log("检查错误数据");
            window.electronAPI.checkErrors().then(result => {
                if (result) {
                    alert(`${result}`);
                } else {
                    alert("所有数据正常");
                }
            }).catch(err => {
                alert("检查错误时发生问题：" + err);
            });
        });
    }

    // 打开数据文件夹
    if (openDataPathButton) {
        openDataPathButton.addEventListener("click", () => {
            window.electronAPI.openDataPath();
        });
    }
    // 检查外部链接
    document.querySelectorAll('a[target="_blank"]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = e.currentTarget.href;
            window.electronAPI.openExternal(url);
        });
    });
})();
