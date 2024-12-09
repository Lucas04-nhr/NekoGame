if (!window.weeklyChart) window.weeklyChart = null;
if (!window.monthlyTrendChart) window.monthlyTrendChart = null;
if (!window.halfYearChart) window.halfYearChart = null;
if (!window.totalTimeDistributionChart) window.totalTimeDistributionChart = null;

function initializeCharts() {
    // 如果图表已经存在，先销毁它们，避免重复创建
    if (window.weeklyChart) {
        window.weeklyChart.destroy();
    }
    if (window.monthlyTrendChart) {
        window.monthlyTrendChart.destroy();
    }
    if (window.halfYearChart) {
        window.halfYearChart.destroy();
    }
    if (window.totalTimeDistributionChart) {
        window.totalTimeDistributionChart.destroy();
    }

    // 本周游戏时长分布（条形图）
    const weeklyCtx = document.getElementById('weekly-game-time-chart').getContext('2d');
    window.weeklyChart = new Chart(weeklyCtx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: '本周各游戏时长', data: [] }] },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: '游戏' } },
                y: { title: { display: true, text: '时长 (小时)' }, beginAtZero: true }
            }
        }
    });

    // 月度游戏时间趋势（折线图）
    const monthlyCtx = document.getElementById('monthly-trend-chart').getContext('2d');
    window.monthlyTrendChart = new Chart(monthlyCtx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: '游戏时长', data: [] }] },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: '日期' } },
                y: { title: { display: true, text: '时长 (小时)' }, beginAtZero: true }
            }
        }
    });

    window.halfYearChart = new Chart(document.getElementById('half-year-distribution-chart').getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: '日期' } },
                y: {
                    title: { display: true, text: '时长 (小时)' },
                    beginAtZero: true
                }
            }
        }
    });

    // 所有游戏的总时长分布（饼状图）
    const totalTimeCtx = document.getElementById('total-time-distribution-chart').getContext('2d');
    window.totalTimeDistributionChart = new Chart(totalTimeCtx, {
        type: 'pie',
        data: { labels: [], datasets: [{ label: '游戏总时长分布', data: [] }] },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

function requestRunningStatus() {
    window.electronAPI.send('request-running-status');
}


// 渲染游戏列表
function renderGameList(gameData) {
    if(!gameData){
        document.getElementById("game-list-container").innerHTML = "<p>请添加游戏</p>";
    }
    const container = document.getElementById('game-list-container');
    if (!container) return;

    container.innerHTML = ''; // 清空现有内容

    const runningGames = gameData.filter(game => game.isRunning);
    const notRunningGames = gameData.filter(game => !game.isRunning);

    const sortedGameData = [...runningGames, ...notRunningGames];

    sortedGameData.forEach(game => {
        const gameItem = document.createElement('div');
        gameItem.classList.add('game-item');
        gameItem.style.position = 'relative';

        const progressColor = game.isRunning ? 'rgba(187,253,140,0.7)' : 'rgba(204, 204, 204,0.4)';

        gameItem.innerHTML = `
            <img src="${game.poster_vertical || './assets/poster_vertical.webp'}" alt="${game.name}" class="game-poster">
            <div class="game-info">
                <h4>${game.name}</h4>
                <p>今日时长：${(game.today_time / 3600).toFixed(1)} h</p>
                <p>总时长：${(game.total_time / 3600).toFixed(1)} h</p>
                <p>近两周时长：${(game.two_weeks_time / 3600).toFixed(1)} h</p>
                <div class="progress-bar">
                    <div class="progress" style="background-color: ${progressColor};"></div>
                </div>
            </div>
            <div class="launch-hint hidden">再次点击即可启动游戏</div> <!-- 提示信息 -->
        `;

        let hasClickedOnce = false;
        let hintTimeout;

        gameItem.addEventListener('click', () => {
            const launchHint = gameItem.querySelector('.launch-hint');

            if (!hasClickedOnce) {
                hasClickedOnce = true;
                // 显示启动提示
                launchHint.classList.remove('hidden');
                launchHint.classList.add('fade-in');

                // 设置提示淡出动画
                hintTimeout = setTimeout(() => {
                    launchHint.classList.remove('fade-in');
                    launchHint.classList.add('fade-out');
                    setTimeout(() => {
                        launchHint.classList.add('hidden');
                        launchHint.classList.remove('fade-out');
                        hasClickedOnce = false; // 重置点击状态
                    }, 500);
                }, 1000); // 提示显示1秒

            } else {
                launchGame(game, launchHint);
                setTimeout(() => {
                        launchHint.classList.add('hidden');
                        launchHint.classList.remove('fade-out');
                        hasClickedOnce = false; // 重置点击状态
                }, 1000);
            }
        });
        container.appendChild(gameItem);
    });
}





// 加载游戏数据
function loadGameData(runningStatus) {
    window.electronAPI.getGameTimeData()
        .then((gameData) => {
            if (runningStatus) {
                gameData.forEach(game => {
                    const status = runningStatus.find(status => status.id === game.id);
                    game.isRunning = status ? status.isRunning : false;
                });
            }
            renderGameList(gameData);
        })
        .catch(err => console.error("Error loading game data:", err));
}

function launchGame(game, launchHint) {
    // 检查游戏是否已经在运行
    if (game.isRunning) {
        animationMessage(false, `正在运行 ${game.name}，请勿重复点击`)
        return;
    }
    // 调用主进程中的 launch-game
    window.electronAPI.launchGame(game.path)
        .then(() => {
            console.log(`成功启动 ${game.name}`);
            animationMessage(true, "游戏正在启动，请等待")
        })
        .catch((error) => {
            console.error(`无法启动 ${game.name}:`, error);
            animationMessage(false ,`无法启动 ${game.name}\n请检查路径是否正确。`)
        });
}


// 刷新游戏列表，重新获取状态
function refreshGameList() {
    requestRunningStatus();
    window.electronAPI.onRunningStatusUpdated((runningStatus) => {
        loadGameData(runningStatus);
    })
}


// 设置标签切换逻辑
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll(".tab-button");

    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            // 清除所有标签的激活状态并隐藏内容
            tabButtons.forEach(btn => btn.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(content => content.style.display = "none");

            // 激活当前标签并显示对应内容
            button.classList.add("active");
            const tabContent = document.getElementById(button.getAttribute("data-tab"));
            if (tabContent) {
                tabContent.style.display = "block";
            }

            // 切换到日志选项卡时自动加载20条数据
            if (button.getAttribute("data-tab") === "log") {
                loadLogData(true); // 重置并加载第一页数据
            }
        });
    });
}

