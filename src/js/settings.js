(() => {
    // 确保在绑定事件之前检查元素是否存在
    const minimizeToTray = document.getElementById("minimizeToTray");
    const silentMode = document.getElementById("silentMode");
    const autoLaunch = document.getElementById("autoLaunch");
    const checkErrorsButton = document.getElementById("checkErrors");
    const openDataPathButton = document.getElementById("openDataPath");

    const getStarRailUrlButton = document.getElementById("getStarRailUrl");
    const getGenshinWishLinkButton = document.getElementById('getGenshinWishLink');

    const checkUpdateButton = document.getElementById("checkUpdate");
    const openUpdateLogButton = document.getElementById("openUpdateLog");

     // 处理背景图片选择
    const backgroundImageInput = document.getElementById("background-path");
    const backgroundOpacityInput = document.getElementById("backgroundOpacityInput");

    // 加载背景信息
    function loadBackgroundSettings() {
        window.electronAPI.invoke('loadBackgroundSettings').then(settings => {
            // 检查背景图片路径是否存在
            if (settings.backgroundImage) {
                // 如果有背景图片
                document.getElementById('background-path').value = settings.backgroundImage || '';
            }
            // 检查透明度设置是否存在
            if (settings.backgroundOpacity) {
                // 默认透明度值为0.5
                document.getElementById('backgroundOpacityInput').value = settings.backgroundOpacity || '0.5';
            }
            document.body.style.background = `linear-gradient(rgba(0, 0, 0, ${backgroundOpacityInput.value}), rgba(0, 0, 0, ${backgroundOpacityInput.value})), url('${window.electronAPI.filePathToURL(backgroundImageInput.value)}')`;
            document.body.style.backgroundSize = "cover";
            document.body.style.backgroundRepeat = "no-repeat";
            document.body.style.backgroundPosition = "center";
        }).catch(error => {
            console.error('加载背景设置失败:', error);
        });
    }
    loadBackgroundSettings();


    // 监听背景图片选择
    if (backgroundImageInput) {
        document.getElementById('browse-background').addEventListener('click', async () => {
            // 通过IPC发送选择文件夹的请求
            const result = await window.electronAPI.selectBackgroundFile();
            if (result.canceled === false && result.filePaths.length > 0) {
                const filePath = result.filePaths[0];
                document.getElementById('background-path').value = filePath;
                // 可选择保存路径到数据库或直接应用
                await window.electronAPI.saveBackgroundSettings("backgroundImage", filePath);
                document.body.style.background = `linear-gradient(rgba(0, 0, 0, ${backgroundOpacityInput.value}), rgba(0, 0, 0, ${backgroundOpacityInput.value})), url('${window.electronAPI.filePathToURL(backgroundImageInput.value)}')`;
                document.body.style.backgroundSize = "cover";
                document.body.style.backgroundRepeat = "no-repeat";
                document.body.style.backgroundPosition = "center";
            }
        });
    }

    // 监听背景透明度变化
    if (backgroundOpacityInput) {
        backgroundOpacityInput.addEventListener("change", async (event) => {
            const opacity = event.target.value;
            await window.electronAPI.saveBackgroundSettings("backgroundOpacity", opacity);

            // 更新背景样式
            document.body.style.background = `linear-gradient(rgba(0, 0, 0, ${opacity}), rgba(0, 0, 0, ${opacity})), url('${window.electronAPI.filePathToURL(backgroundImageInput.value)}')`;
            document.body.style.backgroundSize = "cover";
            document.body.style.backgroundRepeat = "no-repeat";
            document.body.style.backgroundPosition = "center";
        });
    }


    if (getStarRailUrlButton) {
        getStarRailUrlButton.addEventListener("click", async () => {
            const result = await window.electronAPI.invoke('getStarRailUrl');
            alert(result.message);
        });
    }

    // 检查更新按钮
    if (checkUpdateButton) {
        checkUpdateButton.addEventListener("click", () => {
            // 发送检查更新事件到主进程
            window.electronAPI.send('check-for-updates');
        });
    }

    // 创建数据同步设置窗口
    document.getElementById('openDataSyncWindow').addEventListener('click', () => {
        window.electronAPI.send('openDataSyncWindow');
    });

    // 监听恢复默认配置按钮的点击事件
    document.getElementById('restore-defaults').addEventListener('click', () => {
        window.electronAPI.invoke('restoreDefaultBackgroundSettings')
            .then(() => {
                alert('背景设置已恢复为默认配置');
                // 更新配置
                loadBackgroundSettings();
            })
            .catch((err) => {
                console.error('恢复默认设置失败:', err);
                alert('恢复默认设置失败');
            });
    });

    // 更新日志按钮
    if (openUpdateLogButton) {
        openUpdateLogButton.addEventListener("click", () => {
            // 发送更新日志事件到主进程
            window.electronAPI.send('open-update-log');
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
