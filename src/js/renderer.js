document.addEventListener("DOMContentLoaded", () => {
    // 窗口控制按钮
    document.getElementById('minimize').addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
    });

    document.getElementById('maximize').addEventListener('click', () => {
        window.electronAPI.maximizeWindow();
    });

    document.getElementById('close').addEventListener('click', () => {
        window.electronAPI.closeWindow();
    });

    const content = document.getElementById("content");
    const tabs = document.querySelectorAll(".tab");
    let currentPage = null; // 初始化为空以确保首次加载

    // 加载指定页面
    function loadPage(page) {
        if (currentPage === page) {
            const activeTab = document.querySelector(`.tab[data-page="${page}"]`);
            activeTab.classList.add("clicked-effect");
            setTimeout(() => activeTab.classList.remove("clicked-effect"), 200);
            return;
        }

        content.classList.add("fade-out");
        setTimeout(() => {
            fetch(`pages/${page}.html`)
                .then(response => response.text())
                .then(html => {
                    content.innerHTML = html;
                    loadScript(page);
                    content.classList.remove("fade-out");
                    content.classList.add("fade-in");
                    setTimeout(() => content.classList.remove("fade-in"), 300);
                });
            currentPage = page;
        }, 200);
    }

    // 动态加载页面的 JS 文件并调用初始化函数
    function loadScript(page) {
        if (document.querySelector(`script[src="js/${page}.js"]`)) return; // 防止重复加载

        const script = document.createElement("script");
        script.src = `js/${page}.js`;
        script.onload = () => {
            if (typeof window[`${page}Init`] === 'function') {
                window[`${page}Init`]();
            }
        };
        content.appendChild(script);
    }

    // 监听选项卡切换
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            loadPage(tab.dataset.page);
        });
    });
    // 默认加载主页
    loadPage("home");

    // 监听下载进度
    window.electronAPI.onDownloadProgress((event, progress) => {
        const progressBarContainer = document.getElementById('progress-bar-container');
        const progressBar = document.getElementById('progress-bar');

        if (progressBarContainer && progressBar) {
            // 确保进度条容器可见
            progressBarContainer.style.display = 'block';

            // 更新进度条宽度
            progressBar.style.width = `${progress}%`;

            // 下载完成后隐藏进度条
            if (progress >= 100) {
                setTimeout(() => {
                    progressBarContainer.style.display = 'none';
                }, 1000);
            }
        } else {
            console.warn('进度条元素未找到');
        }
    });

});