// 默认显示概况内容
function displayDefaultTab() {
    const defaultTabButton = document.querySelector('.tab-button[data-tab="overview"]');
    const defaultTabContent = document.getElementById("overview");

    if (defaultTabButton && defaultTabContent) {
        defaultTabButton.classList.add("active");
        defaultTabContent.style.display = "block";
    }
}

// 初始加载和事件监听
function initialize() {
    requestRunningStatus(); // 请求初始运行状态
    // 监听初次运行状态返回事件
    window.electronAPI.onRunningStatusUpdated((runningStatus) => {
        // 使用返回的运行状态加载游戏数据
        loadGameData(runningStatus);
    });
    displayDefaultTab(); // 默认显示概况
    setupTabSwitching(); // 设置标签切换逻辑
}

// 设置事件监听器
function setupEventListeners() {
    // 监听游戏运行状态更新事件
    window.electronAPI.onRunningStatusUpdated((runningStatus) => {
        loadGameData(runningStatus);
    });
}




// 显示加载动画-待完成
function showLoadingAnimation() {}

// 隐藏加载动画-待完成
function hideLoadingAnimation() {}

// 显示分析数据
function displayAnalysisData(todayData, yesterdayData, todayUpdatedAt) {
    const todayTimeElement = document.getElementById('total-time-today');
    const yesterdayTimeElement = document.getElementById('total-time-yesterday');
    const lastUpdatedElement = document.getElementById('last-updated');

    if (todayTimeElement) {
        todayTimeElement.textContent = `今日总时长：${(todayData.total_time_today / 3600).toFixed(1)} h`;
    }
    if (yesterdayTimeElement) {
        yesterdayTimeElement.textContent = `昨日总时长：${(yesterdayData.total_time_yesterday / 3600).toFixed(1)} h`;
    }
    if (lastUpdatedElement) {
        lastUpdatedElement.textContent = `数据上次更新时间：${todayUpdatedAt}`;
    }
}

