const { BrowserWindow, ipcMain} = require('electron');
const { saveSyncConfigToFile, loadSyncConfigFromFile } = require('./syncSettings');
const path = require("path");
const {get, put} = require("axios");  // 引入获取设置的函数
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');

let dataSyncWindow = null;
function createDataSyncWindow() {
    if (dataSyncWindow) {
        return;  // 如果已有窗口，直接返回
    }
    dataSyncWindow = new BrowserWindow({
        width: 500,
        height: 400,
        resizable: false,
        parent: mainWindow,
        modal: true,
        show: false,
        backgroundColor: '#1e1e1e',
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true, // 开启上下文隔离
            preload: path.join(__dirname, '../../preload.js')
        }
    });
    // 加载数据同步窗口的 HTML 页面
    dataSyncWindow.loadFile('./src/pages/modalPages/dataSyncWindow.html');
    // 窗口加载完毕后显示
    dataSyncWindow.once('ready-to-show', () => {
        dataSyncWindow.show();
    });
    // 关闭窗口时清理引用
    dataSyncWindow.on('closed', () => {
        dataSyncWindow.destroy();
        dataSyncWindow = null;
    });
}
// 监听前端发送的 'openDataSyncWindow' 事件，创建数据同步窗口
ipcMain.on('openDataSyncWindow', () => {
    createDataSyncWindow();
});

// 监听前端发送的 'saveSyncSettings' 事件，保存同步设置
ipcMain.on('saveSyncSettings', (event, { repoUrl, token }) => {
    try {
        // 保存加密配置信息到文件
        saveSyncConfigToFile(repoUrl, token);
        event.reply('syncSettingsStatus', { success: true, message: '同步设置已成功更新并已经上传数据、之后每次启动应用后会自动同步数据' });
    } catch (error) {
        console.error('保存设置失败:', error);
        event.reply('syncSettingsStatus', { success: false, message: `保存失败: ${error.message}` });
    }
});
ipcMain.on('uploadFirstData', async (event) => {
    try {
        await initUpload();  // 确保上传过程是异步执行并等待完成
        event.reply('syncSettingsStatus', { success: true, message: '数据上传成功' });
    } catch (error) {
        console.error('初始化数据失败:', error);
        event.reply('syncSettingsStatus', { success: false, message: `同步失败: ${error.message}` });
    }
});

ipcMain.on('downloadLastedData', async (event, { repoUrl, token }) => {
    try {
        const neko_gameFilePath = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'neko_game.db');
        const gacha_dataFilePath = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'gacha_data.db');

        await downloadFileFromRepo(repoUrl, token, 'neko_game.db', neko_gameFilePath);
        await downloadFileFromRepo(repoUrl, token, 'gacha_data.db', gacha_dataFilePath);

        event.reply('syncSettingsStatus', { success: true, message: '数据下载成功' });
    } catch (error) {
        console.error('下载失败:', error);
        event.reply('syncSettingsStatus', { success: false, message: `下载失败: ${error.message}` });
    }
});


// 监听关闭数据同步窗口的事件
ipcMain.on('closeDataSyncWindow', () => {
    if (dataSyncWindow) {
        dataSyncWindow.close();  // 关闭数据同步窗口
    }
});

// 获取当前文件的时间戳
function getFileTimestamp(filePath) {
    const stats = fs.statSync(filePath);
    return Math.floor(stats.mtime.getTime() / 1000) * 1000;  // 转换为毫秒级时间戳
}


// 获取文件的时间戳
async function getFileTimestampFromRepo(repoUrl, token, fileName) {
    const { owner, repo, platform } = parseRepoUrl(repoUrl);
    console.log('owner,repo,platform', owner, repo, platform);

    let apiUrl, commitResponse;
    if (platform === 'gitee') {
        // 确保路径和分支名正确
        apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/commits?path=NekoGame/${fileName}`;
    } else if (platform === 'github') {
        apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=NekoGame/${fileName}`;
    } else {
        throw new Error('不支持的仓库平台');
    }
    try {
        // 设置请求头
        let headers = {};
        if (platform === 'github') {
            headers['Authorization'] = `token ${token}`;  // GitHub 的 token 使用 Authorization 头
        }
        let params = {};
        if (platform === 'gitee') {
            params.access_token = token;  // Gitee 使用查询参数传递 token
        }
        commitResponse = await axios.get(apiUrl, { headers: headers, params: params });
        console.log('apiUrl', apiUrl);
        // console.log('commitResponse信息', JSON.stringify(commitResponse.data));

        if (commitResponse.data && commitResponse.data.length > 0) {
            const commitDate = commitResponse.data[0].commit.committer.date;
            console.log('文件最新提交时间戳:', commitDate);
            return new Date(commitDate).getTime();  // 返回最新提交的时间戳
        } else {
            console.error('没有找到文件的提交记录');
            return null;
        }
    } catch (error) {
        console.error('获取文件时间戳失败:', error);
        return null;
    }
}


