# Neko Game

**[中文](README.md)** | **English**

## 📝 Overview

**Neko Game** is a tailored gacha analysis and game management application designed to enhance your gaming experience. It features a modern, customizable user interface to help you record, analyze, and optimize your gaming activities. Built on **Electron**, the app integrates various useful functionalities such as gacha analysis for **Wuthering Waves, Genshin Impact, Honkai Star Rail, and Zenless Zone Zero**, game time tracking, time trend visualization, and more.

> **Recommended Reading**: Spend 5 minutes reading this document to quickly get started with Neko Game.

<img width="974" alt="preview" src="https://github.com/user-attachments/assets/02593354-a4c5-4a41-89fe-e0f51591fc13">

## Features
- **Game Tracking**: Automatically tracks and records game playtime with detailed statistics.
- **Gacha Analysis**: One-click analysis for gacha data from Wuthering Waves, Honkai Star Rail, Genshin Impact, and Zenless Zone Zero. Links are automatically copied.
- **Gacha Data Import/Export**: Supports UIGF 4.0 export/import for Genshin, Honkai Star Rail, and Zenless Zone Zero. Wuthering Waves data can be exported to Excel.
- **Game Library Management**: Easily add, edit, and delete games from your library for tracking.
- **Data Analysis**: Visualize trends and gain insights into your gaming habits through rich analytics.
- **Seamless Usage**: Minimize to system tray, run in the background, and enable auto-start at login.
- **Data Storage**: Safely store game data locally or configure automatic cloud upload. [Configuration Guide](https://gitee.com/sunmmerneko/utils/blob/master/info/infoTips.md)
- **Automatic Data Sync**: Sync data across devices via GitHub or Gitee. (Mobile support requires the corresponding app version, downloadable from Baidu Cloud.)
- **High Performance, Low Resource Use**: Optimized for low power consumption and high efficiency without impacting your daily usage.
- **Stay Up-to-Date**: Receive notifications for new versions and enjoy automatic updates.

## Installation
- **From Releases** (Recommended): Download the latest `.exe` file from the [Releases page](https://github.com/Summer-Neko/NekoGame/releases) and install.
- **From Baidu Cloud**: Download the archive from [Baidu Cloud](https://pan.baidu.com/s/13IdCeOVPxHfxVpq2vO_8kw?pwd=4l1a), extract it, and install.

## Developer Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/Summer-Neko/NekoGame.git
   ```
2. Navigate to the project directory:
   ```bash
   cd nekogame
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the app in development mode:
   ```bash
   npm start
   ```

## Usage Guide
- **Gacha Analysis**: Open the gacha page in the game within the last 30 minutes, then click refresh.
- **Add a Game**: Click "Add Game," fill in the required details (name, icon, poster, and game path—ensure the path points to the game's main executable, not the launcher), and save.
- **Edit a Game**: Select a game from the library, click "Edit," update its details, and save changes.
- **Delete a Game**: Use the "Delete" option in the game's details menu to remove it and its related data.
- **Settings**: Enable all three general options for seamless usage. Configure data sync and custom window options here.
- **Game Images**: Obtain images from [SteamGridDB](https://www.steamgriddb.com/) (recommended, search with the English name of the game). Animated images are supported.
- **Time Tracking**: Games in the library will automatically track usage time without manual intervention.

## Project Screenshots
![image](https://github.com/user-attachments/assets/f6dc59a2-a53b-48a4-8c42-cf5c92ca65f2)
![image](https://github.com/user-attachments/assets/8377ee8d-a7e2-4afa-b2ca-d4672d4d268e)
![image](https://github.com/user-attachments/assets/b38468b8-1dee-44ea-8948-8fb78e989989)
![image](https://github.com/user-attachments/assets/19805a17-c749-4c96-973c-49cd2c185a33)

## Troubleshooting & Roadmap
### Common Issues
- **Missing Tray Icon**: Ensure the icon path is correct in the packaging configuration.
- **Gacha Records Not Found**: Confirm the game is installed correctly and has not been manually moved.
- **Unrecorded Playtime**: Reload the app or use the refresh function to restart tracking. Verify that the selected path points to the game's main executable, not the launcher.
- **Invalid Path or Images**: Check for special characters in file paths and ensure images are correctly referenced. Verify the file extensions are valid.
- **Permission Errors**: If the error message includes `gameTracker.js`, it can be ignored. Restart the app if it persists.
- **Unknown Publisher Warning**: This can be safely ignored.
- **Slow Gacha Link Retrieval**: For Genshin Impact and Zenless Zone Zero, log files change with each version. To avoid frequent updates, version configurations are hosted on [GitHub](https://github.com/Summer-Neko/utils/blob/main/GetUrl/version-Genshin.json), which might cause delays.

### Known Limitations
- Playtime tracking in complex environments may require further optimization.
- Gacha analysis and import/export are only tested for the Chinese servers; international servers are not yet supported.
- Handling of very old playtime data (e.g., from 10 years ago) needs improvement.
- Current analytics display only up to six months of playtime data (older data is not deleted but not actively displayed).

### Future Updates
- i18n (Internationalization) support
- Additional functionalities
- Optimized data visualization
