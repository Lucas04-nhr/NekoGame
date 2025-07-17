(() => {
  // 确保在绑定事件之前检查元素是否存在
  const minimizeToTray = document.getElementById("minimizeToTray");
  const silentMode = document.getElementById("silentMode");
  const autoLaunch = document.getElementById("autoLaunch");
  const checkErrorsButton = document.getElementById("checkErrors");
  const openDataPathButton = document.getElementById("openDataPath");
  //硬件加速
  const hardwareAcceleration = document.getElementById("hardwareAcceleration");

  const getStarRailUrlButton = document.getElementById("getStarRailUrl");
  const getGenshinWishLinkButton =
    document.getElementById("getGenshinWishLink");

  const checkUpdateButton = document.getElementById("checkUpdate");
  const openUpdateLogButton = document.getElementById("openUpdateLog");

  // 处理背景图片选择
  const backgroundImageInput = document.getElementById("background-path");
  const backgroundOpacityInput = document.getElementById(
    "backgroundOpacityInput"
  );

  // 数据路径设置
  const dataFilePathInput = document.getElementById("dataFile-path");
  const browseButton = document.getElementById("browse-dataFile");
  const resetButton = document.getElementById("reset-dataFile");

  // 加载背景信息
  function loadBackgroundSettings() {
    window.electronAPI
      .invoke("loadBackgroundSettings")
      .then((settings) => {
        // 检查背景图片路径是否存在
        if (settings.backgroundImage === null) {
          document.getElementById("background-path").value = "没有设置背景图片";
        } else {
          // 如果有背景图片
          document.getElementById("background-path").value =
            settings.backgroundImage || "";
        }
        // 检查透明度设置是否存在
        if (settings.backgroundOpacity) {
          // 默认透明度值为0.5
          document.getElementById("backgroundOpacityInput").value =
            settings.backgroundOpacity || "0.5";
        }
        document.body.style.background = `linear-gradient(rgba(33, 33, 33, ${
          backgroundOpacityInput.value
        }), rgba(33, 33, 33, ${
          backgroundOpacityInput.value
        })), url('${window.electronAPI.filePathToURL(
          backgroundImageInput.value
        )}')`;
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundRepeat = "no-repeat";
        document.body.style.backgroundPosition = "center";
      })
      .catch((error) => {
        console.error("加载背景设置失败:", error);
      });
  }
  loadBackgroundSettings();

  // 监听背景图片选择
  if (backgroundImageInput) {
    document
      .getElementById("browse-background")
      .addEventListener("click", async () => {
        // 通过IPC发送选择文件夹的请求
        const result = await window.electronAPI.selectBackgroundFile();
        if (result.canceled === false && result.filePaths.length > 0) {
          const filePath = result.filePaths[0];
          document.getElementById("background-path").value = filePath;
          // 可选择保存路径到数据库或直接应用
          await window.electronAPI.saveBackgroundSettings(
            "backgroundImage",
            filePath
          );
          document.body.style.background = `linear-gradient(rgba(33, 33, 33, ${
            backgroundOpacityInput.value
          }), rgba(33, 33, 33, ${
            backgroundOpacityInput.value
          })), url('${window.electronAPI.filePathToURL(
            backgroundImageInput.value
          )}')`;
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
      await window.electronAPI.saveBackgroundSettings(
        "backgroundOpacity",
        opacity
      );
    });
    backgroundOpacityInput.addEventListener("input", async (event) => {
      const opacity = event.target.value;
      // 更新背景样式
      document.body.style.background = `linear-gradient(rgba(33, 33, 33, ${opacity}), rgba(33, 33, 33, ${opacity})), url('${window.electronAPI.filePathToURL(
        backgroundImageInput.value
      )}')`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundRepeat = "no-repeat";
      document.body.style.backgroundPosition = "center";
    });
  }

  if (getStarRailUrlButton) {
    getStarRailUrlButton.addEventListener("click", async () => {
      const result = await window.electronAPI.invoke("getStarRailUrl");
      console.log(result);
      animationMessage(result.success, result.message);
    });
  }

  // 检查更新按钮
  if (checkUpdateButton) {
    checkUpdateButton.addEventListener("click", () => {
      animationMessage(true, "正在检查更新");
      // 发送检查更新事件到主进程
      window.electronAPI.send("check-for-updates");
    });
  }

  // 创建数据同步设置窗口
  document
    .getElementById("openDataSyncWindow")
    .addEventListener("click", () => {
      window.electronAPI.send("openDataSyncWindow");
    });

  // 监听恢复默认配置按钮的点击事件
  document.getElementById("restore-defaults").addEventListener("click", () => {
    window.electronAPI
      .invoke("restoreDefaultBackgroundSettings")
      .then(() => {
        animationMessage(true, "背景设置已恢复为默认配置");
        // 更新配置
        loadBackgroundSettings();
      })
      .catch((err) => {
        console.error("恢复默认设置失败:", err);
        animationMessage(false, "恢复默认设置失败");
      });
  });
  document.getElementById("exportWuWa").addEventListener("click", async () => {
    const result = await window.electronAPI.invoke("exportGachaData");
    animationMessage(result.success, result.message);
  });

  document
    .getElementById("openCommonItems")
    .addEventListener("click", async () => {
      try {
        await window.electronAPI.invoke("open-common-items");
      } catch (error) {
        console.error("打开 commonItems.json 出错:", error);
      }
    });

  // 更新日志按钮
  if (openUpdateLogButton) {
    openUpdateLogButton.addEventListener("click", () => {
      // 发送更新日志事件到主进程
      window.electronAPI.send("open-update-log");
    });
  }

  if (getGenshinWishLinkButton) {
    getGenshinWishLinkButton.addEventListener("click", async () => {
      const result = await window.electronAPI.invoke("getGenshinWishLink");
      if (result.success) {
        animationMessage(
          result.success,
          `原神祈愿链接获取成功, 已复制到剪贴板\n${result.message}`
        );
      } else {
        animationMessage(
          result.success,
          `原神祈愿链接获取失败\n${result.message}`
        );
      }
    });
  }

  if (minimizeToTray && silentMode && autoLaunch && hardwareAcceleration) {
    window.electronAPI.invoke("load-settings").then((settings) => {
      minimizeToTray.checked = settings.minimizeToTray === "true";
      silentMode.checked = settings.silentMode === "true";
      autoLaunch.checked = settings.autoLaunch === "true";
      hardwareAcceleration.checked = settings.hardwareAcceleration === "true"; // 加入硬件加速的状态加载
    });
  }

  // 监听设置变化并保存
  [minimizeToTray, silentMode, autoLaunch, hardwareAcceleration].forEach(
    (setting) => {
      if (setting) {
        setting.addEventListener("click", () => {
          // 调用 save-setting IPC 方法保存设置
          window.electronAPI
            .invoke("save-setting", setting.id, setting.checked.toString())
            .then(() => {
              if (setting.id === "autoLaunch") {
                window.electronAPI.setAutoLaunch(setting.checked);
              }
              if (setting.id === "hardwareAcceleration") {
                animationMessage(
                  true,
                  "硬件加速设置已更改，需要重启应用生效。"
                );
              }
            })
            .catch((err) => {
              animationMessage(false, `保存设置错误 ${setting.id}:`);
              console.error(`保存设置错误 ${setting.id}:`, err);
            });
        });
      }
    }
  );

  // 检查错误数据并显示反馈
  if (checkErrorsButton) {
    checkErrorsButton.addEventListener("click", () => {
      console.log("检查错误数据");
      window.electronAPI
        .checkErrors()
        .then((result) => {
          if (result) {
            animationMessage(true, `${result}`);
          } else {
            animationMessage(true, "所有数据正常");
          }
        })
        .catch((err) => {
          animationMessage(false, `检查错误时发生问题${err}`);
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
  document.querySelectorAll('a[target="_blank"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const url = e.currentTarget.href;
      window.electronAPI.openExternal(url);
    });
  });

  // 加载当前路径
  async function loadDataPath() {
    const result = await window.electronAPI.invoke("get-dataFile-path");
    if (result.path) {
      dataFilePathInput.value = result.path;
    }
  }

  // 选择自定义数据路径
  browseButton.addEventListener("click", async () => {
    browseButton.disabled = true;
    browseButton.innerText = "请等待...";
    try {
      const result = await window.electronAPI.invoke("browse-dataFile");
      if (result.success) {
        animationMessage(true, `路径相同: ${result.path}`);
        dataFilePathInput.value = result.path;
      } else {
        animationMessage(false, result.message);
      }
    } catch (error) {
      console.error("切换路径时发生错误:", error);
      animationMessage(false, `路径更新失败\n${error}`);
    } finally {
      browseButton.disabled = false;
      browseButton.innerText = "更新数据路径";
    }
  });

  // 恢复默认数据路径
  resetButton.addEventListener("click", async () => {
    resetButton.disabled = true;
    resetButton.innerText = "请等待...";
    try {
      const result = await window.electronAPI.invoke("reset-dataFile");
      if (result.success) {
        animationMessage(true, "目前已是默认路径");
        dataFilePathInput.value = result.path;
      } else {
        animationMessage(false, result.message);
      }
    } catch (error) {
      console.error("恢复路径时发生错误:", error);
      animationMessage(false, `重置路径失败\n${error}`);
    } finally {
      resetButton.disabled = false;
      resetButton.innerText = "恢复默认路径";
    }
  });

  const customPathInput = document.getElementById("custom-path");
  const savePathButton = document.getElementById("save-path");
  const resetPathButton = document.getElementById("reset-path");

  // 初始化加载自定义路径
  const loadCustomPath = async () => {
    const customPath = await window.electronAPI.invoke("get-custom-path");
    customPathInput.value = customPath || ""; // 如果没有配置，则显示为空
  };

  // 保存自定义路径
  savePathButton.addEventListener("click", async () => {
    const customPath = customPathInput.value.trim();

    if (!customPath) {
      animationMessage(false, "自定义路径不能为空！");
      return;
    }

    await window.electronAPI.invoke("set-custom-path", customPath);
    animationMessage(true, "自定义路径已保存！");
  });

  // 恢复默认路径
  resetPathButton.addEventListener("click", async () => {
    await window.electronAPI.invoke("reset-custom-path");
    animationMessage(true, "已恢复默认源！");
    loadCustomPath();
  });

  // UIGF 字典功能
  const dictStatusDiv = document.getElementById("dict-status");
  const downloadAllDictsButton = document.getElementById("download-all-dicts");
  const refreshDictStatusButton = document.getElementById(
    "refresh-dict-status"
  );

  // 格式化字典状态显示
  function formatDictStatus(status) {
    const gameNames = {
      genshin: "原神",
      starrail: "星穹铁道",
      zzz: "绝区零",
    };

    let html =
      '<div style="font-weight: bold; margin-bottom: 8px;">字典状态:</div>';

    for (const [game, info] of Object.entries(status)) {
      const gameName = gameNames[game] || game;
      const statusIcon = info.exists && info.valid ? "✅" : "❌";
      const statusText = info.exists
        ? info.valid
          ? `已下载 (${info.itemCount} 项)`
          : "文件损坏"
        : "未下载";

      // 格式化下载时间显示
      const downloadTimeText =
        info.lastDownload &&
        info.lastDownload !== "从未下载" &&
        info.lastDownload !== "未知"
          ? `最近下载: ${info.lastDownload}`
          : info.lastDownload === "从未下载"
          ? "从未下载"
          : "下载时间未知";

      html += `
                <div style="margin-bottom: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <span style="font-weight: 500;">${statusIcon} ${gameName}</span>
                        <span style="font-size: 0.9em; color: #ccc;">${statusText}</span>
                    </div>
                    <div style="font-size: 0.8em; color: #999;">
                        ${downloadTimeText}
                    </div>
                </div>
            `;
    }

    return html;
  }

  // 加载字典状态
  async function loadDictStatus() {
    try {
      dictStatusDiv.innerHTML = "<div>正在检查字典状态...</div>";
      const result = await window.electronAPI.invoke("get-dict-status", "chs");

      if (result.success) {
        dictStatusDiv.innerHTML = formatDictStatus(result.status);
      } else {
        dictStatusDiv.innerHTML = `<div style="color: red;">状态检查失败: ${result.message}</div>`;
      }
    } catch (error) {
      console.error("加载字典状态失败:", error);
      dictStatusDiv.innerHTML = `<div style="color: red;">状态检查失败: ${error.message}</div>`;
    }
  }

  // 下载所有字典
  downloadAllDictsButton.addEventListener("click", async () => {
    try {
      downloadAllDictsButton.disabled = true;
      downloadAllDictsButton.textContent = "下载中...";
      dictStatusDiv.innerHTML = "<div>正在下载字典...</div>";

      const result = await window.electronAPI.invoke(
        "download-all-uigf-dicts",
        "chs"
      );

      if (result.success) {
        animationMessage(true, result.message);
      } else {
        animationMessage(false, result.message);
      }

      // 刷新状态
      await loadDictStatus();
    } catch (error) {
      console.error("下载字典失败:", error);
      animationMessage(false, `下载失败: ${error.message}`);
    } finally {
      downloadAllDictsButton.disabled = false;
      downloadAllDictsButton.textContent = "下载所有字典";
    }
  });

  // 刷新字典状态
  refreshDictStatusButton.addEventListener("click", loadDictStatus);

  // 初始化
  loadCustomPath();
  // 初始化加载路径
  loadDataPath();
  // 初始化字典状态
  loadDictStatus();
})();
