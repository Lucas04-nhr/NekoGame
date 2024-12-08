const commonItems = ["安可", "卡卡罗", "凌阳", "鉴心", "维里奈",
        "千古洑流", "浩境粼光", "停驻之烟", "擎渊怒涛","漪澜浮录",
    "布洛妮娅", "瓦尔特", "克拉拉", "杰帕德", "姬子", "白露", "彦卿",
"拂晓之前", "于夜色中", "时节不居", "但战斗还未结束", "制胜的瞬间", "如泥酣眠",
"银河铁道之夜", "无可取代的东西", "以世界之名",
"七七", "莫娜", "刻晴", "迪卢克", "琴", "天空之脊", "和璞鸢", "四风原典", "天空之卷", "天空之翼", "阿莫斯之弓",
"狼的末路", "天空之傲", "天空之刃", "风鹰剑",
"11号","猫又", "格莉丝", "珂蕾妲", "莱卡恩", "丽娜",
    "钢铁肉垫", "硫磺石", "拘缚者", "燃狱齿轮", "啜泣摇篮", "嵌合编译器"]; //这里是常驻
const upItems = commonItems;
// 判断是否为歪
function isOffBanners(record, upItems) {
    return (record.card_pool_type === "角色活动跃迁" || record.card_pool_type === "光锥活动跃迁" ||
        record.card_pool_type === "角色活动唤取" || record.card_pool_type === "武器活动祈愿" || record.card_pool_type === "角色活动祈愿"
        || record.card_pool_type === "独家频段"|| record.card_pool_type === "音擎频段")
        && upItems.includes(record.name);
}

// 按卡池分类记录
function categorizeRecords(records) {
    const pools = {};
    records.forEach(record => {
        if (!pools[record.card_pool_type]) {
            pools[record.card_pool_type] = [];
        }
        pools[record.card_pool_type].push(record);
    });
    return pools;
}


// 抽数计算逻辑
function calculateLastDraws(records, quality) {
    let drawCount = -1; // 当前累计抽数
    for (let i = 0; i < records.length; i++) { // 从头开始遍历
        drawCount++;
        if (records[i].quality_level === quality) {
            return drawCount; // 找到目标星级，返回累计抽数
        }
    }
    return drawCount; // 如果没有找到目标星级，返回总抽数
}

function calculateMostDraws(records, quality) {
    const qualityRecords = records.filter(r => r.quality_level === quality);
    if (qualityRecords.length === 0) return "暂未抽出五星";

    let maxDraws = 0;
    let minDraws = Number.MAX_VALUE;

    qualityRecords.forEach((record, index) => {
        const nextIndex = index + 1 < qualityRecords.length
            ? records.indexOf(qualityRecords[index + 1])
            : records.length;

        const draws = nextIndex - records.indexOf(record);
        maxDraws = Math.max(maxDraws, draws);
        minDraws = Math.min(minDraws, draws);
    });

    return { maxDraws, minDraws };
}


// 计算平均抽卡数
function calculateDrawsBetween(records, quality) {
    const qualityRecords = records.filter(r => r.quality_level === quality);
    if (qualityRecords.length === 0) return "还没抽出五星";
    let totalDraws = 0;
    qualityRecords.forEach((record, index) => {
        const nextIndex = index + 1 < qualityRecords.length
            ? records.indexOf(qualityRecords[index + 1])
            : records.length;
        totalDraws += nextIndex - records.indexOf(record);
    });
    return totalDraws / qualityRecords.length;
}
function calculateUpAverage(records) {
    const upRecords = records.filter(
        r => r.quality_level === 5
        && !commonItems.includes(r.name)
        && (r.card_pool_type === "角色活动跃迁" || r.card_pool_type === "光锥活动跃迁" || r.card_pool_type === "角色活动唤取"
            || r.card_pool_type === "武器活动祈愿" || r.card_pool_type === "角色活动祈愿")
    );
    if (upRecords.length === 0) return "还没抽出UP";
    // 遍历UP角色，累加抽数
    let totalDraws = 0;
    upRecords.forEach((record, index) => {
        const nextIndex = index + 1 < upRecords.length
            ? records.indexOf(upRecords[index + 1]) // 下一个UP角色的索引
            : records.length; // 最后一抽的索引
        totalDraws += nextIndex - records.indexOf(record); // 当前UP角色到下一个UP角色的距离
    });
    return totalDraws / upRecords.length; // 平均UP抽数
}



