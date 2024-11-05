const { contextBridge, ipcRenderer } = require('electron');
let appPath = ''; // 初始化应用路径
let dbPath = ''; // 初始化 dbPath
ipcRenderer.on('set-db-path', (_, path) => {
    dbPath = path;
});


ipcRenderer.on('set-app-path', (_, path) => {
    appPath = path;
});

function filePathToURL(filePath) {
    if (!filePath) return '';
    if (filePath.startsWith('./assets')) {
        filePath = `${appPath}/${filePath.replace('./', '')}`;
    }
    return `file://${filePath.replace(/\\/g, '/').replace(/ /g, '%20')}`;
}



contextBridge.exposeInMainWorld('electronAPI', {
    loadGames: () => ipcRenderer.invoke("load-games"),
    addGame: (gameData) => ipcRenderer.invoke("add-game", gameData),
    openFile: () => ipcRenderer.invoke("open-file"),
    selectImageFile: () => ipcRenderer.invoke("select-image"),
    getGameTrendData: (gameId) => ipcRenderer.invoke('get-game-trend-data', gameId),
    getGameDetails: (gameId) => ipcRenderer.invoke('get-game-details', gameId),
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    getGameTimeData: () => ipcRenderer.invoke('get-game-time-data'),
    onRunningStatusUpdated: (callback) => {
        ipcRenderer.on('running-status-updated', (event, data) => callback(data));
    },
    onGameDataUpdated: (callback) => {
        ipcRenderer.on('game-data-updated', callback);
    },
    getAnalysisData: (type, range) => ipcRenderer.invoke('fetch-analysis-data', { type, range }),
    refreshAnalysisData: (type) => ipcRenderer.invoke('refresh-analysis-data', type),
    getGameTimeData: () => ipcRenderer.invoke('get-game-time-data'),
    getLeaderboardData: () => ipcRenderer.invoke('getLeaderboardData'),
    getLogData: (page) => ipcRenderer.invoke('get-log-data', page),
    deleteGame: (gameId) => ipcRenderer.invoke("delete-game", gameId),
    updateGame: (gameData) => ipcRenderer.invoke("update-game", gameData),
    filePathToURL,
    saveSetting: (key, value) => ipcRenderer.invoke("save-setting", key, value),
    loadSettings: () => ipcRenderer.invoke("load-settings"),
    setAutoLaunch: (enabled) => ipcRenderer.invoke("set-auto-launch", enabled),
    checkErrors: () => ipcRenderer.invoke("check-errors"), 
});
