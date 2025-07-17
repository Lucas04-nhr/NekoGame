# UIGF 字典下载功能说明

## 功能概述

本功能实现了从 UIGF API 下载物品名称字典的功能，支持原神(genshin)、星穹铁道(starrail)、绝区零(zzz)三个游戏的中文简体(chs)字典。

**✨ 新特性**:

- **自动下载**: 每次启动应用时自动下载最新字典
- **时间追踪**: 记录并显示每个字典的最近下载时间

## 实现的功能

### 1. 字典下载 (fetchUIGF.js)

- **downloadUIGFDict(game, lang)**: 下载单个游戏的字典
- **downloadAllUIGFDicts(lang)**: 下载所有支持游戏的字典
- **checkDictExists(game, lang)**: 检查字典文件是否存在
- **loadDict(game, lang)**: 读取字典文件数据
- **saveDownloadTimestamp(game, lang)**: 保存字典下载时间戳
- **getDownloadTimestamp(game, lang)**: 获取字典下载时间戳
- **getAllDownloadTimestamps(lang)**: 获取所有字典的下载时间戳
- **autoDownloadDictsOnStartup(lang)**: 启动时自动下载字典

### 2. IPC 通信 (uigfDictIpc.js)

提供了以下 IPC 接口：

- `download-uigf-dict`: 下载单个游戏字典
- `download-all-uigf-dicts`: 下载所有游戏字典
- `check-dict-exists`: 检查字典文件状态
- `load-dict`: 读取字典数据
- `get-dict-status`: 获取所有字典的状态信息

### 3. 用户界面

在设置页面的"数据管理"部分添加了：

- 字典状态显示面板，实时显示各游戏字典的下载状态和条目数量
- "下载所有字典"按钮，一键下载所有游戏的字典
- "刷新状态"按钮，更新字典状态显示
- 相关说明和帮助链接

## 文件结构

```
src/
├── utils/settings/export/
│   └── fetchUIGF.js          # 核心下载功能
├── app/settings/
│   └── uigfDictIpc.js        # IPC 处理程序
├── pages/
│   └── settings.html         # 设置页面 UI
├── js/
│   └── settings.js           # 前端交互逻辑
├── css/
│   └── settings.css          # 样式文件
└── main.js                   # 主进程加载点
```

## 字典文件和存储结构

### 存储位置

字典文件保存在数据目录的 `dict` 子文件夹中，目录结构如下：

```
NekoGame/
└── dict/
    ├── genshin_dict_chs.json
    ├── starrail_dict_chs.json
    ├── zzz_dict_chs.json
    └── uigf_download_timestamps.json
```

### 文件命名规则

- **字典文件**: `{game}_dict_{lang}.json`
- **时间戳文件**: `uigf_download_timestamps.json`

例如：

- `genshin_dict_chs.json` - 原神中文简体字典
- `starrail_dict_chs.json` - 星穹铁道中文简体字典
- `zzz_dict_chs.json` - 绝区零中文简体字典

## API 信息

使用的 UIGF API 端点：

- 基础 URL: `https://api.uigf.org/dict/{game}/{lang}.json`
- 支持的游戏: genshin, starrail, zzz
- 当前支持的语言: chs (中文简体)

## 错误处理

- 网络超时: 10 秒超时限制
- 文件验证: 检查响应数据格式
- 错误恢复: 下载失败时清理损坏文件
- 状态反馈: 详细的成功/失败信息

## 使用场景

这些字典主要用于：

1. UIGF 格式的抽卡记录导入导出
2. 物品 ID 与名称的相互转换
3. 多语言环境下的数据处理
4. 第三方工具的数据标准化

## 注意事项

1. 字典文件会保存在用户的数据目录中
2. 建议定期更新字典以获取最新的物品信息
3. 字典文件较小（几 KB 到几十 KB），对存储空间影响很小
4. 下载过程需要网络连接，建议在网络状况良好时进行
