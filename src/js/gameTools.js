// 处理联合导入功能
async function handleCombinedImport() {
  try {
    // 禁用导入按钮
    const importButton = document.getElementById("combinedImport");
    importButton.disabled = true;
    importButton.innerText = "正在检测...";

    // 调用后端选择文件并检测游戏数据
    const result = await window.electronAPI.invoke("detect-combined-uigf-data");

    if (!result.success) {
      animationMessage(false, result.message);
      return;
    }

    if (result.cancelled) {
      // 用户取消了文件选择，不显示错误消息
      return;
    }

    // 显示检测结果模态窗口
    showCombinedImportModal(result.detectedGames, result.filePath);
  } catch (error) {
    animationMessage(false, `联合导入失败: ${error.message}`);
  } finally {
    // 恢复导入按钮
    const importButton = document.getElementById("combinedImport");
    importButton.disabled = false;
    importButton.innerText = "导入数据";
  }
}

// 显示联合导入确认模态窗口
function showCombinedImportModal(detectedGames, filePath) {
  const modal = document.getElementById("combinedImportModal");
  const container = document.getElementById("detectedGamesContainer");
  const confirmButton = document.getElementById("confirmCombinedImport");
  const cancelButton = document.getElementById("cancelCombinedImport");
  const closeButton = document.getElementById("closeCombinedImportModal");
  const selectAllButton = document.getElementById("selectAllImportUIDs");
  const deselectAllButton = document.getElementById("deselectAllImportUIDs");

  // 清空容器
  container.innerHTML = "";

  // 显示检测到的游戏数据
  detectedGames.forEach((game) => {
    const gameInfo = document.createElement("div");
    gameInfo.className = "detected-game-info";

    // 创建 UID 选择列表，提供向后兼容性
    const uidData =
      game.uidData || game.uids.map((uid) => ({ uid, recordCount: 0 }));
    const uidSelectionHtml = uidData
      .map(
        (uidInfo) => `
      <div class="import-uid-item" data-game="${game.key}" data-uid="${uidInfo.uid}">
        <div>${uidInfo.uid}</div>
        <div class="uid-record-count">${uidInfo.recordCount} 条记录</div>
      </div>
    `
      )
      .join("");

    gameInfo.innerHTML = `
      <div class="game-name">${game.name}</div>
      <div class="game-data-count">总计 ${game.recordCount} 条记录</div>
      <div class="import-uid-selection">
        <div class="import-uid-list">
          ${uidSelectionHtml}
        </div>
      </div>
    `;
    container.appendChild(gameInfo);
  });

  // 添加 UID 点击事件
  container.addEventListener("click", (e) => {
    if (e.target.closest(".import-uid-item")) {
      const uidItem = e.target.closest(".import-uid-item");
      uidItem.classList.toggle("selected");
    }
  });

  // 移除旧的事件监听器
  confirmButton.replaceWith(confirmButton.cloneNode(true));
  cancelButton.replaceWith(cancelButton.cloneNode(true));
  closeButton.replaceWith(closeButton.cloneNode(true));
  selectAllButton.replaceWith(selectAllButton.cloneNode(true));
  deselectAllButton.replaceWith(deselectAllButton.cloneNode(true));

  // 重新获取按钮引用
  const newConfirmButton = document.getElementById("confirmCombinedImport");
  const newCancelButton = document.getElementById("cancelCombinedImport");
  const newCloseButton = document.getElementById("closeCombinedImportModal");
  const newSelectAllButton = document.getElementById("selectAllImportUIDs");
  const newDeselectAllButton = document.getElementById("deselectAllImportUIDs");

  // 全选功能
  newSelectAllButton.addEventListener("click", () => {
    const uidItems = container.querySelectorAll(".import-uid-item");
    uidItems.forEach((item) => item.classList.add("selected"));
  });

  // 全不选功能
  newDeselectAllButton.addEventListener("click", () => {
    const uidItems = container.querySelectorAll(".import-uid-item");
    uidItems.forEach((item) => item.classList.remove("selected"));
  });

  // 确认导入
  newConfirmButton.addEventListener("click", async () => {
    // 获取选中的 UID
    const selectedUIDs = {};
    const selectedItems = container.querySelectorAll(
      ".import-uid-item.selected"
    );

    if (selectedItems.length === 0) {
      animationMessage(false, "请选择要导入的 UID");
      return;
    }

    selectedItems.forEach((item) => {
      const game = item.dataset.game;
      const uid = item.dataset.uid;
      if (!selectedUIDs[game]) {
        selectedUIDs[game] = [];
      }
      selectedUIDs[game].push(uid);
    });

    closeModal(modal);

    // 禁用导入按钮
    const importButton = document.getElementById("combinedImport");
    importButton.disabled = true;
    importButton.innerText = "导入中...";

    try {
      const importResult = await window.electronAPI.invoke(
        "import-combined-uigf-data",
        { filePath, selectedUIDs }
      );
      if (importResult.success) {
        animationMessage(true, importResult.message);
      } else {
        animationMessage(false, importResult.message);
      }
    } catch (error) {
      animationMessage(false, `联合导入失败: ${error.message}`);
    } finally {
      importButton.disabled = false;
      importButton.innerText = "导入数据";
    }
  });

  // 取消导入
  newCancelButton.addEventListener("click", () => {
    closeModal(modal);
  });

  // 关闭模态窗口
  newCloseButton.addEventListener("click", () => {
    closeModal(modal);
  });

  // 显示模态窗口
  openModal(modal);
}

