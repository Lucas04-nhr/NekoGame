# macOS 支持说明

## 图标文件

为了在 macOS 上正确构建应用，需要创建 `.icns` 格式的图标文件：

1. 使用现有的 `assets/icon.png` 文件
2. 转换为 `.icns` 格式并保存为 `assets/icon.icns`

### 转换方法：

```bash
# 使用 iconutil（macOS 自带工具）
mkdir icon.iconset
sips -z 16 16 assets/macOS-icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32 assets/macOS-icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 assets/macOS-icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64 assets/macOS-icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 assets/macOS-icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256 assets/macOS-icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 assets/macOS-icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512 assets/macOS-icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 assets/macOS-icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 assets/macOS-icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o assets/icon.icns
rm -rf icon.iconset
```

## 依赖兼容性

已将 `winreg` 移至 `optionalDependencies`，确保在非 Windows 平台上不会导致安装失败。

## 构建命令

- `npm run build:mac` - 构建 macOS 版本
- `npm run build:win` - 构建 Windows 版本
- `npm run build:linux` - 构建 Linux 版本

## 平台特定功能

- 游戏启动逻辑已适配 macOS（使用 `open` 命令）
- 托盘图标在 macOS 上使用 PNG 格式
- 游戏路径检测支持 macOS 应用程序结构
