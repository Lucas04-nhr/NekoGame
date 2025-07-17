// 全局错误处理装饰器
function withZzzMappingCheck(func) {
  return function (...args) {
    try {
      if (!currentZzzMapping) {
        // 尝试从第一个参数（通常是records数组）初始化映射
        const records = args.find((arg) => Array.isArray(arg));
        if (records && records.length > 0) {
          initializeZzzMapping(records);
        } else {
          throw new Error("无法初始化ZZZ星级映射：缺少数据");
        }
      }
      return func.apply(this, args);
    } catch (error) {
      console.error(`[ZZZ函数错误 ${func.name}]`, error.message);
      return `错误: ${error.message}`;
    }
  };
}

// 分析ZZZ数据的rank_type范围并建立映射
function analyzeZzzRankTypes(records) {
  if (!records || records.length === 0) {
    return {
      success: false,
      error: "无数据可分析",
      mapping: null,
    };
  }

  // 收集所有不同的 rank_type 值
  const rankTypes = new Set();
  records.forEach((record) => {
    if (record.quality_level !== undefined && record.quality_level !== null) {
      rankTypes.add(record.quality_level);
    }
  });

  const uniqueRanks = Array.from(rankTypes).sort((a, b) => b - a); // 从高到低排序

  console.log("[ZZZ星级分析] 发现的rank_type值:", uniqueRanks);

  // 检查是否恰好有3种星级
  if (uniqueRanks.length > 3) {
    return {
      success: false,
      error: `发现${uniqueRanks.length}种星级(${uniqueRanks.join(
        ", "
      )})，超过预期的3种(S/A/B级)，请检查数据格式`,
      mapping: null,
      details: uniqueRanks,
    };
  }

  if (uniqueRanks.length < 2) {
    return {
      success: false,
      error: `只发现${uniqueRanks.length}种星级(${uniqueRanks.join(
        ", "
      )})，数据不足以确定映射`,
      mapping: null,
      details: uniqueRanks,
    };
  }

  // 建立星级映射：从高到低对应 S, A, B
  const mapping = {};
  const levels = ["S", "A", "B"];

  for (let i = 0; i < uniqueRanks.length && i < 3; i++) {
    mapping[levels[i]] = uniqueRanks[i];
  }

  // 如果只有2种星级
  if (uniqueRanks.length === 2) {
    // 如果是连续的两个等级，则为A和B（没有S）
    if (uniqueRanks[0] - uniqueRanks[1] === 1) {
      mapping["S"] = null; // 没有S级
      mapping["A"] = uniqueRanks[0];
      mapping["B"] = uniqueRanks[1];
    } else {
      // 否则为S和A（没有B）
      mapping["B"] = null;
    }
  }

  console.log("[ZZZ星级分析] 建立的映射关系:", mapping);

  return {
    success: true,
    error: null,
    mapping: mapping,
    details: `成功分析：${uniqueRanks.length}种星级 - ${Object.entries(mapping)
      .filter(([k, v]) => v !== null)
      .map(([k, v]) => `${k}级=${v}`)
      .join(", ")}`,
    uniqueRanks: uniqueRanks,
  };
}

// 全局变量存储当前的星级映射
let currentZzzMapping = null;

// 初始化ZZZ星级映射
function initializeZzzMapping(records) {
  const analysis = analyzeZzzRankTypes(records);

  if (!analysis.success) {
    console.error("[ZZZ星级初始化失败]", analysis.error);
    throw new Error(`ZZZ数据导入失败: ${analysis.error}`);
  }

  currentZzzMapping = analysis.mapping;
  console.log("[ZZZ星级初始化成功]", analysis.details);

  return analysis;
}

// 判断是否为S级
function isZzzSRank(quality_level) {
  if (!currentZzzMapping) {
    throw new Error("ZZZ星级映射未初始化，请先调用 initializeZzzMapping()");
  }
  return quality_level === currentZzzMapping.S;
}