// 计算不歪概率
function calculateNoDeviationRate(records) {
    const fiveStarRecords = records.filter(r => r.quality_level === 5); // 筛选五星记录

    if (!fiveStarRecords.length) return "无数据"; // 无五星记录

    let noDeviationCount = 0;
    let upCount = 0;

    for (let i = 0; i < fiveStarRecords.length; i++) {
        const record = fiveStarRecords[i];

        // 判断是否为 UP 角色
        const isUpCharacter = !commonItems.includes(record.name);
        if (isUpCharacter) {
            upCount++; // 统计 UP 角色数量

            // 如果是第一个五星角色或者前一个五星也是UP角色
            if (i === 0 || !commonItems.includes(fiveStarRecords[i - 1]?.name)) {
                noDeviationCount++;
            }
        }
    }

    if (upCount === 0) return "还没抽出UP"; // 无UP角色
    return `${((noDeviationCount / upCount) * 100).toFixed(2)}%`; // 返回不歪概率
}



// 生成概览和详细列表
function generateOverview(records) {
    const fiveStarRecords = records.filter(r => r.quality_level === 5);

    return fiveStarRecords.map((record, index) => {
        const nextIndex = index + 1 < fiveStarRecords.length
            ? records.indexOf(fiveStarRecords[index + 1])
            : records.length;

        const draws = nextIndex - records.indexOf(record);
        const color = getDrawColor(draws, record.quality_level); // 获取颜色
        // 判断是否为“歪”
        const isOffBanner = isOffBanners(record, upItems);
        return `
            <div class="record">
                <span class="record-star gold">${record.quality_level} 星</span>
                <span class="record-name" style="color: ${getColorByQuality(record.quality_level)};">${record.name}</span>
                <span class="record-draws-with-off-banner">
                    ${isOffBanner ? `<span class="record-off-banner" title="常驻角色">歪</span>` : ""}
                    <span class="record-draws" style="color: ${color};">${draws} 抽</span>
                </span>
            </div>
        `;
    }).join('');
}
function generateDetails(records) {
    const groupedRecords = groupRecordsByDate(records); // 按日期分组
    const fiveStarRecords = records.filter(r => r.quality_level === 5); // 筛选五星记录
    const fourStarRecords = records.filter(r => r.quality_level === 4); // 筛选四星记录

    return Object.keys(groupedRecords)
        .map(date => {
            const recordsForDate = groupedRecords[date]; // 获取该日期的所有记录
            return `
                <div class="record-date-group">
                    <div class="record-date">${date}</div>
                    ${recordsForDate.map(record => {
                        let draws = '';

                        if (record.quality_level === 5) {
                            const currentIndex = records.indexOf(record);
                            const nextIndex = fiveStarRecords.find(r => records.indexOf(r) > currentIndex);
                            draws = nextIndex
                                ? records.indexOf(nextIndex) - currentIndex
                                : records.length - currentIndex;
                        } else if (record.quality_level === 4) {
                            const currentIndex = records.indexOf(record);
                            const nextIndex = fourStarRecords.find(r => records.indexOf(r) > currentIndex);
                            draws = nextIndex
                                ? records.indexOf(nextIndex) - currentIndex
                                : records.length - currentIndex;
                        }

                        const color = getDrawColor(draws, record.quality_level); // 获取颜色

                        // 判断是否为“歪”
                        const isOffBanner = isOffBanners(record, upItems);

                        return `
                            <div class="record">
                                <span class="record-star" style="color: ${getColorByQuality(record.quality_level)};">
                                    ${record.quality_level} 星
                                </span>
                                <span class="record-name" style="color: ${getColorByQuality(record.quality_level)};">
                                    ${record.name}
                                </span>
                                ${
                                    draws
                                        ? `<span class="record-draws-with-off-banner">
                                            ${isOffBanner
                                                ? `<span class="record-off-banner" title="常驻角色">歪</span>`
                                                : ""
                                            }
                                            <span class="record-draws" style="color: ${color};">
                                                ${draws} 抽
                                            </span>
                                        </span>`
                                        : ""
                                }
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        })
        .join('');
}



// 分组逻辑
function groupRecordsByDate(records) {
    return records.reduce((grouped, record) => {
        const date = record.timestamp.split(' ')[0]; // 提取日期部分
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(record);
        return grouped;
    }, {});
}


