const { URL, URLSearchParams } = require('url');
const { get } = require('axios');

async function fetchGachaRecords(allRecords, GACHA_TYPE_MAP, gachaUrl, event) {
    const size = 20; // 每页20条记录
    let totalFetched = 0; // 本次查询到的总数据量
    const parsedUrl = new URL(gachaUrl);

    for (const [gachaType, gachaName] of Object.entries(GACHA_TYPE_MAP)) {
        console.log(`正在获取 ${gachaName} 的祈愿记录...`);
        let hasMoreData = true;
        let page = 1;
        let endId = '0';
        let retries = 0;

        while (hasMoreData && retries < 3) {
            try {
                const queryParams = new URLSearchParams(parsedUrl.search);
                queryParams.set("gacha_type", gachaType);
                queryParams.set("page", page.toString());
                queryParams.set("size", size.toString());
                queryParams.set("end_id", endId);

                // 动态选择接口路径
                let endpointPath = parsedUrl.pathname;
                if (['21', '22'].includes(gachaType)) {
                    endpointPath = '/common/gacha_record/api/getLdGachaLog';
                }

                const urlWithParams = `${parsedUrl.origin}${endpointPath}?${queryParams.toString()}`;

                const response = await get(urlWithParams);
                const data = response.data;

                console.log(`获取 ${gachaName} 第 ${page} 页数据...`);
                event.sender.send('gacha-records-status', `获取 ${gachaName} 第 ${page} 页数据...`);
                console.log('回应数据', JSON.stringify(data));

                if (data.retcode !== 0 || !data.data.list || data.data.list.length === 0) {
                    console.error(`获取 ${gachaName} 第 ${page} 页数据失败，跳过该页`);
                    event.sender.send('gacha-records-status', `获取 ${gachaName} 第 ${page} 页数据失败，跳过该页`);
                    retries++;
                    if (retries >= 3) {
                        console.error(`重试超过次数，停止获取 ${gachaName}`);
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 300));
                    continue;
                }

                const fetchedRecords = data.data.list;
                allRecords[gachaType] = allRecords[gachaType].concat(fetchedRecords);
                totalFetched += fetchedRecords.length;

                endId = fetchedRecords[fetchedRecords.length - 1].id;
                hasMoreData = fetchedRecords.length === size;

                await new Promise(resolve => setTimeout(resolve, 300));
                page++;
            } catch (err) {
                console.error(`请求 ${gachaName} 第 ${page} 页失败:`, err);
                retries++;
                if (retries >= 3) {
                    console.error(`重试超过次数，停止获取 ${gachaName}`);
                    global.Notify(false, `重试超过3次，停止获取 ${gachaName}`)
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
    }

    return totalFetched;
}

module.exports = { fetchGachaRecords };