// 解析 仓库的 URL，获取 owner 和 repo
function parseRepoUrl(repoUrl) {
    const giteeRegex = /https:\/\/gitee\.com\/([^\/]+)\/([^\/]+)/;
    const githubRegex = /https:\/\/github\.com\/([^\/]+)\/([^\/]+)/;
    let matches;

    if ((matches = repoUrl.match(giteeRegex))) {
        return {
            owner: matches[1],
            repo: matches[2],
            platform: 'gitee'
        };
    } else if ((matches = repoUrl.match(githubRegex))) {
        return {
            owner: matches[1],
            repo: matches[2],
            platform: 'github'
        };
    } else {
        throw new Error('无效的仓库 URL');
    }
}

// 检查文件是否已存在于仓库中
async function checkFileExists(repoUrl, token, fileName, platform) {
    const { owner, repo } = parseRepoUrl(repoUrl);
    let apiUrl;

    if (platform === 'gitee') {
        // Gitee API 请求，使用 access_token 作为 URL 参数
        apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/NekoGame/${fileName}`;
    } else if (platform === 'github') {
        // GitHub API 请求，使用 Authorization header 传递 token
        apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/NekoGame/${fileName}`;
    } else {
        throw new Error('不支持的仓库平台');
    }

    try {
        const headers = platform === 'github' ? {
            'Authorization': `Bearer ${token}` // 使用 Bearer token 进行身份验证
        } : {}; // 对于 Gitee，不需要额外的 headers

        const response = await axios.get(apiUrl, {
            params: platform === 'gitee' ? { access_token: token } : {}, // 对于 Gitee 使用 access_token 作为 URL 参数
            headers: headers
        });

        // 返回文件的 SHA 值
        return response.data.sha;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null; // 文件不存在
        }
        throw error; // 其他错误
    }
}


// 上传文件到仓库
async function uploadFileToRepo(repoUrl, token, filePath, fileName) {
    let platformMessage = '';
    try {
        const { owner, repo, platform } = parseRepoUrl(repoUrl);
        platformMessage = platform;
        const fileContent = fs.readFileSync(filePath);
        const base64Content = fileContent.toString('base64');

        // 检查文件是否已经存在
        const existingSha = await checkFileExists(repoUrl, token, fileName, platform);
        let apiUrl;
        let data = {
            message: 'NekoGame数据文件',
            content: base64Content
        };

        if (platform === 'gitee') {
            apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/NekoGame/${fileName}`;
        } else if (platform === 'github') {
            apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/NekoGame/${fileName}`;
        } else {
            throw new Error('不支持的仓库平台');
        }

        if (existingSha) {
            const localFileHash = calculateFileHash(filePath);  // 计算本地文件的 hash 值
            data.sha = existingSha;
            if (localFileHash !== existingSha) {
                console.log('localFileHash,existingSha', localFileHash,existingSha);
                // 文件内容不同，准备更新
                console.log(`文件已存在，准备更新: ${fileName}`);
                const response = await axios.put(apiUrl, data, {
                    headers: platform === 'github'
                    ? { 'Authorization': `Bearer ${token}` }
                    : {},  // Gitee认证通过参数传递token
                    params: platform === 'gitee' ? { access_token: token } : {}  // Gitee需要在参数中传递token
                });
                console.log(fileName, '更新成功', response.data);
            } else {
                console.log('文件内容未更改，无需上传');
            }
        } else {
            // 文件不存在，准备上传
            console.log(`文件不存在，准备上传: ${fileName}`);
            const response = await axios.post(apiUrl, data, {
                headers: platform === 'github'
                    ? { 'Authorization': `Bearer ${token}` }
                    : {},
                params: platform === 'gitee' ? { access_token: token } : {}
            });
            console.log(fileName, '上传成功', response.data);
        }
    } catch (error) {
        if (error.response) {
            global.Notify(false, `${fileName}上传失败\n平台:${platformMessage}\n${error.response.data.message}`);
            console.error(fileName, '上传失败:', JSON.stringify(error.response.data), '平台', platformMessage);
        } else {
            global.Notify(false, `${fileName}上传失败\n可通过日志查看具体原因\n平台:${platformMessage}`);
        }
    }
}

