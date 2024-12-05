const {db} = require('../../app/database');
const {ipcMain, dialog } = require('electron');

// 保存设置到数据库
ipcMain.handle('saveBackgroundSettings', async (event, key, value) => {
    try {
        await db.run(`
            INSERT INTO settings (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) 
            DO UPDATE SET value = excluded.value
        `, [key, value]);  // 插入或更新
        console.log(`设置保存成功: ${key} = ${value}`);
    } catch (error) {
        console.error('保存设置失败:', error);
    }
});

// 改写为异步函数
async function loadBackgroundSettings() {
    try {
        const rows = await new Promise((resolve, reject) => {
            db.all('SELECT key, value FROM settings WHERE key IN ("backgroundImage", "backgroundOpacity")', [], (err, rows) => {
                if (err) {
                    reject('加载背景设置失败:' + err);
                } else {
                    resolve(rows);
                }
            });
        });
        // 格式化数据为 key-value 对
        return rows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {}); // 返回数据
    } catch (err) {
        console.error(err);
        return {};  // 出现错误时返回空对象
    }
}

// 监听渲染进程请求
ipcMain.handle('loadBackgroundSettings', async (event) => {
     // 调用函数获取背景设置
    return event.returnValue = await loadBackgroundSettings();  // 将数据返回给渲染进程
});


// 打开文件选择对话框
ipcMain.handle('selectBackgroundFile', async () => {
    return await dialog.showOpenDialog({
        properties: ['openFile'],  // 允许选择文件
        filters: [{name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']}]
    });  // 返回选择的文件路径
});

// 加载背景设置
async function loadBackground(mainWindow) {
    try {
        // 请求加载背景设置
        const settings = await loadBackgroundSettings();
        // 检查并应用背景设置
        if (settings.backgroundImage) {
            const backgroundPath = settings.backgroundImage.replace(/\\/g, '/'); // 转换路径分隔符
            const bgOpacity = settings.backgroundOpacity || '0.5'; // 默认透明度

            // 设置背景样式
            mainWindow.webContents.executeJavaScript(`
                document.body.style.background = "linear-gradient(rgba(33, 33, 33, ${bgOpacity}), rgba(33, 33, 33, ${bgOpacity})), url('file://${backgroundPath}')";
                document.body.style.backgroundSize = "cover";
                document.body.style.backgroundRepeat = "no-repeat";
                document.body.style.backgroundPosition = "center";
            `);
        } else {
            // 如果没有设置背景图片，使用默认背景样式
            mainWindow.webContents.executeJavaScript(`
                document.body.style.background = "linear-gradient(rgba(33, 33, 33, 0.5), rgba(33, 33, 33, 0.5))";
                document.body.style.backgroundSize = "cover";
                document.body.style.backgroundRepeat = "no-repeat";
                document.body.style.backgroundPosition = "center";
            `);
        }
    } catch (err) {
        global.Notify(false, `加载背景设置时出错\n${err}`);
    }
}

ipcMain.handle('restoreDefaultBackgroundSettings', async () => {
    try {
        // 默认背景图片路径和透明度
        const defaultBackgroundImage = null;
        const defaultOpacity = '0.5';  // 默认透明度

        // 更新数据库
        await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['backgroundImage', defaultBackgroundImage]);
        await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['backgroundOpacity', defaultOpacity]);

        console.log('已恢复默认背景设置');
    } catch (error) {
        console.error('恢复默认背景设置失败:', error);
    }
});

module.exports = { loadBackground };

