const { ipcMain, dialog, BrowserWindow } = require("electron");
const fs = require("fs").promises;
const path = require("path");
const https = require("https");
const http = require("http");
const { getSetting, setSetting } = require("../database");

// 自定义CSS的ID，用于在页面中识别和移除
const CUSTOM_CSS_ID = "neko-game-custom-css";

/**
 * 从URL下载CSS内容
 * @param {string} url - CSS文件的URL
 * @returns {Promise<string>} CSS内容
 */
function downloadCSS(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(
            new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`)
          );
          return;
        }

        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          resolve(data);
        });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

/**
 * 读取本地CSS文件
 * @param {string} filePath - CSS文件路径
 * @returns {Promise<string>} CSS内容
 */
async function readLocalCSS(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content;
  } catch (error) {
    throw new Error(`无法读取CSS文件: ${error.message}`);
  }
}

/**
 * 获取CSS内容（严格互斥：本地文件优先，如果有本地文件则不使用网络URL）
 * @returns {Promise<{success: boolean, css?: string, source?: string, message?: string}>}
 */
async function getCSSContent() {
  const settings = await getCustomCSSSettings();

  if (!settings.enabled) {
    return { success: false, message: "自定义CSS未启用" };
  }

  // 优先使用本地CSS文件，如果有本地文件就不使用网络URL
  if (settings.localPath) {
    try {
      const css = await readLocalCSS(settings.localPath);
      return { success: true, css, source: "local" };
    } catch (error) {
      console.error("读取本地CSS失败:", error);
      return { success: false, message: `读取本地CSS失败: ${error.message}` };
    }
  }

  // 只有在没有本地文件时才尝试网络CSS URL
  if (settings.remoteURL) {
    try {
      const css = await downloadCSS(settings.remoteURL);
      return { success: true, css, source: "remote" };
    } catch (error) {
      console.error("下载网络CSS失败:", error);
      return { success: false, message: `下载CSS失败: ${error.message}` };
    }
  }

  return { success: false, message: "未配置CSS文件" };
}
/**
 * 获取自定义CSS设置
 * @returns {Promise<object>} CSS设置对象
 */
async function getCustomCSSSettings() {
  const enabled = await new Promise((resolve) => {
    getSetting("customCSSEnabled", (err, value) => {
      resolve(value === "true");
    });
  });

  const localPath = await new Promise((resolve) => {
    getSetting("customCSSLocalPath", (err, value) => {
      resolve(value || "");
    });
  });

  const remoteURL = await new Promise((resolve) => {
    getSetting("customCSSRemoteURL", (err, value) => {
      resolve(value || "");
    });
  });

  return { enabled, localPath, remoteURL };
}

/**
 * 应用CSS到所有窗口
 * @param {string} css - CSS内容
 */
function applyCSSToAllWindows(css) {
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach((window) => {
    if (window.webContents) {
      // 先移除之前的自定义CSS
      window.webContents
        .executeJavaScript(
          `
        const existingStyle = document.getElementById('${CUSTOM_CSS_ID}');
        if (existingStyle) {
          existingStyle.remove();
        }
      `
        )
        .catch(console.error);

      // 添加新的CSS
      window.webContents
        .executeJavaScript(
          `
        const style = document.createElement('style');
        style.id = '${CUSTOM_CSS_ID}';
        style.textContent = \`${css.replace(/`/g, "\\`")}\`;
        document.head.appendChild(style);
      `
        )
        .catch(console.error);
    }
  });
}

/**
 * 从所有窗口移除自定义CSS
 */
function removeCSSFromAllWindows() {
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach((window) => {
    if (window.webContents) {
      window.webContents
        .executeJavaScript(
          `
        const existingStyle = document.getElementById('${CUSTOM_CSS_ID}');
        if (existingStyle) {
          existingStyle.remove();
        }
      `
        )
        .catch(console.error);
    }
  });
}

// IPC 处理程序

// 加载自定义CSS设置
ipcMain.handle("load-custom-css-settings", async () => {
  try {
    return await getCustomCSSSettings();
  } catch (error) {
    console.error("加载自定义CSS设置失败:", error);
    return { enabled: false, localPath: "", remoteURL: "" };
  }
});

// 设置是否启用自定义CSS
ipcMain.handle("set-custom-css-enabled", async (event, enabled) => {
  try {
    await new Promise((resolve, reject) => {
      setSetting("customCSSEnabled", enabled.toString(), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return { success: true };
  } catch (error) {
    console.error("设置CSS启用状态失败:", error);
    return { success: false, message: error.message };
  }
});

// 设置本地CSS文件路径
ipcMain.handle("set-custom-css-local-path", async (event, path) => {
  try {
    await new Promise((resolve, reject) => {
      setSetting("customCSSLocalPath", path, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return { success: true };
  } catch (error) {
    console.error("设置本地CSS路径失败:", error);
    return { success: false, message: error.message };
  }
});

// 设置网络CSS URL
ipcMain.handle("set-custom-css-remote-url", async (event, url) => {
  try {
    await new Promise((resolve, reject) => {
      setSetting("customCSSRemoteURL", url, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return { success: true };
  } catch (error) {
    console.error("设置网络CSS URL失败:", error);
    return { success: false, message: error.message };
  }
});

// 选择CSS文件
ipcMain.handle("select-css-file", async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: "选择CSS文件",
      filters: [
        { name: "CSS文件", extensions: ["css"] },
        { name: "所有文件", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    return { success: true, filePath };
  } catch (error) {
    console.error("选择CSS文件失败:", error);
    return { success: false, message: error.message };
  }
});

// 应用自定义CSS
ipcMain.handle("apply-custom-css", async () => {
  try {
    const result = await getCSSContent();

    if (result.success) {
      applyCSSToAllWindows(result.css);
      return { success: true, source: result.source };
    } else {
      return { success: false, message: result.message };
    }
  } catch (error) {
    console.error("应用自定义CSS失败:", error);
    return { success: false, message: error.message };
  }
});

// 移除自定义CSS
ipcMain.handle("remove-custom-css", async () => {
  try {
    removeCSSFromAllWindows();
    return { success: true };
  } catch (error) {
    console.error("移除自定义CSS失败:", error);
    return { success: false, message: error.message };
  }
});

// 清除所有自定义CSS设置
ipcMain.handle("clear-all-custom-css", async () => {
  try {
    await Promise.all([
      new Promise((resolve, reject) => {
        setSetting("customCSSEnabled", "false", (err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
      new Promise((resolve, reject) => {
        setSetting("customCSSLocalPath", "", (err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
      new Promise((resolve, reject) => {
        setSetting("customCSSRemoteURL", "", (err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error("清除自定义CSS设置失败:", error);
    return { success: false, message: error.message };
  }
});

/**
 * 初始化自定义CSS
 * 在应用启动时调用，如果启用了自定义CSS则自动应用
 */
async function initializeCustomCSS() {
  try {
    const settings = await getCustomCSSSettings();
    if (settings.enabled) {
      // 延迟一点时间确保窗口已经加载完成
      setTimeout(async () => {
        try {
          const result = await getCSSContent();
          if (result.success) {
            applyCSSToAllWindows(result.css);
            console.log("自定义CSS已自动应用");
          } else {
            console.warn("自动应用自定义CSS失败:", result.message);
          }
        } catch (error) {
          console.error("应用自定义CSS时出错:", error);
        }
      }, 2000);
    }
  } catch (error) {
    console.error("初始化自定义CSS失败:", error);
  }
}

module.exports = {
  initializeCustomCSS,
  applyCSSToAllWindows,
  removeCSSFromAllWindows,
  getCSSContent,
};