// 处理联合导出功能
async function handleCombinedExport() {
  const modal = document.getElementById("combinedExportModal");
  const genshinUidList = document.getElementById("genshinUidList");
  const starRailUidList = document.getElementById("starRailUidList");
  const zzzUidList = document.getElementById("zzzUidList");
  const confirmButton = document.getElementById("confirmCombinedExport");
  const selectAllButton = document.getElementById("selectAllCombined");
  const deselectAllButton = document.getElementById("deselectAllCombined");
  const closeButton = document.getElementById("closeCombinedModal");

  // 重置模态窗口
  const resetCombinedModal = () => {
    genshinUidList.innerHTML = "";
    starRailUidList.innerHTML = "";
    zzzUidList.innerHTML = "";
    // 移除旧的事件监听器
    confirmButton.replaceWith(confirmButton.cloneNode(true));
    selectAllButton.replaceWith(selectAllButton.cloneNode(true));
    deselectAllButton.replaceWith(deselectAllButton.cloneNode(true));
    closeButton.replaceWith(closeButton.cloneNode(true));
  };

  try {
    resetCombinedModal();

    // 获取各游戏的UID列表
    const [genshinUIDs, starRailUIDs, zzzUIDs] = await Promise.all([
      window.electronAPI.invoke("get-genshin-player-uids").catch(() => []),
      window.electronAPI.invoke("get-starRail-player-uids").catch(() => []),
      window.electronAPI.invoke("get-zzz-player-uids").catch(() => []),
    ]);

    // 生成UID项目
    const createUidItems = (uids, container, gameType) => {
      uids.forEach((uid) => {
        const uidItem = document.createElement("div");
        uidItem.className = "combined-uid-item";
        uidItem.innerText = uid;
        uidItem.dataset.uid = uid;
        uidItem.dataset.game = gameType;
        container.appendChild(uidItem);

        uidItem.addEventListener("click", () => {
          uidItem.classList.toggle("selected");
          updateCombinedButtons();
        });
      });
    };

    createUidItems(genshinUIDs, genshinUidList, "原神");
    createUidItems(starRailUIDs, starRailUidList, "崩铁");
    createUidItems(zzzUIDs, zzzUidList, "绝区零");

    // 更新按钮状态
    const updateCombinedButtons = () => {
      const allItems = document.querySelectorAll(".combined-uid-item");
      const selectedItems = document.querySelectorAll(
        ".combined-uid-item.selected"
      );
      const allSelected =
        allItems.length > 0 && selectedItems.length === allItems.length;

      const newSelectAllButton = document.getElementById("selectAllCombined");
      if (allSelected) {
        newSelectAllButton.innerText = "全不选";
        newSelectAllButton.classList.add("primary");
      } else {
        newSelectAllButton.innerText = "全选";
        newSelectAllButton.classList.remove("primary");
      }
    };

    // 显示模态窗口
    openModal(modal);

    // 全选/全不选功能
    document
      .getElementById("selectAllCombined")
      .addEventListener("click", () => {
        const allItems = document.querySelectorAll(".combined-uid-item");
        const selectedItems = document.querySelectorAll(
          ".combined-uid-item.selected"
        );
        const allSelected =
          allItems.length > 0 && selectedItems.length === allItems.length;

        if (allSelected) {
          allItems.forEach((item) => item.classList.remove("selected"));
        } else {
          allItems.forEach((item) => item.classList.add("selected"));
        }
        updateCombinedButtons();
      });

    // 全不选功能
    document
      .getElementById("deselectAllCombined")
      .addEventListener("click", () => {
        const allItems = document.querySelectorAll(".combined-uid-item");
        allItems.forEach((item) => item.classList.remove("selected"));
        updateCombinedButtons();
      });

    // 确认导出
    document
      .getElementById("confirmCombinedExport")
      .addEventListener("click", async () => {
        const selectedItems = document.querySelectorAll(
          ".combined-uid-item.selected"
        );

        if (selectedItems.length === 0) {
          animationMessage(false, "请至少选择一个UID");
          return;
        }

        // 按游戏分组选中的UID
        const selectedData = {
          genshin: [],
          starRail: [],
          zzz: [],
        };

        selectedItems.forEach((item) => {
          const uid = item.dataset.uid;
          const game = item.dataset.game;

          if (game === "原神") {
            selectedData.genshin.push(uid);
          } else if (game === "崩铁") {
            selectedData.starRail.push(uid);
          } else if (game === "绝区零") {
            selectedData.zzz.push(uid);
          }
        });

        closeModal(modal);

        // 禁用导出按钮
        const exportButton = document.getElementById("combinedExport");
        exportButton.disabled = true;
        exportButton.innerText = "导出中...";

        try {
          const result = await window.electronAPI.invoke(
            "export-combined-uigf-data",
            selectedData
          );
          if (result.success) {
            animationMessage(true, result.message);
          } else {
            animationMessage(false, result.message);
          }
        } catch (error) {
          animationMessage(false, `联合导出失败: ${error.message}`);
        } finally {
          exportButton.disabled = false;
          exportButton.innerText = "联合导出";
        }
      });

    // 关闭模态窗口
    document
      .getElementById("closeCombinedModal")
      .addEventListener("click", () => {
        closeModal(modal);
      });

    updateCombinedButtons();
  } catch (error) {
    animationMessage(false, `获取UID列表失败: ${error.message}`);
  }
}

