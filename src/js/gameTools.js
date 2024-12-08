function gameToolsInit() {
    const toolList = document.getElementById('tool-list');
    const subpageContent = document.getElementById('subpage-content');
    const globalBackButton = document.getElementById('global-back-button'); // 全局返回按钮

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
        const result = await window.electronAPI.invoke('exportGachaData');
        animationMessage(result.success, result.message);
    });
    document.getElementById('exportStarRail').addEventListener('click', async () => {
        await window.electronAPI.invoke('export-starRail-data');
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
    document.getElementById('exportGenshin').addEventListener('click', async () => {
        document.getElementById('exportGenshin').disabled = true;
        document.getElementById('exportGenshin').innerText = '请等待...';
        try {
        await window.electronAPI.invoke('export-genshin-data');
        } catch (error) {
             animationMessage(false, `导出失败\n${error}`);
        } finally {
            document.getElementById('exportGenshin').disabled = false;
            document.getElementById('exportGenshin').innerText = '导出数据';
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
     document.getElementById('exportZzz').addEventListener('click', async () => {
        await window.electronAPI.invoke('export-zzz-data');
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

// 注册初始化函数
window.gameToolsInit = gameToolsInit;
