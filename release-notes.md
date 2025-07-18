# v2.5.1 Release Notes

> [!NOTE]
> This is a patch version of the v2.5.0 release, focusing on change the deprecated release workflow to the new one.
>
> 这是 v2.5.0 版本的补丁版本，主要关注将已弃用的发布工作流更改为新的工作流。

## 🌟 New Features / 新功能

### 🔄 Release Workflow Update / 发布工作流更新

- **Updated release workflow** - Transitioned from deprecated release workflow to the new one
- **更新发布工作流** - 从已弃用的发布工作流过渡到新的工作流

---

# v2.5.0 Release Notes

## 🌟 New Features / 新功能

### 🔄 Auto Update System Refactor / 自动更新系统重构

- **Refactored auto-update mechanism** - Replaced in-app download with browser-based download from GitHub releases
- **重构自动更新机制** - 将应用内下载改为跳转到 GitHub releases 页面进行下载
- **Updated repository source** - Changed from `Summer-Neko/NekoGame` to `Lucas04-nhr/NekoGame`
- **更新仓库源** - 从 `Summer-Neko/NekoGame` 更改为 `Lucas04-nhr/NekoGame`

### 🏗️ Build System Improvements / 构建系统改进

- **GitHub Actions workflow** - Added comprehensive CI/CD pipeline for multi-platform builds
- **GitHub Actions 工作流** - 新增支持多平台构建的完整 CI/CD 流水线
- **Artifact upload support** - Automatic build artifact collection and upload
- **构建产物上传支持** - 自动收集和上传构建产物
- **Disabled auto-publish** - Removed automatic publishing to prevent accidental releases during development
- **禁用自动发布** - 移除自动发布功能，防止开发过程中意外发布版本

### 🖥️ Cross-Platform Enhancements / 跨平台增强

- **macOS platform support** - Enhanced compatibility and UI adjustments for macOS
- **macOS 平台支持** - 增强 macOS 兼容性和 UI 适配
- **Cross-platform game path detection** - Improved game installation path detection across different operating systems
- **跨平台游戏路径检测** - 改进不同操作系统下的游戏安装路径检测

### 🎨 UI/UX Improvements / 界面/用户体验改进

- **Custom CSS functionality** - Added support for custom styling with local and remote settings
- **自定义 CSS 功能** - 新增支持本地和远程设置的自定义样式功能
- **Enhanced game tools UI** - Improved user interface for game tools and settings pages
- **增强游戏工具界面** - 改进游戏工具和设置页面的用户界面
- **Improved responsiveness** - Enhanced global back button responsiveness and UI interactions
- **改进响应性** - 增强全局返回按钮响应性和界面交互

### 📊 Data Management Features / 数据管理功能

- **Hakushi metadata management** - Implemented comprehensive metadata handling and IPC communication
- **Hakushi 元数据管理** - 实现全面的元数据处理和 IPC 通信
- **UIGF dictionary auto-update** - Added automatic and manual item name updates for UIGF dictionary
- **UIGF 字典自动更新** - 新增 UIGF 字典的自动和手动物品名称更新功能
- **UIGF v4 combined export** - Enhanced export functionality supporting UIGF v4 format
- **UIGF v4 合并导出** - 增强导出功能，支持 UIGF v4 格式

## 🔧 Bug Fixes / 问题修复

### 🏗️ Build & Deployment / 构建和部署

- **GitHub Actions permissions** - Fixed GH_TOKEN reference and permissions in workflow
- **GitHub Actions 权限** - 修复工作流中的 GH_TOKEN 引用和权限问题
- **Artifact action version** - Updated upload-artifact action to version 4
- **构建产物操作版本** - 更新 upload-artifact 操作到版本 4
- **Pull request branch** - Corrected branch reference from 'main' to 'master'
- **拉取请求分支** - 将分支引用从 'main' 修正为 'master'

### 🎮 Game Integration / 游戏集成

- **Version consistency** - Fixed version display consistency across application
- **版本一致性** - 修复应用程序中版本显示的一致性
- **ZZZ gacha analysis** - Corrected script file names and gacha calculation logic for Zenless Zone Zero
- **绝区零抽卡分析** - 修正绝区零的脚本文件名和抽卡计算逻辑
- **Game launch issues** - Resolved various game launching problems
- **游戏启动问题** - 解决各种游戏启动问题

### 🔍 Data Processing / 数据处理

- **ZZZ rank mapping** - Refined ranking system and star conversion logic
- **绝区零等级映射** - 完善等级系统和星级转换逻辑
- **UIGF import optimization** - Enhanced import process with local dictionary fallback
- **UIGF 导入优化** - 通过本地字典回退增强导入流程

## 🛠️ Technical Improvements / 技术改进

### ⚡ Performance / 性能优化

- **Code optimization** - General code improvements for enhanced functionality and performance
- **代码优化** - 针对功能增强和性能提升的代码改进
- **Library tab optimization** - Simplified display logic and removed unused components
- **游戏库标签优化** - 简化显示逻辑并移除未使用的组件
- **Performance tracking** - Added performance monitoring for UIGF import processes
- **性能追踪** - 为 UIGF 导入流程添加性能监控

### 🔒 Security / 安全性

- **IPC security enhancement** - Improved IPC security by removing generic invoke methods
- **IPC 安全增强** - 通过移除通用调用方法提高 IPC 安全性
- **Error handling** - Enhanced error handling throughout the application
- **错误处理** - 增强整个应用程序的错误处理

### 📁 Project Structure / 项目结构

- **Code organization** - Refactored project structure for better maintainability
- **代码组织** - 重构项目结构以提高可维护性
- **Cleanup** - Removed outdated README files and unused components
- **清理** - 移除过时的 README 文件和未使用的组件
- **Documentation** - Added comprehensive issue templates in Chinese and English
- **文档** - 新增中英文详细的问题模板

## 📋 Development Tools / 开发工具

### 🔄 Workflow / 工作流程

- **Multi-OS testing** - Added GitHub Actions workflow for testing builds on multiple operating systems
- **多系统测试** - 新增 GitHub Actions 工作流程，支持多个操作系统的构建测试
- **To-do list management** - Added project task tracking and feature planning
- **待办事项管理** - 新增项目任务跟踪和功能规划
- **Issue templates** - Created comprehensive bug report and feature request templates
- **问题模板** - 创建全面的错误报告和功能请求模板

---

## 🎯 What's Next / 下一步计划

This release focuses on improving the development workflow, cross-platform compatibility, and user experience. The refactored auto-update system provides better control over releases while the enhanced CI/CD pipeline ensures reliable builds across platforms.

本版本专注于改进开发工作流程、跨平台兼容性和用户体验。重构的自动更新系统提供更好的版本控制，而增强的 CI/CD 流水线确保跨平台的可靠构建。

For more details about specific changes, please refer to the [commit history](https://github.com/Lucas04-nhr/NekoGame/commits/master).

有关具体更改的更多详细信息，请参阅[提交历史](https://github.com/Lucas04-nhr/NekoGame/commits/master)。


---

> Generated by Claude Sonnet 4 via GitHub Copilot
