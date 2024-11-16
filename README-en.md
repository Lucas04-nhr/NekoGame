# Neko Game

**[中文](README.md)** | **English**

---

## Overview
Neko Game is a game management application designed to monitor and analyze your gaming activities with a modern, dark-themed user interface. Built with Electron, it integrates multiple key features, including gameplay time tracking, data visualization, and comprehensive game management tools.

## Features
- **Game Tracking**: Automatically track and record gameplay time with detailed statistics.
- **Game Library Management**: Easily add, edit, and delete games in your library.
- **Data Analysis**: Gain insights into your gaming habits through trend graphs and rich data analytics.
- **Seamless Experience**: Minimize to the system tray and support background running with auto-start.
- **Local Data Storage**: Store game data securely with SQLite, ensuring updates won’t lead to data loss.
- **High Performance, Low Resource Usage**: Enjoy low power consumption and high performance, without worrying about affecting your daily use.
- **Automatic Updates**: Receive notifications when a new version is released and update promptly.

## Installation Steps
1. Clone this repository:
   ```bash
   https://github.com/Summer-Neko/NekoGame.git
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
5. Alternatively, download the latest `.exe` file from the release page:
   Visit the [release page](https://github.com/Summer-Neko/NekoGame/releases) to download the latest version and install it.

## Packaging the Application
To package the application for distribution, run:
```bash
npm run build
```
Ensure `electron-builder` is configured in the project to manage the packaging process.

## User Guide
- **Add a Game**: Click the “Add Game” button, fill in the required information, including name, icon, poster, and game path, and then submit.
- **Edit a Game**: Select a game from the library, click the “Edit” option, update the information, and save changes.
- **Delete a Game**: Use the “Delete” option in the game details menu to remove a game and its associated data.
- **Settings**: It is recommended to check all three options for optimal use.
- **Game Images**: You can visit [steamgriddb](https://www.steamgriddb.com/) to obtain images. Animated images are also supported.

## Sample Screenshots
![image](https://github.com/user-attachments/assets/0778ddec-fd26-49a6-924b-97462f92a490)
![image](https://github.com/user-attachments/assets/22ed4f17-d7c2-46b3-b8d2-f65610fc90eb)

## Troubleshooting & Future Updates
### Common Issues
- **Tray Icon Missing**: Ensure the icon path is correct during packaging and included in the configuration.
- **Gameplay Time Not Recorded**: Reload the app or use the refresh function to restart time tracking.
- **Path or Image Errors**: Check for special characters in file paths and ensure image files are referenced correctly and have the appropriate file extensions.

### Known Limitations
- Editing game details with complex configurations may require further optimization.
- The update logic needs refinement.
- Some styling issues exist.
- Handling of very old data (e.g., 10 years ago) needs improvement.

### Future Updates
- Add game tools, including wish analysis for games like Genshin Impact, Honkai: Star Rail, and Wuthering Waves. The basic logic is mostly understood, and updates may be released in the future.
- Optimize data visualization.