// 加载并显示分析数据
function loadAnalysisData() {
    showLoadingAnimation();

    window.electronAPI.getAnalysisData('today_total_time')
        .then(({ data: todayData, updatedAt: todayUpdatedAt }) => {
            window.electronAPI.getAnalysisData('yesterday_total_time')
                .then(({ data: yesterdayData }) => {
                    hideLoadingAnimation();
                    displayAnalysisData(todayData, yesterdayData, todayUpdatedAt);
                })
                .catch(err => {
                    hideLoadingAnimation();
                    console.error("Error loading yesterday's data:", err);
                });
        })
        .catch(err => {
            hideLoadingAnimation();
            console.error("Error loading today's data:", err);
        });
}

// 刷新分析数据
function refreshData() {
    const halfYearRange = document.getElementById('half-year-range').value || 'daily';
    const weeklyGameTime = document.getElementById('weekly-range').value || 'week';
    const monthlyTrend = document.getElementById('monthly-range').value || 'month';

    Promise.all([
        window.electronAPI.refreshAnalysisData('today_total_time'),
        window.electronAPI.refreshAnalysisData('yesterday_total_time'),
        window.electronAPI.refreshAnalysisData('weekly_game_time'),
        window.electronAPI.refreshAnalysisData('monthly_trend'),
        window.electronAPI.refreshAnalysisData('half_year_distribution', halfYearRange),
        window.electronAPI.refreshAnalysisData('total_time_distribution')
    ])
    .then(([todayResult, yesterdayResult, weeklyResult, monthlyResult, halfYearResult, totalTimeResult]) => {
        hideLoadingAnimation();

        displayAnalysisData(todayResult.data, yesterdayResult.data, todayResult.updatedAt);

        // 更新图表数据，并传入选择范围以正确汇总
        loadWeeklyGameTime(weeklyGameTime);
        updateChartData(monthlyTrendChart, monthlyResult.data, monthlyTrend, 'monthly_trend');

        // 加载半年内游戏分布
        loadHalfYearGameDistribution(halfYearRange);

        // 更新总时长分布图表
        updateChartData(totalTimeDistributionChart, totalTimeResult.data, null, 'total_time_distribution');
    })
    .catch(err => {
        hideLoadingAnimation();
        console.error("刷新数据出现错误:", err);
        animationMessage(false ,`刷新数据出现错误: ${err.message || JSON.stringify(err)}`);
    });
}



