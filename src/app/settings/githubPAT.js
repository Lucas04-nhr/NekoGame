const { ipcMain } = require("electron");

let store;

// 异步初始化 electron-store
async function initStore() {
  if (!store) {
    const Store = (await import("electron-store")).default;
    store = new Store();
  }
  return store;
}

// 获取 GitHub Personal Access Token
ipcMain.handle("get-github-pat", async () => {
  try {
    const storeInstance = await initStore();
    return storeInstance.get("githubPAT", "");
  } catch (error) {
    console.error("获取 GitHub PAT 失败:", error);
    return "";
  }
});

// 保存 GitHub Personal Access Token
ipcMain.handle("save-github-pat", async (event, pat) => {
  try {
    const storeInstance = await initStore();

    // 验证 PAT 格式
    if (!pat || typeof pat !== "string") {
      throw new Error("无效的 PAT 格式");
    }

    // 简单的格式验证
    if (!pat.startsWith("ghp_") && !pat.startsWith("github_pat_")) {
      throw new Error('PAT 格式不正确，应以 "ghp_" 或 "github_pat_" 开头');
    }

    storeInstance.set("githubPAT", pat);
    console.log("GitHub PAT 已保存");
    return { success: true };
  } catch (error) {
    console.error("保存 GitHub PAT 失败:", error);
    throw error;
  }
});

// 清除 GitHub Personal Access Token
ipcMain.handle("clear-github-pat", async () => {
  try {
    const storeInstance = await initStore();
    storeInstance.delete("githubPAT");
    console.log("GitHub PAT 已清除");
    return { success: true };
  } catch (error) {
    console.error("清除 GitHub PAT 失败:", error);
    throw error;
  }
});

// 获取 GitHub PAT 用于 API 请求（供其他模块使用）
async function getGithubPATForAPI() {
  try {
    const storeInstance = await initStore();
    return storeInstance.get("githubPAT", null);
  } catch (error) {
    console.error("获取 GitHub PAT 用于 API 失败:", error);
    return null;
  }
}

module.exports = {
  getGithubPATForAPI,
};
