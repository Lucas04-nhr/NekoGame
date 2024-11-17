// 加载玩家 UID 下拉列表
async function loadPlayerUIDs(defaultUid) {
    const players = await window.electronAPI.getPlayerUIDs(); // 从数据库获取所有 UID
    const uidSelect = document.getElementById('uid-select');
    uidSelect.innerHTML = ''; // 清空选项

    // 添加玩家 UID 到下拉列表
    players.forEach(uid => {
        const option = document.createElement('option');
        option.value = uid;
        option.textContent = uid;
        if (uid === defaultUid) {
            option.selected = true;
        }
        uidSelect.appendChild(option);
    });
}

// 加载祈愿记录
async function loadGachaRecords(uid) {
    const records = await window.electronAPI.getGachaRecords(); // 获取所有记录
    const container = document.getElementById('record-display');
    container.innerHTML = ''; // 清空内容

    // 筛选当前 UID 的记录
    const filteredRecords = records.filter(r => r.player_id === uid);
    if (!filteredRecords.length) {
        container.innerHTML = '<p>没有祈愿记录。</p>';
        return;
    }
    const GACHA_TYPE_ORDER = [
        "角色活动唤取", "武器活动唤取", "角色常驻唤取",
        "武器常驻唤取", "新手唤取", "新手自选唤取",
        "感恩定向唤取"
    ];
    // 按卡池分类
    const pools = {};
    filteredRecords.forEach(record => {
        if (!pools[record.card_pool_type]) {
            pools[record.card_pool_type] = [];
        }
        pools[record.card_pool_type].push(record);
    });

    // 按顺序渲染卡池
    GACHA_TYPE_ORDER.forEach(poolType => {
        if (pools[poolType]) {
            const poolSection = document.createElement('div');
            poolSection.className = 'card-pool';

            // 卡池标题
            poolSection.innerHTML = `<div class="card-header">${poolType}</div>`;

            // 卡池内容
            const cardContent = document.createElement('div');
            cardContent.className = 'card-content';
            pools[poolType].forEach(record => {
                const item = document.createElement('div');
                item.className = 'record-item';
                item.innerHTML = `
                    <div>时间: ${record.timestamp}</div>
                    <div>物品: ${record.name}</div>
                    <div>星级: ${record.quality_level}</div>
                    <div>数量: ${record.count}</div>
                `;
                cardContent.appendChild(item);
            });

            poolSection.appendChild(cardContent);
            container.appendChild(poolSection);
        }
    });
}

async function gameToolsInit() {
    const lastUid = await window.electronAPI.getLastQueryUid(); // 获取上次查询的 UID
    await loadPlayerUIDs(lastUid); // 加载玩家 UID 下拉框
    await loadGachaRecords(lastUid); // 加载对应记录
}

// 监听 UID 切换
document.getElementById('uid-select').addEventListener('change', async (event) => {
    const selectedUid = event.target.value;
    await loadGachaRecords(selectedUid); // 加载选定 UID 的记录
});

// 刷新数据按钮
document.getElementById('refresh-data').addEventListener('click', async () => {
    const uid = document.getElementById('uid-select').value;
    const result = await window.electronAPI.refreshGachaRecords();
    if (result.success) {
        alert(`刷新成功，新增记录数：${result.count}`);
        await loadGachaRecords(uid);
    } else {
        alert(`刷新失败：${result.error}`);
    }
});

// 暴露初始化函数
window.gameToolsInit = gameToolsInit;