// 更新图表数据
function updateChartData(chart, data, range, type) {
    if (!chart || !Array.isArray(data)) return;

    let labels = [];
    let values = [];

    if (type === 'weekly_game_time') {
        const aggregatedData = {};

        if (range === 'week') {
            data.slice(0, 7).forEach(item => {
                aggregatedData[item.game_name] = (aggregatedData[item.game_name] || 0) + item.total_time;
            });
        } else if (range === 'six_months') {
            data.forEach(item => {
                aggregatedData[item.game_name] = (aggregatedData[item.game_name] || 0) + item.total_time;
            });
        }

        labels = Object.keys(aggregatedData);
        values = Object.values(aggregatedData).map(total => total / 3600);

    } else if (type === 'monthly_trend') {
        if (range === 'month') {
            const today = new Date();
            today.setHours(today.getHours() + 8); // 转换为 UTC-8
            const dateDataMap = {};

            for (let i = 29; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dateString = date.toISOString().slice(0, 10); // 转换为 YYYY-MM-DD 格式
                dateDataMap[dateString] = 0;
            }

            data.forEach(item => {
                const date = item.date.slice(0, 10);
                if (dateDataMap.hasOwnProperty(date)) {
                    dateDataMap[date] = item.total_time / 3600;
                }
            });

            labels = Object.keys(dateDataMap);
            values = Object.values(dateDataMap);

        } else if (range === 'six_months') {
            const dateDataMap = {};

            for (let i = 5; i >= 0; i--) {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                date.setHours(date.getHours() + 8); // 转换为 UTC-8

                const monthString = date.toISOString().slice(0, 7); // 转换为 YYYY-MM 格式
                dateDataMap[monthString] = 0;
            }

            data.forEach(item => {
                const month = item.date.slice(0, 7);
                if (dateDataMap.hasOwnProperty(month)) {
                    dateDataMap[month] += item.total_time / 3600;
                }
            });

            labels = Object.keys(dateDataMap);
            values = Object.values(dateDataMap);
        }

        // 计算非零天或月的平均时长
        const nonZeroValues = values.filter(value => value > 0);
        const averageTime = nonZeroValues.length ? nonZeroValues.reduce((acc, val) => acc + val, 0) / nonZeroValues.length : 0;

        // 设置平均时长的虚线
        if (chart.data.datasets.length === 1) {
            chart.data.datasets.push({
                label: `平均时长：${averageTime.toFixed(1)} 小时`,
                data: new Array(values.length).fill(averageTime),
                borderColor: 'rgba(255, 99, 132, 0.6)',
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0,
                borderWidth: 1,
                tension: 0
            });
        } else {
            chart.data.datasets[1].data = new Array(values.length).fill(averageTime);
            chart.data.datasets[1].label = `平均时长：${averageTime.toFixed(1)} 小时`;
        }
    } else if (type === 'total_time_distribution') {
        labels = data.map(item => item.game_name);
        values = data.map(item => item.total_time / 3600);
    }

    // 更新图表数据
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;

    // 仅在支持 x 轴标签的图表上设置标题
    if (chart.options.scales && chart.options.scales.x) {
        chart.options.scales.x.title.text = range === 'six_months' ? '月份' : '日期';
    }

    chart.update();
}


// 加载并绘制本周游戏时长分布
function loadWeeklyGameTime(range = 'week') {
    window.electronAPI.getAnalysisData('weekly_game_time')
        .then(response => {
            const { data } = response;
            if (!Array.isArray(data)) {
                throw new Error("Invalid data format for weekly game time");
            }

            let labels = [];
            let values = [];
            let labelText = ""; // 动态label

            if (range === 'week') {
                // 设置 label 为“本周游戏时长”
                labelText = "游戏时长";

                // 获取最近一周的数据
                const weeklyData = {};
                const today = new Date();
                today.setHours(today.getHours() - 8); // 转换为 UTC-8 (北京时间)

                // 计算过去7天的日期，并将其作为标签
                const weekStartDate = new Date(today);
                weekStartDate.setDate(today.getDate() - 6); // 获取一周前的日期

                // 遍历过去7天，初始化游戏数据
                for (let i = 0; i < 7; i++) {
                    const date = new Date(weekStartDate);
                    date.setDate(weekStartDate.getDate() + i);
                    const dateString = date.toISOString().slice(0, 10); // YYYY-MM-DD 格式
                    labels.push(dateString); // 日期作为标签
                }

                // 按游戏名汇总数据，计算每个游戏在过去7天的总时长
                data.forEach(item => {
                    const itemDate = item.date.slice(0, 10); // 截取日期部分 YYYY-MM-DD
                    if (labels.includes(itemDate)) {
                        // 如果该日期在标签中，则累计该游戏的时长
                        weeklyData[item.game_name] = (weeklyData[item.game_name] || 0) + item.total_time;
                    }
                });

                // 获取游戏名和对应的总时长
                labels = Object.keys(weeklyData);  // 游戏名称
                values = Object.values(weeklyData).map(total => total / 3600); // 转为小时

            } else if (range === 'six_months') {
                // 设置 label 为“近6个月游戏时长”
                labelText = "近6个月各游戏时长";

                // 获取近6个月的数据并按游戏名汇总
                const sixMonthsData = data.reduce((acc, item) => {
                    acc[item.game_name] = (acc[item.game_name] || 0) + item.total_time;
                    return acc;
                }, {});

                labels = Object.keys(sixMonthsData);
                values = Object.values(sixMonthsData).map(total => total / 3600); // 转为小时
            }

            // 如果没有数据，显示“无游戏时长数据”
            if (labels.length === 0) {
                labels = ["无游戏时长数据"];
                values = [0];
            }

            // 更新图表数据和 label
            window.weeklyChart.data.labels = labels;
            window.weeklyChart.data.datasets[0].data = values;
            window.weeklyChart.data.datasets[0].label = labelText; // 设置动态 label
            window.weeklyChart.options.scales.x.title.text = '游戏';
            window.weeklyChart.update();
        })
        .catch(err => console.error("Error loading weekly game time data:", err));
}



