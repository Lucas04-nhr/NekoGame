function gameToolsInit() {
    const toolList = document.getElementById('tool-list');
    const subpageContent = document.getElementById('subpage-content');
    const globalBackButton = document.getElementById('global-back-button'); // 全局返回按钮
    const handleExport = async (gameType, getUidListChannel, exportDataChannel) => {
        const modal = document.getElementById('uidSelectionModal');
        const uidListContainer = document.getElementById('uidListContainer');
        const confirmButton = document.getElementById('confirmUIDSelection');
        const closeButton = document.getElementById('closeModal');
        const selectAllButton = document.getElementById('selectAllUIDs');
        const deselectAllButton = document.getElementById('deselectAllUIDs');

        // 重置模态窗口状态
        const resetModal = () => {
            uidListContainer.innerHTML = ''; // 清空 UID 列表
            document.querySelectorAll('.uid-item').forEach(item => item.remove()); // 清理旧的 UID 项
            // 解除绑定事件监听器（通过克隆替换，确保解绑）
            confirmButton.replaceWith(confirmButton.cloneNode(true));
            closeButton.replaceWith(closeButton.cloneNode(true));
            selectAllButton.replaceWith(selectAllButton.cloneNode(true));
            deselectAllButton.replaceWith(deselectAllButton.cloneNode(true));
        };

        try {
            const uidList = await window.electronAPI.invoke(getUidListChannel);
            if (uidList.length === 0) {
                animationMessage(false, `没有找到可导出的 ${gameType} UID`);
                return;
            }
            resetModal(); // 确保模态窗口处于初始状态
            // 动态生成 UID 列表
            uidList.forEach(uid => {
                const uidItem = document.createElement('div');
                uidItem.className = 'uid-item';
                uidItem.innerText = uid;
                uidItem.dataset.uid = uid;
                uidListContainer.appendChild(uidItem);
                uidItem.addEventListener('click', () => {
                    uidItem.classList.toggle('selected');
                });
            });
            // 打开模态窗口
            openModal(modal);
            // 全选功能
            document.getElementById('selectAllUIDs').addEventListener('click', () => {
                document.querySelectorAll('.uid-item').forEach(item => {
                    item.classList.add('selected');
                });
            });
            // 取消全选功能
            document.getElementById('deselectAllUIDs').addEventListener('click', () => {
                document.querySelectorAll('.uid-item').forEach(item => {
                    item.classList.remove('selected');
                });
            });
            // 确认选择
            document.getElementById('confirmUIDSelection').addEventListener('click', async () => {
                const selectedUIDs = Array.from(document.querySelectorAll('.uid-item.selected')).map(
                    item => item.dataset.uid
                );
                if (selectedUIDs.length === 0) {
                    animationMessage(false, `未选择任何 ${gameType} UID`);
                    return;
                }
                modal.style.display = 'none';
                document.getElementById(`export${gameType}`).disabled = true;
                document.getElementById(`export${gameType}`).innerText = '请等待...';
                try {
                    await window.electronAPI.invoke(exportDataChannel, selectedUIDs);
                } catch (error) {
                    animationMessage(false, `导出 ${gameType} 数据失败\n${error.message}`);
                } finally {
                    document.getElementById(`export${gameType}`).disabled = false;
                    document.getElementById(`export${gameType}`).innerText = '导出数据';
                }
            });

            // 关闭模态窗口
            document.getElementById('closeModal').addEventListener('click', () => {
                closeModal(modal);
            });
        } catch (error) {
            animationMessage(false, `获取 ${gameType} UID 列表失败\n${error.message}`);
        }
    };

    // 工具卡片点击事件
    toolList.addEventListener('click', (e) => {
        if (e.target.classList.contains('tool-card')) {
            const toolPage = e.target.dataset.tool;

            // 动态加载工具子页面
            loadToolSubpage(toolPage);

            // 隐藏工具列表，显示子页面区域
            toolList.classList.remove('visible');
            toolList.classList.add('hidden');

            subpageContent.classList.remove('hidden');
            subpageContent.classList.add('visible');

            globalBackButton.classList.remove('hidden');
            globalBackButton.classList.add('visible');
        }
    });

    // 返回按钮事件
    globalBackButton.addEventListener('click', () => {
        // 隐藏子页面，显示工具列表
        subpageContent.classList.remove('visible');
        subpageContent.classList.add('hidden');

        toolList.classList.remove('hidden');
        toolList.classList.add('visible');

        globalBackButton.classList.remove('visible');
        globalBackButton.classList.add('hidden');
        // 清空子页面内容
        subpageContent.innerHTML = '';
    });

    //导入导出方法
    document.getElementById('exportWuWa').addEventListener('click', async () => {
        let result = await window.electronAPI.invoke('exportGachaData');
        animationMessage(result.success, result.message);
    });
    document.getElementById('exportStarRail').addEventListener('click', async () => {
        await handleExport('StarRail', 'get-starRail-player-uids', 'export-starRail-data');
    });
    document.getElementById('exportGenshin').addEventListener('click', async () => {
        await handleExport('Genshin', 'get-genshin-player-uids', 'export-genshin-data');
    });
    document.getElementById('exportZzz').addEventListener('click', async () => {
        await handleExport('Zzz', 'get-zzz-player-uids', 'export-zzz-data');
    });
    document.getElementById('importStarRail').addEventListener('click', async () => {
        const refreshButton = document.getElementById('importStarRail');
        refreshButton.disabled = true;
        refreshButton.innerText = '请等待...';
        try {
            const result = await window.electronAPI.invoke('import-starRail-data');
            animationMessage(result.success, result.message);
        } catch (error) {
            console.error('导入数据时发生错误:', error);
            animationMessage(result.success, `导入失败\n${result.message}`);
        } finally {
            refreshButton.disabled = false;
            refreshButton.innerText = '导入数据';
        }
    });
    document.getElementById('importGenshin').addEventListener('click', async () => {
        document.getElementById('importGenshin').disabled = true;
        document.getElementById('importGenshin').innerText = '请等待...';
        try {
            const result = await window.electronAPI.invoke('import-genshin-data');
            animationMessage(result.success, result.message);
        } catch (error) {
            console.error('导入数据时发生错误:', error);
            animationMessage(result.success, `导入失败\n${result.message}`);
        } finally {
            document.getElementById('importGenshin').disabled = false;
            document.getElementById('importGenshin').innerText = '导入数据';
        }
    });
     document.getElementById('importZzz').addEventListener('click', async () => {
        const refreshButton = document.getElementById('importZzz');
        refreshButton.disabled = true;
        refreshButton.innerText = '请等待...';
        try {
            const result = await window.electronAPI.invoke('import-zzz-data');
            animationMessage(result.success, result.message);
        } catch (error) {
            console.error('导入数据时发生错误:', error);
            animationMessage(result.success, `导入失败\n${result.message}`);
        } finally {
            refreshButton.disabled = false;
            refreshButton.innerText = '导入数据';
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
}

// 动态加载工具子页面内容
function loadToolSubpage(toolPage) {
    const subpageContent = document.getElementById('subpage-content');

    console.log('Loading tool page:', toolPage); // Debug log
    subpageContent.classList.add('fade-out');

    setTimeout(() => {
        fetch(`pages/gameTools/${toolPage}.html`)
            .then(response => {
                if (!response.ok) {
                    animationMessage(false, `页面错误: ${response.status}`);
                    throw new Error(`页面错误: ${response.status}`);
                }
                return response.text();
            })
            .then(html => {
                subpageContent.innerHTML = html; // 插入子页面内容
                loadToolScript(toolPage);
                subpageContent.classList.remove('fade-out');
                subpageContent.classList.add('fade-in');
                setTimeout(() => subpageContent.classList.remove('fade-in'), 300);
            })
            .catch(error => {
                animationMessage(false, `${toolPage}加载失败`);
                console.error(`Failed to load tool page: ${error}`);
            });
    }, 200);
}


// 动态加载工具子页面的 JS 文件
function loadToolScript(toolPage) {
    const script = document.createElement("script");
    script.src = `js/gameTools/${toolPage}.js`;
    script.onload = () => {
        if (typeof window[`${toolPage}Init`] === 'function') {
            window[`${toolPage}Init`]();
        }
    };
    document.body.appendChild(script);
}

function openModal(modal) {
    modal.style.display = 'flex'; // 显示模态窗口
    modal.classList.add('fade-in');
    modal.classList.remove('fade-out');
}

function closeModal(modal) {
    modal.classList.remove('fade-in');
    modal.classList.add('fade-out');
    setTimeout(() => {
        modal.style.display = 'none'; // 延迟隐藏，等待动画完成
    }, 300); // 时间与动画持续时间一致
}



// 注册初始化函数
window.gameToolsInit = gameToolsInit;
