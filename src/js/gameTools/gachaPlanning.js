if (!window.activeCharts) {
  window.activeCharts = {};
}

async function renderGameCards() {
  const gameDataCache = {};
  const games = [
    {
      name: "原神",
      repo: "genshin.json",
      currencyName: "原石",
      uidMethod: "get-genshin-player-uids",
      lastUidMethod: "get-last-genshin-uid",
      recordMethod: "get-genshin-gacha-records",
    },
    {
      name: "崩坏：星穹铁道",
      repo: "starRail.json",
      currencyName: "星琼",
      uidMethod: "get-starRail-player-uids",
      lastUidMethod: "get-last-starRail-uid",
      recordMethod: "get-starRail-gacha-records",
    },
    {
      name: "鸣潮",
      repo: "wuWa.json",
      currencyName: "星声",
      uidMethod: "get-player-uids",
      lastUidMethod: "get-last-query-uid",
      recordMethod: "get-gacha-records",
    },
    {
      name: "绝区零",
      repo: "ZZZ.json",
      currencyName: "菲林",
      uidMethod: "get-zzz-player-uids",
      lastUidMethod: "get-last-zzz-uid",
      recordMethod: "get-zzz-gacha-records",
    },
  ];

  const container = document.getElementById("game-card-container");
  container.innerHTML = "";

  for (const game of games) {
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <div class="game-card-layout">
        <div class="details-info">
          <h2 class="game-title">${game.name}</h2>
          <div class="controls">
            <p class="game-version"><strong>版本:</strong> 加载中...</p>
            <p class="game-time"><strong>持续时间:</strong> 加载中...</p>
            <label for="uid-select-${game.repo}"><strong>当前 UID:</strong> </label>
            <select id="uid-select-${game.repo}" class="custom-select"></select>
            <p class="game-avg-character-up"><strong>平均角色 UP:</strong> 加载中...</p>
            <p class="game-avg-weapon-up"><strong>平均武器 UP:</strong> 加载中...</p>
            <label for="version-select-${game.repo}"><strong>当前版本:</strong></label>
            <select id="version-select-${game.repo}" class="custom-select"></select>
          </div>
          <p class="game-data-source">数据来源: <a href="#" target="_blank">加载中...</a> 仅供参考，以来源与官方实际情况为准</p>
        </div>
        <div class="details-chart">
           <div class="controls">
            <span class="highlight"><p class="game-currency"><strong>预计 ${game.currencyName}:</strong> 加载中...</p></span>
            <span class="highlight1"><p class="game-draws"><strong>抽数:</strong> 加载中...</p></span>
            <span class="highlight"><p class="game-currency-s"><strong>预计 ${game.currencyName}:</strong> 加载中...</p></span>
            <span class="highlight1"><p class="game-draws-s"><strong>抽数:</strong> 加载中...</p></span>
            <span class="highlight"><p class="game-currency-l"><strong>预计 ${game.currencyName}:</strong> 加载中...</p></span>
            <span class="highlight1"><p class="game-draws-l"><strong>抽数:</strong> 加载中...</p></span>
          </div>
          <canvas id="chart-${game.repo}"></canvas>
        </div>
      </div>
    `;
    container.appendChild(card);

    const data = await window.electronAPI.invoke("get-game-data", game.repo);
    if (data) {
      gameDataCache[game.repo] = { ...data, currencyName: game.currencyName };

      const firstVersionKey = Object.keys(data.history)[0];
      const firstVersionData = data.history[firstVersionKey];

      card.querySelector(".game-version").innerText = `版本: ${firstVersionKey}`;
      card.querySelector(".game-time").innerText = `${firstVersionData.start_date} - ${firstVersionData.end_date}`;
      card.querySelector(".game-currency").innerText = `平民可获${game.currencyName}: ${firstVersionData.currency || "暂无"}`;
      card.querySelector(".game-draws").innerText = `折合抽数: ${firstVersionData.currency ? (firstVersionData.currency / 160).toFixed(1) : "--"}`;
      card.querySelector(".game-currency-s").innerText = `月卡可获${game.currencyName}: ${firstVersionData.currencyS || "暂无"}`;
      card.querySelector(".game-draws-s").innerText = `折合抽数: ${firstVersionData.currencyS ? (firstVersionData.currencyS / 160).toFixed(1) : "--"}`;
      card.querySelector(".game-currency-l").innerText = `大月卡可获${game.currencyName}: ${firstVersionData.currencyL || "暂无"}`;
      card.querySelector(".game-draws-l").innerText = `折合抽数: ${firstVersionData.currencyL ? (firstVersionData.currencyL / 160).toFixed(1) : "--"}`;
      card.querySelector(".game-data-source a").href = firstVersionData.source_url;
      card.querySelector(".game-data-source a").innerText = "点击查看";

      const uidSelect = document.getElementById(`uid-select-${game.repo}`);
      const versionSelect = document.getElementById(`version-select-${game.repo}`);
      const chartContainer = document.getElementById(`chart-${game.repo}`);

      const uids = await window.electronAPI.invoke(game.uidMethod);
      if (uids.length === 0) {
        const placeholderOption = document.createElement("option");
        placeholderOption.text = "暂无 UID";
        placeholderOption.disabled = true;
        placeholderOption.selected = true;
        uidSelect.appendChild(placeholderOption);
      } else {
        uids.forEach((uid) => {
          const option = document.createElement("option");
          option.value = uid;
          option.text = uid;
          uidSelect.appendChild(option);
        });
      }

      const lastUid = await window.electronAPI.invoke(game.lastUidMethod);
      uidSelect.value = lastUid;

      const filteredRecords = await loadUidRecords(lastUid, game);
      const categorizedRecords = categorizeRecords(filteredRecords);

      updateCardWithPoolAverages(card, categorizedRecords, game.name);

      Object.keys(data.history).forEach((version) => {
        const option = document.createElement("option");
        option.value = version;
        option.text = version;
        versionSelect.appendChild(option);
      });

      versionSelect.value = firstVersionKey;

      versionSelect.addEventListener("change", (event) => {
        const versionData = data.history[event.target.value];
        renderChart(chartContainer, versionData.sources);
        card.querySelector(".game-version").innerText = `版本: ${event.target.value}`;
        card.querySelector(".game-time").innerText = `${versionData.start_date} - ${versionData.end_date}`;
        card.querySelector(".game-currency").innerText = `平民可获${game.currencyName}: ${versionData.currency || "暂无"}`;
        card.querySelector(".game-draws").innerText = `折合抽数: ${versionData.currency ? (versionData.currency / 160).toFixed(1) : "--"}`;
        card.querySelector(".game-currency-s").innerText = `月卡可获${game.currencyName}: ${versionData.currencyS || "暂无"}`;
        card.querySelector(".game-draws-s").innerText = `折合抽数: ${versionData.currencyS ? (versionData.currencyS / 160).toFixed(1) : "--"}`;
        card.querySelector(".game-currency-l").innerText = `大月卡可获${game.currencyName}: ${versionData.currencyL || "暂无"}`;
        card.querySelector(".game-draws-l").innerText = `折合抽数: ${versionData.currencyL ? (versionData.currencyL / 160).toFixed(1) : "--"}`;
        card.querySelector(".game-data-source a").href = versionData.source_url;
        card.querySelector(".game-data-source a").innerText = "点击查看";
      });

      renderChart(chartContainer, firstVersionData.sources);

      uidSelect.addEventListener("change", async (event) => {
        const uid = event.target.value;
        const newRecords = await loadUidRecords(uid, game);
        const newCategorizedRecords = categorizeRecords(newRecords);
        updateCardWithPoolAverages(card, newCategorizedRecords, game.name);
      });
    }
  }
}

function updateCardWithPoolAverages(card, categorizedRecords, gameName) {
  const CHARACTER_POOLS = ["角色活动跃迁", "角色活动唤取", "角色活动祈愿", "独家频段"];
  const WEAPON_POOLS = ["光锥活动跃迁", "武器活动祈愿", "音擎频段", "武器活动唤取"];

  const characterPools = CHARACTER_POOLS.filter(pool => Array.isArray(categorizedRecords[pool]));
  const weaponPools = WEAPON_POOLS.filter(pool => Array.isArray(categorizedRecords[pool]));

  const characterUpElement = card.querySelector(".game-avg-character-up");
  const weaponUpElement = card.querySelector(".game-avg-weapon-up");

  if (!characterUpElement || !weaponUpElement) {
    console.error("Missing required DOM elements in card:", card);
    return;
  }

  if (gameName === "绝区零") {
    // 绝区零的特殊处理
    characterUpElement.innerText = characterPools.length
      ? `平均角色UP: ${
          characterPools[0] && typeof calculateUpAverageZzz(categorizedRecords[characterPools[0]]) === "number"
            ? calculateUpAverageZzz(categorizedRecords[characterPools[0]]).toFixed(2)
            : "--"
        }`
      : "平均角色UP: --";

    weaponUpElement.innerText = weaponPools.length
      ? `平均武器UP: ${
          weaponPools[0] && typeof calculateUpAverageZzz(categorizedRecords[weaponPools[0]]) === "number"
            ? calculateUpAverageZzz(categorizedRecords[weaponPools[0]]).toFixed(2)
            : "--"
        }`
      : "平均武器UP: --";
  } else {
    characterUpElement.innerText = characterPools.length
      ? `平均角色UP: ${
          characterPools[0] && typeof calculateUpAverage(categorizedRecords[characterPools[0]]) === "number"
            ? calculateUpAverage(categorizedRecords[characterPools[0]]).toFixed(2)
            : "--"
        }`
      : "平均角色UP: --";

    weaponUpElement.innerText = weaponPools.length
      ? `平均武器UP: ${
          weaponPools[0] && typeof calculateUpAverage(categorizedRecords[weaponPools[0]]) === "number"
            ? calculateUpAverage(categorizedRecords[weaponPools[0]]).toFixed(2)
            : "--"
        }`
      : "平均武器UP: --";
  }
}


async function loadUidRecords(uid, game) {
  const records = await window.electronAPI.invoke(game.recordMethod);
  // 根据游戏类型选择过滤字段
  const idField = game.name === "鸣潮" ? "player_id" : "uid";
  return records.filter((record) => record[idField] === uid);
}


function renderChart(container, sources) {
  if (window.activeCharts[container.id]) {
    window.activeCharts[container.id].destroy();
  }

  window.activeCharts[container.id] = new Chart(container.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: Object.keys(sources),
      datasets: [{
        data: Object.values(sources),
        backgroundColor: ['rgba(255,99,132,0.6)', 'rgba(54,162,235,0.6)', 'rgba(255,206,86,0.6)', 'rgba(113,211,211,0.6)',
          'rgba(78,118,209,0.6)', 'rgba(75,216,86,0.6)', 'rgba(160,75,216,0.6)', 'rgba(243,132,197,0.6)',
        'rgba(230,138,72,0.6)', 'rgba(62,248,176,0.6)', 'rgba(165,202,33,0.6)', 'rgba(202,33,154,0.6)'],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 10,
            font: {
              size: 12,
            },
          },
        },
      },
      layout: {
        padding: {
          right: 20,
        },
      },
    },
  });
}

async function gachaPlanningInit(){
  // 初始化页面
  await renderGameCards();
  // 检查外部链接
  document.querySelectorAll('a[target="_blank"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const url = e.currentTarget.href;
      window.electronAPI.openExternal(url);
    });
  });
}

window.gachaPlanningInit = gachaPlanningInit;