// 判断是否为A级
function isZzzARank(quality_level) {
  if (!currentZzzMapping) {
    throw new Error("ZZZ星级映射未初始化，请先调用 initializeZzzMapping()");
  }
  return quality_level === currentZzzMapping.A;
}

// 判断是否为B级
function isZzzBRank(quality_level) {
  if (!currentZzzMapping) {
    throw new Error("ZZZ星级映射未初始化，请先调用 initializeZzzMapping()");
  }
  return currentZzzMapping.B !== null && quality_level === currentZzzMapping.B;
}

// 获取星级字母表示
function getZzzQualityLetter(quality_level) {
  if (!currentZzzMapping) {
    throw new Error("ZZZ星级映射未初始化，请先调用 initializeZzzMapping()");
  }

  if (quality_level === currentZzzMapping.S) return "S";
  if (quality_level === currentZzzMapping.A) return "A";
  if (currentZzzMapping.B !== null && quality_level === currentZzzMapping.B)
    return "B";

  return "C"; // 未知等级
}

// ZZZ专用抽数计算逻辑
function calculateLastDrawsZzz(records, targetLevel) {
  // 确保映射已初始化
  if (!currentZzzMapping) {
    initializeZzzMapping(records);
  }

  let drawCount = -1; // 当前累计抽数
  for (let i = 0; i < records.length; i++) {
    // 从头开始遍历
    drawCount++;

    // 根据目标等级判断
    let isTargetQuality = false;
    if (targetLevel === "S") {
      isTargetQuality = isZzzSRank(records[i].quality_level);
    } else if (targetLevel === "A") {
      isTargetQuality = isZzzARank(records[i].quality_level);
    } else if (targetLevel === "B") {
      isTargetQuality = isZzzBRank(records[i].quality_level);
    } else {
      // 向后兼容：如果传入数字，直接比较
      isTargetQuality = records[i].quality_level === targetLevel;
    }

    if (isTargetQuality) {
      return drawCount; // 找到目标星级，返回累计抽数
    }
  }
  return drawCount; // 如果没有找到目标星级，返回总抽数
}

// ZZZ星级标准化函数 - 已移除，使用新的映射系统

// 判断是否为歪
function isOffBannersZzz(record, commonItems) {
  return (
    (record.card_pool_type === "独家频段" ||
      record.card_pool_type === "音擎频段") &&
    commonItems.includes(record.name)
  );
}

function calculateMostDrawsZzz(records, targetLevel) {
  // 确保映射已初始化
  if (!currentZzzMapping) {
    initializeZzzMapping(records);
  }

  // 筛选目标星级记录
  const qualityRecords = records.filter((r) => {
    if (targetLevel === "S") return isZzzSRank(r.quality_level);
    if (targetLevel === "A") return isZzzARank(r.quality_level);
    if (targetLevel === "B") return isZzzBRank(r.quality_level);
    // 向后兼容
    return r.quality_level === targetLevel;
  });

  if (qualityRecords.length === 0) return "暂未抽出S";

  let maxDraws = 0;
  let minDraws = Number.MAX_VALUE;

  qualityRecords.forEach((record, index) => {
    const nextIndex =
      index + 1 < qualityRecords.length
        ? records.indexOf(qualityRecords[index + 1])
        : records.length;

    const draws = nextIndex - records.indexOf(record);
    maxDraws = Math.max(maxDraws, draws);
    minDraws = Math.min(minDraws, draws);
  });

  return { maxDraws, minDraws };
}

