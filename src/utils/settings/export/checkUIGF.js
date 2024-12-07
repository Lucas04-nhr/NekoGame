
function checkUIGF(id, uid, gacha_id, gacha_type, time, rank_type, record){
    const missingFields = [];
    if (!id) missingFields.push("id");
    if (!uid) missingFields.push("uid");
    if (!gacha_id) missingFields.push("gacha_id");
    if (!gacha_type) missingFields.push("gacha_type");
    if (!time) missingFields.push("time");
    if (!rank_type) missingFields.push("rank_type");

    if (missingFields.length > 0) {
        const errorMessage = `无效的数据: 缺少必要字段: ${missingFields.join(", ")}\n记录: ${JSON.stringify(record)}\n由于无对应字典，无法导入`;
        global.Notify(false, errorMessage);
        throw new Error(errorMessage);
    }
}

module.exports = { checkUIGF}