// 加载并绘制月度游戏时间
function loadMonthlyTrend(range = 'month') {
    window.electronAPI.getAnalysisData('monthly_trend')
        .then(response => {
            const { data } = response;
            if (!Array.isArray(data)) {
                throw new Error("Invalid data format for monthly trend");
            }

            // 调用 updateChartData 来更新图表，确保数据补全和平均线
            updateChartData(window.monthlyTrendChart, data, range, 'monthly_trend');
        })
        .catch(err => console.error("Error loading monthly trend data:", err));
}


// 定义游戏颜色映射，固定颜色
if (typeof gameColors === 'undefined') {
    var gameColors = {
        "Game 1": 'rgba(255, 99, 132, 0.5)',
        "Game 2": 'rgba(54, 162, 235, 0.5)',
        "Game 3": 'rgba(255, 206, 86, 0.5)',
        "Game 4": 'rgba(75, 192, 192, 0.5)',
        "Game 5": 'rgba(153, 102, 255, 0.5)',
        "Game 6": 'rgba(255, 159, 64, 0.5)'
    };
}


// 加载半年内游戏分布，range = 'daily' 为近两周，range = 'monthly' 为近6个月
function loadHalfYearGameDistribution(range = 'daily') {
    window.electronAPI.getAnalysisData('half_year_distribution', range)
        .then(response => {
            const { data } = response;
            if (!Array.isArray(data)) {
                throw new Error("Invalid data format");
            }

            // 获取标签，根据 range 设置最近30天或6个月
            let labels;
            if (range === 'daily') {
                labels = Array.from(new Set(data.map(d => d.date)))
                    .sort((a, b) => new Date(b) - new Date(a))
                    .slice(0, 30)
                    .reverse();
            } else if (range === 'monthly') {
                labels = Array.from(new Set(data.map(d => d.date.slice(0, 7))))
                    .sort((a, b) => new Date(b) - new Date(a))
                    .slice(0, 6)
                    .reverse();
            }

            // 按游戏分组，并填充缺失数据
            const games = Array.from(new Set(data.map(d => d.game_name))).slice(0, 6);
            const datasets = games.map(game => {
                // 创建日期-总时长的映射，并为缺失日期填充0
                const gameDataMap = labels.reduce((acc, label) => {
                    acc[label] = 0; // 默认值为0
                    return acc;
                }, {});

                // 填充实际数据
                data.forEach(d => {
                    if (d.game_name === game) {
                        const label = range === 'daily' ? d.date : d.date.slice(0, 7);
                        if (gameDataMap[label] !== undefined) {
                            gameDataMap[label] += d.total_time / 3600; // 累计时长
                        }
                    }
                });

                return {
                    label: game,
                    data: Object.values(gameDataMap), // 按 label 顺序填充数据
                    fill: false,
                    borderColor: gameColors[game],
                    tension: 0.1
                };
            });

            // 更新图表
            window.halfYearChart.data.labels = labels;
            window.halfYearChart.data.datasets = datasets;
            window.halfYearChart.options.scales.x.title.text = range === 'daily' ? '日期' : '月份';
            window.halfYearChart.update();
        })
        .catch(err => console.error("Error loading half-year game distribution data:", err));
}