// 计算平均抽卡数
function calculateDrawsBetweenZzz(records, targetLevel) {
  // 确保映射已初始化
  if (!currentZzzMapping) {
    initializeZzzMapping(records);
  }

  // 筛选目标星级记录
  const qualityRecords = records.filter((r) => {
    if (targetLevel === "S") return isZzzSRank(r.quality_level);
    if (targetLevel === "A") return isZzzARank(r.quality_level);
    if (targetLevel === "B") return isZzzBRank(r.quality_level);
    // 向后兼容
    return r.quality_level === targetLevel;
  });

  if (qualityRecords.length === 0) return "还没抽出S";
  let totalDraws = 0;
  qualityRecords.forEach((record, index) => {
    const nextIndex =
      index + 1 < qualityRecords.length
        ? records.indexOf(qualityRecords[index + 1])
        : records.length;
    totalDraws += nextIndex - records.indexOf(record);
  });
  return totalDraws / qualityRecords.length;
}
function calculateUpAverageZzz(records) {
  // 确保映射已初始化
  if (!currentZzzMapping) {
    initializeZzzMapping(records);
  }

  // 筛选S级UP记录
  const upRecords = records.filter(
    (r) =>
      isZzzSRank(r.quality_level) &&
      !commonItems.includes(r.name) &&
      (r.card_pool_type === "独家频段" || r.card_pool_type === "音擎频段")
  );
  if (upRecords.length === 0) return "还没抽出UP";
  // 遍历UP角色，累加抽数
  let totalDraws = 0;
  upRecords.forEach((record, index) => {
    const nextIndex =
      index + 1 < upRecords.length
        ? records.indexOf(upRecords[index + 1]) // 下一个UP角色的索引
        : records.length; // 最后一抽的索引
    totalDraws += nextIndex - records.indexOf(record); // 当前UP角色到下一个UP角色的距离
  });
  return totalDraws / upRecords.length; // 平均UP抽数
}

// 计算不歪概率
function calculateNoDeviationRateZzz(records) {
  // 确保映射已初始化
  if (!currentZzzMapping) {
    initializeZzzMapping(records);
  }

  // 筛选S级记录
  const fiveStarRecords = records.filter((r) => isZzzSRank(r.quality_level)); // 筛选S级记录

  if (!fiveStarRecords.length) return "无数据"; // 无S级记录

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

function getQualityLetter(level) {
  // 已弃用，使用 getZzzQualityLetter 替代
  return getZzzQualityLetter(level);
}

// 智能获取质量等级字母 - 已弃用，使用新系统
function getQualityLetterSmart(level, records) {
  // 确保映射已初始化
  if (!currentZzzMapping) {
    initializeZzzMapping(records);
  }
  return getZzzQualityLetter(level);
}

// 生成概览和详细列表
function generateOverviewZzz(records) {
  // 确保映射已初始化
  if (!currentZzzMapping) {
    initializeZzzMapping(records);
  }

  // 筛选S级记录
  const fiveStarRecords = records.filter((r) => isZzzSRank(r.quality_level));

  return fiveStarRecords
    .map((record, index) => {
      const nextIndex =
        index + 1 < fiveStarRecords.length
          ? records.indexOf(fiveStarRecords[index + 1])
          : records.length;

      const draws = nextIndex - records.indexOf(record);
      const color = getDrawColorZzz(draws, record.quality_level); // 获取颜色
      // 判断是否为"歪"
      const isOffBanner = isOffBannersZzz(record, commonItems);
      return `
            <div class="record">
                <span class="record-star gold">${getZzzQualityLetter(
                  record.quality_level
                )} 级</span>
                <span class="record-name" style="color: ${getColorByQualityZzz(
                  record.quality_level
                )};">${record.name}</span>
                <span class="record-draws-with-off-banner">
                    ${
                      isOffBanner
                        ? `<span class="record-off-banner" title="常驻角色">歪</span>`
                        : ""
                    }
                    <span class="record-draws" style="color: ${color};">${draws} 抽</span>
                </span>
            </div>
        `;
    })
    .join("");
}
function generateDetailsZzz(records) {
  // 确保映射已初始化
  if (!currentZzzMapping) {
    initializeZzzMapping(records);
  }

  const groupedRecords = groupRecordsByDate(records); // 按日期分组
  // 筛选记录
  const fiveStarRecords = records.filter((r) => isZzzSRank(r.quality_level)); // 筛选S级记录
  const fourStarRecords = records.filter((r) => isZzzARank(r.quality_level)); // 筛选A级记录

  return Object.keys(groupedRecords)
    .map((date) => {
      const recordsForDate = groupedRecords[date]; // 获取该日期的所有记录
      return `
                <div class="record-date-group">
                    <div class="record-date">${date}</div>
                    ${recordsForDate
                      .map((record) => {
                        let draws = "";

                        if (isZzzSRank(record.quality_level)) {
                          const currentIndex = records.indexOf(record);
                          const nextIndex = fiveStarRecords.find(
                            (r) => records.indexOf(r) > currentIndex
                          );
                          draws = nextIndex
                            ? records.indexOf(nextIndex) - currentIndex
                            : records.length - currentIndex;
                        } else if (isZzzARank(record.quality_level)) {
                          const currentIndex = records.indexOf(record);
                          const nextIndex = fourStarRecords.find(
                            (r) => records.indexOf(r) > currentIndex
                          );
                          draws = nextIndex
                            ? records.indexOf(nextIndex) - currentIndex
                            : records.length - currentIndex;
                        }

                        const color = getDrawColorZzz(
                          draws,
                          record.quality_level
                        ); // 获取颜色

                        // 判断是否为“歪”
                        const isOffBanner = isOffBannersZzz(
                          record,
                          commonItems
                        );

                        return `
                            <div class="record">
                                <span class="record-star" style="color: ${getColorByQualityZzz(
                                  record.quality_level
                                )};">
                                    ${getZzzQualityLetter(
                                      record.quality_level
                                    )} 级
                                </span>
                                <span class="record-name" style="color: ${getColorByQualityZzz(
                                  record.quality_level
                                )};">
                                    ${record.name}
                                </span>
                                ${
                                  draws
                                    ? `<span class="record-draws-with-off-banner">
                                            ${
                                              isOffBanner
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
                      })
                      .join("")}
                </div>
            `;
    })
    .join("");
}

