# Hakushi 元数据 API 重构完成

## 重大更新

✅ **已完全迁移到 Hakushi 数据源**  
✅ **废弃了原始 UIGF 字典的物品名称更新功能**  
✅ **新增智能语言字段映射，自动适配不同游戏的数据格式**

## 概述

重构后的元数据更新 API 完全基于 `https://api.hakush.in` 下载游戏元数据，支持三种游戏的不同数据类型，并使用各自的中文字段进行物品名称更新：

- **原神 (genshin)**: 角色 (character), 武器 (weapon) - 使用 `CHS` 字段
- **崩铁 (starrail)**: 角色 (character), 光锥 (lightcone) - 使用 `cn` 字段
- **绝区零 (zzz)**: 角色 (character), 武器 (weapon), 邦布 (bangboo) - 使用 `CHS` 字段

## 智能语言字段映射

系统会根据不同游戏自动选择正确的语言字段：

```javascript
const GAME_LANGUAGE_FIELDS = {
  genshin: ["CHS", "EN", "JP", "KR"], // 原神使用 CHS
  starrail: ["cn", "en", "jp", "kr"], // 崩铁使用 cn
  zzz: ["CHS", "EN", "JA", "KO"], // 绝区零使用 CHS
};
```

如果首选语言字段不存在，系统会自动回退到其他可用语言。

## 物品名称更新功能

### 自动更新流程

1. **启动时自动下载**：应用启动时自动检查并下载最新元数据
2. **智能时间戳比较**：基于 `last-modified` 头避免重复下载
3. **下载完成后自动更新**：元数据下载成功后自动更新数据库中的物品名称
4. **智能语言选择**：自动为每个游戏选择正确的中文字段

### 手动更新

```javascript
// 更新所有游戏的物品名称（使用各游戏的默认中文字段）
const {
  updateAllGachaItemNames,
} = require("./src/utils/settings/export/updateItemNames");
const result = await updateAllGachaItemNames();

// 或指定特定语言字段
const result = await updateAllGachaItemNames("CHS");
```

### IPC 接口

前端可以通过以下 IPC 调用手动触发更新：

````javascript
// 使用 Hakushi 数据源更新物品名称
const result = await ipcRenderer.invoke('update-item-names-from-hakushi');

// 检查需要更新的物品数量
const checkResult = await ipcRenderer.invoke('check-hakushi-item-names-need-update');

// 传统接口（现在也使用 Hakushi 数据源）
const result = await ipcRenderer.invoke('update-gacha-item-names');
```## API 映射

| 游戏     | API Key | 支持的数据类型             |
| -------- | ------- | -------------------------- |
| genshin  | gi      | character, weapon          |
| starrail | hsr     | character, lightcone       |
| zzz      | zzz     | character, weapon, bangboo |

API 端点格式: `https://api.hakush.in/{game}/data/{type}.json`

## 使用方法

### 1. 导入客户端

```javascript
// 单独使用 Hakushi 客户端
const hakushiClient = require("./src/utils/metadata/hakushiClient");

// 使用统一元数据客户端（推荐）
const metadataClient = require("./src/utils/metadata/metadataClient");
````

### 2. 下载单个元数据

```javascript
// 下载原神角色数据
const result = await hakushiClient.downloadHakushiMetadata(
  "genshin",
  "character"
);

// 下载崩铁光锥数据
const result = await hakushiClient.downloadHakushiMetadata(
  "starrail",
  "lightcone"
);

// 下载绝区零邦布数据
const result = await hakushiClient.downloadHakushiMetadata("zzz", "bangboo");
```

### 3. 下载游戏所有元数据

```javascript
// 下载原神所有元数据 (角色 + 武器)
const results = await hakushiClient.downloadGameMetadata("genshin");

// 下载所有游戏的所有元数据
const allResults = await hakushiClient.downloadAllMetadata();
```

### 4. 启动时自动下载

```javascript
// 启动时检查并下载更新
const results = await hakushiClient.autoDownloadMetadataOnStartup();

// 使用统一客户端（同时处理 UIGF 字典和 Hakushi 元数据）
const allResults = await metadataClient.autoDownloadAllOnStartup();
```

### 5. 读取元数据

```javascript
// 检查文件是否存在
const exists = hakushiClient.checkMetadataExists("genshin", "character");

// 读取元数据
const metadata = hakushiClient.loadMetadata("genshin", "character");

// 使用统一客户端读取
const metadata = metadataClient.getHakushiMetadata("genshin", "character");
```

### 6. 时间戳管理

```javascript
// 获取单个元数据的时间戳
const timestamp = hakushiClient.getMetadataTimestamp("genshin", "character");

// 获取所有元数据的时间戳
const allTimestamps = hakushiClient.getAllMetadataTimestamps();

// 使用统一客户端获取所有时间戳（包括 UIGF 和 Hakushi）
const allTimestamps = metadataClient.getAllTimestamps();
```

## 文件存储

所有元数据文件都保存在 `${NEKO_GAME_FOLDER_PATH}/dict/` 目录下：

- 元数据文件: `{game}_{type}_metadata.json`
- 时间戳文件: `hakushi_metadata_timestamps.json`

例如：

- `genshin_character_metadata.json` - 原神角色数据
- `starrail_lightcone_metadata.json` - 崩铁光锥数据
- `zzz_bangboo_metadata.json` - 绝区零邦布数据

## 数据格式

### 角色数据示例 (原神)

```json
{
  "10000002": {
    "birth": [9, 28],
    "icon": "UI_AvatarIcon_Ayaka",
    "rank": "QUALITY_ORANGE",
    "weapon": "WEAPON_SWORD_ONE_HAND",
    "release": "2021-07-21 00:00:00",
    "element": "Cryo",
    "EN": "Kamisato Ayaka",
    "desc": "Daughter of the Yashiro Commission's Kamisato Clan.",
    "KR": "카미사토 아야카",
    "CHS": "神里绫华",
    "JP": "神里綾華"
  }
}
```

### 邦布数据示例 (绝区零)

```json
{
  "53001": {
    "icon": "UI/Sprite/.../BangbooGarageRole12.png",
    "rank": 3,
    "codename": "Penguinboo",
    "EN": "Penguinboo",
    "desc": "Widdly-waddly, icy and chilly.",
    "KO": "펭귄부",
    "CHS": "企鹅布",
    "JA": "ペンギンボンプ"
  }
}
```

## 错误处理

客户端包含完整的错误处理机制：

- HTTP 请求超时处理 (10-15 秒)
- 网络错误重试机制
- 损坏文件自动清理
- 详细的错误日志输出

## 时间戳机制

- 支持基于 `last-modified` 头的智能更新检查
- 避免不必要的重复下载
- 记录内容更新时间和下载时间
- 支持强制下载模式

## 配置选项

```javascript
// 支持的游戏配置
const GAME_CONFIG = {
  genshin: {
    apiKey: "gi",
    types: ["character", "weapon"],
  },
  starrail: {
    apiKey: "hsr",
    types: ["character", "lightcone"],
  },
  zzz: {
    apiKey: "zzz",
    types: ["character", "weapon", "bangboo"],
  },
};
```

## 注意事项

1. 确保设置了 `NEKO_GAME_FOLDER_PATH` 环境变量
2. 网络请求需要稳定的互联网连接
3. 首次下载可能需要较长时间，取决于网络速度
4. 建议在应用启动时调用自动下载功能
5. 元数据文件较大，建议定期清理旧文件