// 加载所有游戏总时长分布
function loadTotalTimeDistribution() {
    // 定义饼状图的颜色
    const softPieChartColors = [
        'rgba(255, 99, 132, 0.5)', // 柔和的粉红色
        'rgba(54, 162, 235, 0.5)', // 柔和的蓝色
        'rgba(255, 206, 86, 0.5)', // 柔和的黄色
        'rgba(75, 192, 192, 0.5)', // 柔和的青色
        'rgba(153, 102, 255, 0.5)', // 柔和的紫色
        'rgba(255, 159, 64, 0.5)', // 柔和的橙色
        'rgba(128, 128, 128, 0.5)', // 柔和的灰色
        'rgba(52, 168, 83, 0.5)',  // 柔和的绿色
        'rgba(251, 188, 5, 0.5)',  // 柔和的金黄色
        'rgba(234, 67, 53, 0.5)'   // 柔和的深红色
    ];
    window.electronAPI.getAnalysisData('total_time_distribution')
        .then(response => {
            const { data, updatedAt } = response;
            if (!Array.isArray(data)) {
                console.error("Invalid data format for total time distribution:", data);
                throw new Error("Invalid data format");
            }

            // 销毁现有的图表实例以避免重复创建问题
            if (totalTimeDistributionChart) {
                totalTimeDistributionChart.destroy();
            }

            // 初始化新的饼状图
            const ctx = document.getElementById('total-time-distribution-chart').getContext('2d');
            totalTimeDistributionChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: data.map(item => item.game_name),
                    datasets: [{
                        label: '游戏总时长分布',
                        data: data.map(item => item.total_time / 3600), // 转为小时
                        backgroundColor: softPieChartColors, // 固定颜色
                        borderColor: '#222', // 外边框颜色
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'right'
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    return `${context.label}: ${context.raw.toFixed(1)} 小时`;
                                }
                            }
                        }
                    }
                }
            });

            console.log(`Total time distribution data last updated at: ${updatedAt}`);
        })
        .catch(err => console.error("Error loading total time distribution data:", err));
}

// 初始化事件监听器
document.getElementById('weekly-range').addEventListener('change', (event) => {
    const range = event.target.value;
    loadWeeklyGameTime(range);
});

document.getElementById('monthly-range').addEventListener('change', (event) => {
    const range = event.target.value;
    loadMonthlyTrend(range);
});

// 设置事件监听器用于切换时间范围
document.getElementById('half-year-range').addEventListener('change', (event) => {
    const range = event.target.value;
    loadHalfYearGameDistribution(range);
});


// 加载排行榜数据
function loadLeaderboard() {
    window.electronAPI.getLeaderboardData()
        .then(data => {
            const leaderboardContainer = document.getElementById('leaderboard-content');
            leaderboardContainer.innerHTML = ''; // 清空旧内容
            data.forEach(game => {
                const item = document.createElement('div');
                item.classList.add('list-item');
                const backgroundImage = game.poster_horizontal
                    ? `url('${window.electronAPI.filePathToURL(game.poster_horizontal)}')`
                    : `url('./assets/default-poster.jpg')`;
                item.style.backgroundImage = backgroundImage;

                item.innerHTML = `
                    <img src="${game.icon || './assets/default-icon.jpg'}" alt="${game.name}" class="game-icon">
                    <div class="game-info">
                        <h4>${game.name}</h4>
                        <p class="last-run-time">最后一次运行时间：${new Date(game.end_time).toLocaleString()}</p>
                        <p class="total-time">总时长：${(game.total_time / 3600).toFixed(1)} 小时</p>
                    </div>
                `;
                leaderboardContainer.appendChild(item);
            });
        })
        .catch(err => console.error("Error loading leaderboard data:", err));
}