// 辅助函数
// 根据抽数和质量获取颜色
function getDrawColorZzz(draws, quality) {
  // 使用新的映射系统判断星级
  if (isZzzSRank(quality)) {
    if (draws <= 35) return "#3399ff"; // 蓝色
    if (draws <= 67) return "#33cc33"; // 绿色
    return "#ff6666"; // 红色
  }
  if (isZzzARank(quality)) {
    if (draws <= 3) return "#3399ff"; // 蓝色
    if (draws <= 7) return "#33cc33"; // 绿色
    return "#ff6666"; // 红色
  }
  return "#aaa"; // 默认灰色
}

function getColorByQualityZzz(quality) {
  // 使用新的映射系统判断颜色
  if (isZzzSRank(quality)) return "#f3d58a"; // S级金色
  if (isZzzARank(quality)) return "#d6c7ff"; // A级紫色
  return "#6699ff"; // B级蓝色
}

// 生成图表
function renderPieChartZzz(records, poolType) {
  // 确保映射已初始化
  if (!currentZzzMapping) {
    initializeZzzMapping(records);
  }

  const chartId = `star-pie-chart-${poolType}`;
  const canvas = document.getElementById(chartId);
  if (!canvas) {
    console.error(`Canvas with id ${chartId} not found.`);
    return;
  }

  const ctx = canvas.getContext("2d");

  // 统计星级分布
  const starCounts = {
    S: records.filter((r) => isZzzSRank(r.quality_level)).length,
    A: records.filter((r) => isZzzARank(r.quality_level)).length,
    B: records.filter((r) => isZzzBRank(r.quality_level)).length,
  };

  // 创建图表数据对象
  const chartData = {
    labels: Object.keys(starCounts),
    datasets: [
      {
        data: Object.values(starCounts),
        backgroundColor: [
          "rgba(243, 213, 138, 0.8)",
          "rgba(214, 199, 255, 0.8)",
          "rgba(112, 158, 250, 0.8)",
        ],
      },
    ],
  };

  // 抽卡时间范围（仅显示到日期）
  const firstRecord = records[0]?.timestamp.split(" ")[0] || "未知";
  const lastRecord =
    records[records.length - 1]?.timestamp.split(" ")[0] || "未知";
  const dateRange = `${lastRecord} - ${firstRecord}`;

  // 动态生成星级数据块
  const starInfoHtml = `
        <div class="star-info">
            <span class="star-five" data-index="0">${starCounts["S"]}</span> |
            <span class="star-four" data-index="1">${starCounts["A"]}</span> |
            <span class="star-three" data-index="2">${starCounts["B"]}</span>
        </div>
        <div class="date-range">${dateRange}</div>
    `;

  // 插入到饼状图下方
  canvas.insertAdjacentHTML("afterend", starInfoHtml);

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
  const starElements =
    canvas.nextElementSibling.querySelectorAll(".star-info span");
  starElements.forEach((element) => {
    element.addEventListener("click", function () {
      const index = this.dataset.index; // 获取对应数据索引
      const meta = charts[poolType].getDatasetMeta(0); // 获取当前卡池图表的元数据
      meta.data[index].hidden = !meta.data[index].hidden; // 切换数据可见性
      charts[poolType].update(); // 更新当前图表
    });
  });
}