const {backupFile} = require("./backupData");
// 从仓库下载文件
async function downloadFileFromRepo(repoUrl, token, fileName, localPath) {
    const { owner, repo, platform } = parseRepoUrl(repoUrl);  // 解析 repoUrl 获取 owner 和 repo
    let apiUrl;

    if (platform === 'gitee') {
        apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/NekoGame/${fileName}`;
    } else if (platform === 'github') {
        apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/NekoGame/${fileName}`;
    } else {
        throw new Error('不支持的仓库平台');
    }

    try {
        // 备份当前文件
        if (fs.existsSync(localPath)) {
            await backupFile(localPath, fileName);
        }

        const headers = platform === 'github' ? {
            'Authorization': `Bearer ${token}`
        } : {};
        const response = await axios.get(apiUrl, {
            params: platform === 'gitee' ? { access_token: token } : {},
            headers: headers
        });

        const fileContent = Buffer.from(response.data.content, 'base64');
        fs.writeFileSync(localPath, fileContent);
        console.log('文件下载成功:', fileName);
    } catch (error) {
        global.Notify(false, `${fileName}下载失败\n平台:${platform}\n${error.response ? error.response.data.message : error.message}`);
        console.error('数据下载失败:', error);
    }
}
// 计算文件的 hash 值
function calculateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');  // 返回文件的 hash 值
}

// 数据同步代码
async function autoUploadOrDownload(repoUrl, token, localFilePath, fileName) {
    const localFileTimestamp = getFileTimestamp(localFilePath);
    const giteeFileTimestamp = await getFileTimestampFromRepo(repoUrl, token, fileName);
    if (giteeFileTimestamp === null) {
        // 如果 Gitee 或者 Github 上文件不存在，上传本地文件
        console.log('Gitee', fileName, '文件不存在，上传本地文件...');
        await uploadFileToRepo(repoUrl, token, localFilePath, fileName);
    } else {
        console.log('localFileTimestamp,giteeFileTimestamp', localFileTimestamp,giteeFileTimestamp);
        // 定义时间范围
        const TIME_TOLERANCE = 60000; // 1分钟
        const timeDiff = Math.abs(localFileTimestamp - giteeFileTimestamp);
        if (timeDiff <= TIME_TOLERANCE) {
            console.log('本地文件和仓库中文件时间差异较小，无需同步');
        } else {
            // 如果 Gitee 上文件更新，比较时间戳
            if (localFileTimestamp > giteeFileTimestamp) {
                // 如果本地文件更新，上传本地文件
                console.log('本地', fileName, '文件较新，准备上传...');
                await uploadFileToRepo(repoUrl, token, localFilePath, fileName);
            } else if (localFileTimestamp < giteeFileTimestamp) {
                // 如果 仓库 文件更新，下载 仓库的 文件
                console.log('Gitee', fileName, '文件较新，准备下载...');
                await downloadFileFromRepo(repoUrl, token, fileName, localFilePath);
            }
        }
    }
}

// 初始化上传下载
function initUpload() {
    const config = loadSyncConfigFromFile();
    if (config) {
        const { decryptedRepoUrl, decryptedToken} = config;
        const neko_gameFilePath = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'neko_game.db');
        const gacha_dataFilePath = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'gacha_data.db');
        // 自动执行上传或下载操作
        console.log('准备同步neko_game.db');
        autoUploadOrDownload(decryptedRepoUrl, decryptedToken, neko_gameFilePath, 'neko_game.db');
        console.log('准备同步gacha_data.db');
        autoUploadOrDownload(decryptedRepoUrl, decryptedToken, gacha_dataFilePath, 'gacha_data.db');
    }
}


initUpload();