// 监听页面切换，显示排行榜
document.querySelector('.tab-button[data-tab="leaderboard"]').addEventListener("click", loadLeaderboard);

// 将 logPage 声明为全局变量，确保只声明一次
if (typeof logPage === 'undefined') {
    var logPage = 0;
}
function loadLogData(reset = false) {
    const logContainer = document.getElementById('log-content');
    if (reset) {
        logContainer.innerHTML = '';  // 清空日志内容
        logPage = 0;  // 重置分页
    }
    window.electronAPI.getLogData(logPage)
        .then(logs => {
            const logContainer = document.getElementById('log-content');
            logs.forEach(log => {
                const logItem = document.createElement('div');
                logItem.classList.add('list-item');
                // 处理背景图片路径
                const backgroundImage = log.poster_horizontal
                    ? `url('${window.electronAPI.filePathToURL(log.poster_horizontal)}')`
                    : `url('./assets/default-poster.jpg')`;

                logItem.style.backgroundImage = backgroundImage;


                logItem.innerHTML = `
                    <img src="${log.icon || './assets/default-icon.jpg'}" alt="${log.game_name}" class="game-icon">
                    <div class="game-info">
                        <h4>${log.game_name}</h4>
                        <p class="log-date">日期：${new Date(log.start_time).toLocaleDateString()}</p>
                        <p class="log-date">开始时间：${new Date(log.start_time).toLocaleTimeString()}</p>
                        <p class="log-date">结束时间：${new Date(log.end_time).toLocaleTimeString()}</p>
                        <p class="total-time">时长：${(log.duration / 3600).toFixed(1)} 小时</p>
                    </div>
                `;
                logContainer.appendChild(logItem);
            });
            logPage += 1;
        })
        .catch(err => console.error("Error loading log data:", err));
}

// 滚动到底部时加载更多日志
document.getElementById('log-content').addEventListener('scroll', () => {
    const logContainer = document.getElementById('log-content');
    if (logContainer.scrollTop + logContainer.clientHeight >= logContainer.scrollHeight - 10) {
        loadLogData();
    }
});
// 滚动到底部时加载更多日志内容
function setupScrollLoad() {
    const contentDisplay = document.querySelector('.content-display');

    contentDisplay.addEventListener('scroll', () => {
        const logTabActive = document.getElementById('log').style.display !== 'none';

        // 只有在日志选项卡显示时加载更多数据
        if (logTabActive && contentDisplay.scrollTop + contentDisplay.clientHeight >= contentDisplay.scrollHeight - 10) {
            loadLogData(); // 加载更多日志数据
        }
    });
}


// 调用初始化函数和事件监听器
initializeCharts();
initialize();
setupEventListeners();
loadAnalysisData();
loadWeeklyGameTime();
loadMonthlyTrend();
loadHalfYearGameDistribution();
loadTotalTimeDistribution();
// 启用滚动检测
setupScrollLoad();

// 刷新按钮事件
document.getElementById('refresh-button').addEventListener('click', refreshData);



document.addEventListener("DOMContentLoaded", () => {
    const tabs = document.querySelectorAll(".tab-button");
    const contents = document.querySelectorAll(".tab-content");
    const refreshButton = document.getElementById("refresh-button");

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            // 清除活动状态
            tabs.forEach((t) => t.classList.remove("active"));
            contents.forEach((c) => c.classList.remove("active"));

            // 设置当前标签为活动状态
            tab.classList.add("active");
            const targetContent = document.getElementById(tab.dataset.tab);
            if (targetContent) targetContent.classList.add("active");
        });
    });

    // 刷新按钮的交互效果
    refreshButton.addEventListener("click", () => {
        refreshData();
        refreshButton.classList.add("spin");

        setTimeout(() => {
            refreshButton.classList.remove("spin");
        }, 1000);
    });

    // 样式补充：旋转动画
    const style = document.createElement("style");
    style.innerHTML = `
        .spin {
            animation: spin 1s ease-in-out;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
});