// 应用错误处理包装的主要函数
const calculateDrawsBetweenZzzSafe = withZzzMappingCheck(
  calculateDrawsBetweenZzz
);
const calculateUpAverageZzzSafe = withZzzMappingCheck(calculateUpAverageZzz);
const calculateNoDeviationRateZzzSafe = withZzzMappingCheck(
  calculateNoDeviationRateZzz
);
const calculateMostDrawsZzzSafe = withZzzMappingCheck(calculateMostDrawsZzz);
const calculateLastDrawsZzzSafe = withZzzMappingCheck(calculateLastDrawsZzz);
const generateOverviewZzzSafe = withZzzMappingCheck(generateOverviewZzz);
const generateDetailsZzzSafe = withZzzMappingCheck(generateDetailsZzz);
const renderPieChartZzzSafe = withZzzMappingCheck(renderPieChartZzz);

// 验证ZZZ数据完整性
function validateZzzData(records) {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return { valid: false, error: "无有效数据" };
  }

  // 检查必要字段
  const requiredFields = ["quality_level", "name", "card_pool_type"];
  const missingFields = [];

  for (const field of requiredFields) {
    if (!records.some((r) => r[field] !== undefined && r[field] !== null)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `缺少必要字段: ${missingFields.join(", ")}`,
    };
  }

  return { valid: true, error: null };
}

/**
 * 检查数据库中的ZZZ数据格式并提供修复建议
 * 这个函数可以帮助用户了解当前数据的状态
 */
function checkZzzDataFormat(records) {
  if (!records || records.length === 0) {
    return {
      format: "unknown",
      message: "无数据可检查",
      needsConversion: false,
    };
  }

  const rankTypes = new Set();
  records.forEach((record) => {
    if (record.quality_level !== undefined && record.quality_level !== null) {
      rankTypes.add(record.quality_level);
    }
  });

  const uniqueRanks = Array.from(rankTypes).sort((a, b) => b - a);

  // 判断数据格式 - 现在只检查是否为标准格式
  const hasStandardFormat = uniqueRanks.every((rank) => rank >= 2 && rank <= 4);

  if (hasStandardFormat) {
    return {
      format: "standard",
      message: `数据格式正确: ${uniqueRanks.join(", ")}`,
      needsConversion: false,
      ranks: uniqueRanks,
    };
  } else {
    return {
      format: "unknown",
      message: `未知数据格式: ${uniqueRanks.join(", ")}，请检查数据源`,
      needsConversion: false,
      ranks: uniqueRanks,
    };
  }
}
