function checkUIGF(id, uid, gacha_type, time, rank_type, name, record){
    const missingFields = [];
    if (!id) missingFields.push("id");
    if (!uid) missingFields.push("uid");
    if (!gacha_type) missingFields.push("gacha_type");
    if (!time) missingFields.push("time");
    if (!rank_type) missingFields.push("rank_type");
    if (missingFields.length > 0) {
        const errorMessage = `缺少必要字段: ${missingFields.join(", ")}\n第 ${JSON.stringify(record)} 条记录\n这是UIGF数据\n但可能由于无对应转化表，无法导入`;
        global.Notify(false, errorMessage);
        throw new Error(errorMessage);
    }
}

module.exports = { checkUIGF}
