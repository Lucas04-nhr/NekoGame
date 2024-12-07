const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 生成随机的 32 字节密钥
function generateSecretKey() {
    return crypto.randomBytes(32);
}

// 加密函数
function encrypt(text, secretKey) {
    const IV = crypto.randomBytes(16);  // 随机生成初始化向量
    const cipher = crypto.createCipheriv('aes-256-cbc', secretKey, IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return { encryptedText: encrypted, iv: IV.toString('hex') };
}

// 解密函数
function decrypt(encryptedText, secretKey, iv) {
    const ivBuffer = Buffer.from(iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, ivBuffer);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// 存储加密信息到本地并保存加密密码
function saveSyncConfigToFile(repoUrl, token) {
    const secretKey = generateSecretKey();

    // 加密 repoUrl 和 token
    const { encryptedText: encryptedRepoUrl, iv: repoUrlIV } = encrypt(repoUrl, secretKey);
    const { encryptedText: encryptedToken, iv: tokenIV } = encrypt(token, secretKey);

    // 存储加密的配置和密钥
    const config = {
        encryptedRepoUrl,
        encryptedToken,
        repoUrlIV,
        tokenIV
    };

    const keyDirectory = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'key');
    if (!fs.existsSync(keyDirectory)) {
        fs.mkdirSync(keyDirectory);
    }

    const configFilePath = `${process.env.NEKO_GAME_FOLDER_PATH}/key/neko_config.neko`;
    const secretKeyFilePath = `${process.env.NEKO_GAME_FOLDER_PATH}/key/secret_key.neko`;

    // 保存配置信息（repoUrl 和 token）
    fs.writeFileSync(configFilePath, JSON.stringify(config));

    // 保存生成的 secretKey（不再使用 master-password）
    fs.writeFileSync(secretKeyFilePath, secretKey.toString('hex'));

    console.log('配置和加密密码已保存');
}

// 从本地读取并解密配置和加密密码
function loadSyncConfigFromFile() {
    const configFilePath = `${process.env.NEKO_GAME_FOLDER_PATH}/key/neko_config.neko`;
    const secretKeyFilePath = `${process.env.NEKO_GAME_FOLDER_PATH}/key/secret_key.neko`;

    if (fs.existsSync(configFilePath) && fs.existsSync(secretKeyFilePath)) {
        const configData = fs.readFileSync(configFilePath, 'utf8');
        const config = JSON.parse(configData);

        const secretKeyHex = fs.readFileSync(secretKeyFilePath, 'utf8');
        const secretKey = Buffer.from(secretKeyHex, 'hex');

        // 解密 repoUrl 和 token
        const decryptedRepoUrl = decrypt(config.encryptedRepoUrl, secretKey, config.repoUrlIV);
        const decryptedToken = decrypt(config.encryptedToken, secretKey, config.tokenIV);

        console.log('配置和加密密码已加载');

        return { decryptedRepoUrl, decryptedToken, secretKey };
    } else {
        console.error('配置文件或加密密码文件不存在');
        return null;
    }
}

module.exports = {saveSyncConfigToFile, loadSyncConfigFromFile} ;
