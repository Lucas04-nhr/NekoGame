# UIGF 字典物品名称自动更新功能

## 功能概述

这个功能在每次启动时自动下载 UIGF 字典数据，并更新数据库中已有抽卡记录的`item_name`字段，确保物品名称始终保持最新。

## 新增文件

### `/src/utils/settings/export/updateItemNames.js`

核心模块，负责：

- 根据字典数据更新数据库中的物品名称
- 支持原神、星穹铁道、绝区零三个游戏
- 提供检查功能，确定哪些记录需要更新

## 修改的文件

### `/src/utils/settings/export/fetchUIGF.js`

- 在`autoDownloadDictsOnStartup()`和`downloadAllUIGFDicts()`函数中增加了自动更新物品名称的逻辑
- 字典下载成功后自动调用`updateAllGachaItemNames()`

### `/src/app/settings/uigfDictIpc.js`

- 添加了`update-gacha-item-names` IPC 处理程序，支持手动更新
- 添加了`check-item-names-need-update` IPC 处理程序，检查需要更新的记录数量

### `/src/pages/settings.html`

- 在 UIGF 字典管理区域添加了"更新物品名称"按钮
- 更新了说明文字，告知用户自动更新功能

### `/src/js/settings.js`

- 为"更新物品名称"按钮添加了事件处理程序
- 提供用户反馈和错误处理

## 工作流程

### 自动更新（启动时）

1. 应用启动时调用`autoDownloadDictsOnStartup()`
2. 下载各游戏的 UIGF 字典文件
3. 下载成功后自动调用`updateAllGachaItemNames()`
4. 遍历数据库中的抽卡记录，根据`item_id`查找字典中的正确名称
5. 如果字典中的名称与数据库中的`name`字段不同，则更新记录
6. 输出更新结果日志

### 手动更新

1. 用户在设置页面点击"更新物品名称"按钮
2. 调用`update-gacha-item-names` IPC 方法
3. 执行相同的更新逻辑
4. 显示更新结果消息

## 支持的游戏表

- `genshin_gacha` (原神)
- `starrail_gacha` (星穹铁道)
- `zzz_gacha` (绝区零)

## 更新逻辑

1. **严格匹配**: 只有当字典中存在对应的`item_id`且名称不同时才更新
2. **保持完整性**: 如果`item_id`为空或字典中不存在，则不更新
3. **错误处理**: 单条记录更新失败不会影响其他记录的更新
4. **详细日志**: 提供详细的更新过程日志和统计信息

## 用户界面

### 自动更新

- 启动时在控制台输出更新进度和结果
- 无需用户干预

### 手动更新

- 设置页面的"更新物品名称"按钮
- 点击后显示"更新中..."状态
- 完成后显示更新结果消息

## 性能考虑

- 使用异步处理，避免阻塞主线程
- 分游戏逐个处理，避免一次性处理过多数据
- 提供详细的进度反馈

## 错误处理

- 字典文件不存在时跳过相应游戏
- 数据库连接失败时提供错误信息
- 单条记录更新失败时继续处理其他记录
- 所有错误都会在控制台输出详细信息

## 日志示例

```
启动时自动下载 UIGF 字典...
正在下载 genshin 字典...
genshin 的 chs 字典下载成功: /path/to/dict/genshin_dict_chs.json
字典包含 1234 个条目
启动时字典下载完成:
成功: genshin, starrail, zzz
开始更新数据库中的物品名称...
开始更新 genshin_gacha 表中的物品名称...
已加载 genshin 字典，包含 1234 个条目
genshin_gacha 中找到 567 条记录需要检查
更新记录 12345: "旧名称" -> "新名称"
genshin_gacha 更新完成: 成功 23 条，错误 0 条
物品名称更新完成: 共更新 45 条记录
```