// 辅助函数
// 根据抽数和质量获取颜色
function getDrawColor(draws, quality) {
    if (quality === 5) {
        if (draws <= 35) return '#3399ff'; // 蓝色
        if (draws <= 67) return '#33cc33'; // 绿色
        return '#ff6666'; // 红色
    }
    if (quality === 4) {
        if (draws <= 3) return '#3399ff'; // 蓝色
        if (draws <= 7) return '#33cc33'; // 绿色
        return '#ff6666'; // 红色
    }
    return '#aaa'; // 默认灰色
}


// 根据五星平均抽数返回评价
function getRating(avg, avgUpText = null) {
    // 检查数据有效性
    if (avg === "无数据") return "无数据";
    if (avgUpText === "无数据" || avgUpText === null) {
        if (avg <= 15) return "万里挑一至尊欧皇";
        if (avg <= 30) return "万里挑一欧皇";
        if (avg <= 55) return "尊贵欧皇";
        if (avg <= 60) return "薛定谔的欧皇";
        if (avg <= 68) return "欧非守恒";
        if (avg <= 71) return "薛定谔的非酋";
        if (avg <= 73) return "绝世非酋";
        if (avg <= 75) return "万里挑一非酋";
        return "万里挑一绝世非酋";
    }
    // 如果有数据，则以平均up数判断欧非
    if (avgUpText <= 20) return "万里挑一至臻欧皇";
    if (avgUpText <= 35) return "万里挑一至尊欧皇";
    if (avgUpText <= 45) return "万里挑一欧皇";
    if (avgUpText <= 55) return "至臻欧皇";
    if (avgUpText <= 75) return "至尊欧皇";
    if (avgUpText <= 85) return "薛定谔的欧皇";
    if (avgUpText <= 95) return "欧非守恒";
    if (avgUpText <= 115) return "薛定谔的非酋";
    if (avgUpText <= 125) return "绝世非酋";
    if (avgUpText <= 135) return "万里挑一非酋";
    return "万里挑一绝世非酋";
}

function getColorByQuality(quality) {
    if (quality === 5) return '#f3d58a';
    if (quality === 4) return '#d6c7ff';
    return '#6699ff';
}


// 生成图表
function renderPieChart(records, poolType) {
    const chartId = `star-pie-chart-${poolType}`;
    const canvas = document.getElementById(chartId);
    if (!canvas) {
        console.error(`Canvas with id ${chartId} not found.`);
        return;
    }

    const ctx = canvas.getContext("2d");

    // 统计星级分布
    const starCounts = {
        "五星": records.filter(r => r.quality_level === 5).length,
        "四星": records.filter(r => r.quality_level === 4).length,
        "三星": records.filter(r => r.quality_level === 3).length,
    };

    // 创建图表数据对象
    const chartData = {
        labels: Object.keys(starCounts),
        datasets: [
            {
                data: Object.values(starCounts),
                backgroundColor: ["rgba(243, 213, 138, 0.8)", "rgba(214, 199, 255, 0.8)", "rgba(112, 158, 250, 0.8)"],
            },
        ],
    };

    // 抽卡时间范围（仅显示到日期）
    const firstRecord = records[0]?.timestamp.split(' ')[0] || "未知";
    const lastRecord = records[records.length - 1]?.timestamp.split(' ')[0] || "未知";
    const dateRange = `${lastRecord} - ${firstRecord}`;

    // 动态生成星级数据块
    const starInfoHtml = `
        <div class="star-info">
            <span class="star-five" data-index="0">${starCounts["五星"]}</span> |
            <span class="star-four" data-index="1">${starCounts["四星"]}</span> |
            <span class="star-three" data-index="2">${starCounts["三星"]}</span>
        </div>
        <div class="date-range">${dateRange}</div>
    `;

    // 插入到饼状图下方
    canvas.insertAdjacentHTML('afterend', starInfoHtml);

    // 初始化图表并存储实例
    charts[poolType] = new Chart(ctx, {
        type: "doughnut", // 使用 doughnut 类型
        data: chartData,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false, // 隐藏默认标签
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const value = context.raw || 0;
                            return `${value} 抽`;
                        },
                    },
                },
            },
            animation: {
                duration: 1000,
                animateScale: true,
                animateRotate: true,
            },
        },
    });

    // 为每个数字绑定点击事件
    const starElements = canvas.nextElementSibling.querySelectorAll('.star-info span');
    starElements.forEach((element) => {
        element.addEventListener('click', function () {
            const index = this.dataset.index; // 获取对应数据索引
            const meta = charts[poolType].getDatasetMeta(0); // 获取当前卡池图表的元数据
            meta.data[index].hidden = !meta.data[index].hidden; // 切换数据可见性
            charts[poolType].update(); // 更新当前图表
        });
    });
}
