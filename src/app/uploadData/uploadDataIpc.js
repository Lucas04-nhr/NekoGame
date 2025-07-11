const { BrowserWindow, ipcMain, shell} = require('electron');
const { saveSyncConfigToFile, loadSyncConfigFromFile } = require('./syncSettings');
const path = require("path");
const {get, put} = require("axios");  // 引入获取设置的函数
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');

let dataSyncWindow = null;
function createDataSyncWindow() {
    if (dataSyncWindow) {
        return;
    }
    dataSyncWindow = new BrowserWindow({
        width: 500,
        height: 400,
        resizable: false,
        parent: mainWindow,
        modal: true,
        show: false,
        backgroundColor: 'rgba(60,60,60,0.64)',
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
    dataSyncWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // 拦截导航事件，阻止内部导航并改为默认浏览器打开
    dataSyncWindow.webContents.on('will-navigate', (event, url) => {
        if (url !== guideWindow.webContents.getURL()) {
            event.preventDefault(); // 阻止导航
            shell.openExternal(url); // 在默认浏览器中打开链接
        }
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
    // console.log('owner,repo,platform', owner, repo, platform);

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
/**
 * 上传或更新文件到 GitHub/Gitee 仓库，强制保存在 NekoGame 文件夹内
 * @param {string} repoUrl  仓库地址，如 https://github.com/owner/repo
 * @param {string} token    访问令牌
 * @param {string} filePath 本地文件路径
 * @param {string} fileName 本地文件名（不含目录），如 'gacha_data.db'
 * @param {string} [branch] 分支名称，默认 'main'
 */
async function uploadFileToRepo(repoUrl, token, filePath, fileName, branch = 'main') {
  const maxRetries = 3;
  let platformMessage = '';

  try {
    const { owner, repo, platform } = parseRepoUrl(repoUrl);
    platformMessage = platform;

    // 把远程路径统一前缀为 NekoGame/
    const remotePath = fileName.startsWith('NekoGame/')
      ? fileName
      : `NekoGame/${fileName}`;

    // 读取并 Base64 编码文件
    const fileContent = fs.readFileSync(filePath);
    const base64Content = fileContent.toString('base64');
    const commitMessage = `Update NekoGame 数据文件 (${fileName})`;

    if (platform === 'github') {
      // —— GitHub: 先 GET sha，再 PUT 创建/更新 ——
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${remotePath}`;
      const ghHeaders = {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json'
      };

      // 1.1. GET 元信息拿 sha
      let existingSha = null;
      try {
        const meta = await axios.get(apiUrl, {
          headers: ghHeaders,
          params: { ref: branch }
        });
        existingSha = meta.data.sha;
      } catch (err) {
        if (!(err.response && err.response.status === 404)) {
          throw err;
        }
      }

      // 1.2. PUT 创建或更新
      const body = { message: commitMessage, content: base64Content, branch };
      if (existingSha) body.sha = existingSha;
      const resp = await axios.put(apiUrl, body, { headers: ghHeaders });
      console.log(`${remotePath} 上传成功 (GitHub PUT):`, resp.data.content.path);
      return;

    } else if (platform === 'gitee') {
      // —— Gitee: POST/PUT + 重试 ——
      const apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${remotePath}`;
      const params = { access_token: token, branch };
      const body = { message: commitMessage, content: base64Content };

      // 先拿 gitee 上的 sha
      let existingSha = null;
      try {
        existingSha = await checkFileExists(repoUrl, token, remotePath, platform, branch);
      } catch (e) { /* 忽略 */ }
      if (existingSha) body.sha = existingSha;

      const method = existingSha ? 'put' : 'post';
      let tries = 0;
      while (true) {
        try {
          const resp = await axios[method](apiUrl, body, { params });
          console.log(`${remotePath} 上传成功 (Gitee ${method.toUpperCase()}):`, resp.data.content.path);
          return;
        } catch (err) {
          if (++tries >= maxRetries || existingSha) throw err;
          console.warn(`Gitee POST 失败，重试 (${tries}/${maxRetries})…`, err.message);
          await new Promise(r => setTimeout(r, 500));
        }
      }

    } else {
      throw new Error(`不支持的平台：${platform}`);
    }

  } catch (err) {
    let errMsg = `${fileName} 上传失败 (${platformMessage})\n`;
    if (err.response) {
      const status = err.response.status;
      if (status === 401) {
        errMsg += 'Token 无效或已过期，请更新后重试。';
      } else if (status === 403) {
        errMsg += '权限不足，请检查 Token 权限。';
      } else if (status === 404 && platformMessage === 'github') {
        errMsg += 'GitHub 返回 404，可能是路径不存在或 Token 权限不足。';
      } else {
        errMsg += `状态码: ${status}\n详情: ${err.response.data?.message}`;
      }
    } else {
      errMsg += `未知错误: ${err.message}`;
    }
    console.error(errMsg);
    global.Notify(false, errMsg);
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
    const { owner, repo, platform } = parseRepoUrl(repoUrl);
    const localFileTimestamp = getFileTimestamp(localFilePath);
    const giteeFileTimestamp = await getFileTimestampFromRepo(repoUrl, token, fileName);
    if (giteeFileTimestamp === null) {
        // 如果 Gitee 或者 Github 上文件不存在，上传本地文件
        console.log(platform, fileName, '文件不存在，上传本地文件...');
        await uploadFileToRepo(repoUrl, token, localFilePath, fileName);
    } else {
        console.log('localFileTimestamp,giteeFileTimestamp', localFileTimestamp,giteeFileTimestamp);
        // 定义时间范围
        const TIME_TOLERANCE = 600000; // 60分钟
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
                console.log(platform, fileName, '文件较新，准备下载...');
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