function gameToolsInit() {
  const toolList = document.getElementById("tool-list");
  const subpageContent = document.getElementById("subpage-content");
  const globalBackButton = document.getElementById("global-back-button"); // 全局返回按钮
  const handleExport = async (
    gameType,
    getUidListChannel,
    exportDataChannel
  ) => {
    const modal = document.getElementById("uidSelectionModal");
    const uidListContainer = document.getElementById("uidListContainer");
    const confirmButton = document.getElementById("confirmUIDSelection");
    const closeButton = document.getElementById("closeModal");
    const selectAllButton = document.getElementById("selectAllUIDs");
    const deselectAllButton = document.getElementById("deselectAllUIDs");

    // 重置模态窗口状态
    const resetModal = () => {
      uidListContainer.innerHTML = ""; // 清空 UID 列表
      document.querySelectorAll(".uid-item").forEach((item) => item.remove()); // 清理旧的 UID 项
      // 解除绑定事件监听器（通过克隆替换，确保解绑）
      confirmButton.replaceWith(confirmButton.cloneNode(true));
      closeButton.replaceWith(closeButton.cloneNode(true));
      selectAllButton.replaceWith(selectAllButton.cloneNode(true));
    };

    try {
      const uidList = await window.electronAPI.invoke(getUidListChannel);
      if (uidList.length === 0) {
        animationMessage(false, `没有找到可导出的 ${gameType} UID`);
        return;
      }
      resetModal(); // 确保模态窗口处于初始状态
      // 动态生成 UID 列表
      uidList.forEach((uid) => {
        const uidItem = document.createElement("div");
        uidItem.className = "uid-item";
        uidItem.innerText = uid;
        uidItem.dataset.uid = uid;
        uidListContainer.appendChild(uidItem);
        uidItem.addEventListener("click", () => {
          uidItem.classList.toggle("selected");
          updateToggleButtonState();
        });
      });
      // 打开模态窗口
      openModal(modal);
      // 全选功能
      // 替换全选按钮并绑定事件
      const toggleSelectAllButton = document.getElementById("selectAllUIDs");
      toggleSelectAllButton.replaceWith(toggleSelectAllButton.cloneNode(true));
      const newSelectAllButton = document.getElementById("selectAllUIDs");
      // 全选/取消全选功能
      newSelectAllButton.addEventListener("click", () => {
        const uidItems = document.querySelectorAll(".uid-item");
        const isAllSelected = Array.from(uidItems).every((item) =>
          item.classList.contains("selected")
        );
        if (isAllSelected) {
          // 如果已全选，执行取消全选
          uidItems.forEach((item) => item.classList.remove("selected"));
          newSelectAllButton.classList.remove("primary");
          newSelectAllButton.innerText = "全选";
        } else {
          // 如果未全选，执行全选
          uidItems.forEach((item) => item.classList.add("selected"));
          newSelectAllButton.classList.add("primary");
          newSelectAllButton.innerText = "取消全选";
        }
      });

      // 更新全选按钮文字
      const updateToggleButtonState = () => {
        const uidItems = document.querySelectorAll(".uid-item");
        const allSelected = Array.from(uidItems).every((item) =>
          item.classList.contains("selected")
        );
        if (allSelected) {
          newSelectAllButton.classList.add("primary");
          newSelectAllButton.innerText = "取消全选";
        } else {
          newSelectAllButton.classList.remove("primary");
          newSelectAllButton.innerText = "全选";
        }
      };
      // 确认选择
      document
        .getElementById("confirmUIDSelection")
        .addEventListener("click", async () => {
          const selectedUIDs = Array.from(
            document.querySelectorAll(".uid-item.selected")
          ).map((item) => item.dataset.uid);
          if (selectedUIDs.length === 0) {
            animationMessage(false, `未选择任何 ${gameType} UID`);
            return;
          }
          closeModal(modal);
          document.getElementById(`export${gameType}`).disabled = true;
          document.getElementById(`export${gameType}`).innerText = "请等待...";
          try {
            const result = await window.electronAPI.invoke(
              exportDataChannel,
              selectedUIDs
            );
            if (result.success) {
              animationMessage(true, result.message);
            } else {
              animationMessage(false, result.message);
            }
          } catch (error) {
            animationMessage(
              false,
              `导出 ${gameType} 数据失败\n${error.message}`
            );
          } finally {
            document.getElementById(`export${gameType}`).disabled = false;
            newSelectAllButton.classList.remove("primary");
            newSelectAllButton.innerText = "全选";
            document.getElementById(`export${gameType}`).innerText = "导出数据";
          }
        });

      // 关闭模态窗口
      document.getElementById("closeModal").addEventListener("click", () => {
        closeModal(modal);
      });
    } catch (error) {
      animationMessage(
        false,
        `获取 ${gameType} UID 列表失败\n${error.message}`
      );
    }
  };

  // 工具卡片点击事件
  toolList.addEventListener("click", (e) => {
    if (e.target.classList.contains("tool-card")) {
      const toolPage = e.target.dataset.tool;

      // 动态加载工具子页面
      loadToolSubpage(toolPage);

      // 隐藏工具列表，显示子页面区域
      toolList.classList.remove("visible");
      toolList.classList.add("hidden");

      subpageContent.classList.remove("hidden");
      subpageContent.classList.add("visible");

      globalBackButton.classList.remove("hidden");
      globalBackButton.classList.add("visible");
    }
  });

  // 返回按钮事件
  globalBackButton.addEventListener("click", () => {
    const loadedScripts = document.querySelectorAll("script[data-tool]");
    // 隐藏子页面，显示工具列表
    subpageContent.classList.remove("visible");
    subpageContent.classList.add("hidden");

    toolList.classList.remove("hidden");
    toolList.classList.add("visible");

    globalBackButton.classList.remove("visible");
    globalBackButton.classList.add("hidden");
    // 清空子页面内容
    subpageContent.innerHTML = "";
    loadedScripts.forEach((script) => script.remove());
  });

  //导入导出方法
  document.getElementById("exportWuWa").addEventListener("click", async () => {
    const result = await window.electronAPI.invoke("exportGachaData");
    if (result.success || result.message !== "用户取消了保存操作") {
      animationMessage(result.success, result.message);
    }
  });

  document
    .getElementById("exportGenshin")
    .addEventListener("click", async () => {
      await handleExport(
        "Genshin",
        "get-genshin-player-uids",
        "export-genshin-data"
      );
    });
  document.getElementById("exportZzz").addEventListener("click", async () => {
    await handleExport("Zzz", "get-zzz-player-uids", "export-zzz-data");
  });
  document
    .getElementById("exportStarRail")
    .addEventListener("click", async () => {
      await handleExport(
        "StarRail",
        "get-starRail-player-uids",
        "export-starRail-data"
      );
    });

  document
    .getElementById("importStarRail")
    .addEventListener("click", async () => {
      const refreshButton = document.getElementById("importStarRail");
      refreshButton.disabled = true;
      refreshButton.innerText = "请等待...";
      try {
        const result = await window.electronAPI.invoke("import-starRail-data");
        animationMessage(result.success, result.message);
      } catch (error) {
        console.error("导入数据时发生错误:", error);
        animationMessage(result.success, `导入失败\n${result.message}`);
      } finally {
        refreshButton.disabled = false;
        refreshButton.innerText = "导入数据";
      }
    });

  document
    .getElementById("importGenshin")
    .addEventListener("click", async () => {
      document.getElementById("importGenshin").disabled = true;
      document.getElementById("importGenshin").innerText = "请等待...";
      try {
        const result = await window.electronAPI.invoke("import-genshin-data");
        animationMessage(result.success, result.message);
      } catch (error) {
        console.error("导入数据时发生错误:", error);
        animationMessage(result.success, `导入失败\n${result.message}`);
      } finally {
        document.getElementById("importGenshin").disabled = false;
        document.getElementById("importGenshin").innerText = "导入数据";
      }
    });
  document.getElementById("importZzz").addEventListener("click", async () => {
    const refreshButton = document.getElementById("importZzz");
    refreshButton.disabled = true;
    refreshButton.innerText = "请等待...";
    try {
      const result = await window.electronAPI.invoke("import-zzz-data");
      animationMessage(result.success, result.message);
    } catch (error) {
      console.error("导入数据时发生错误:", error);
      animationMessage(result.success, `导入失败\n${result.message}`);
    } finally {
      refreshButton.disabled = false;
      refreshButton.innerText = "导入数据";
    }
  });

  // document.getElementById('getStarRailRecords').addEventListener('click', async () => {
  //     document.getElementById('getStarRailRecords').disabled = true;
  //     document.getElementById('getStarRailRecords').innerText = '请等待...';
  //     try {
  //         result = await window.electronAPI.invoke('getZZZLink');
  //         animationMessage(result.success, result.message);
  //     } catch (error) {
  //         animationMessage(false, error);
  //         console.error('发生错误:', error);
  //     } finally {
  //         document.getElementById('getStarRailRecords').disabled = false;
  //         document.getElementById('getStarRailRecords').innerText = '获取崩铁记录';
  //     }
  // });

  // 联合导出功能
  document
    .getElementById("combinedExport")
    .addEventListener("click", async () => {
      await handleCombinedExport();
    });

  // 联合导入功能
  document
    .getElementById("combinedImport")
    .addEventListener("click", async () => {
      await handleCombinedImport();
    });
}

// 动态加载工具子页面内容
function loadToolSubpage(toolPage) {
  const subpageContent = document.getElementById("subpage-content");

  console.log("Loading tool page:", toolPage);
  subpageContent.classList.add("fade-out");

  setTimeout(() => {
    subpageContent.innerHTML = "";
    fetch(`pages/gameTools/${toolPage}.html`)
      .then((response) => {
        if (!response.ok) {
          animationMessage(false, `页面错误: ${response.status}`);
          throw new Error(`页面错误: ${response.status}`);
        }
        return response.text();
      })
      .then((html) => {
        subpageContent.innerHTML = html; // 插入子页面内容
        loadToolScript(toolPage);
        subpageContent.classList.remove("fade-out");
        subpageContent.classList.add("fade-in");
        setTimeout(() => subpageContent.classList.remove("fade-in"), 300);
      })
      .catch((error) => {
        animationMessage(false, `${toolPage}加载失败`);
        console.error(`Failed to load tool page: ${error}`);
      });
  }, 200);
}

// 动态加载工具子页面的 JS 文件
function loadToolScript(toolPage) {
  const script = document.createElement("script");
  script.src = `js/gameTools/${toolPage}.js`;
  script.dataset.tool = toolPage;
  script.onload = () => {
    if (typeof window[`${toolPage}Init`] === "function") {
      window[`${toolPage}Init`]();
    }
  };
  document.body.appendChild(script);
}

// 注册初始化函数
window.gameToolsInit = gameToolsInit;
