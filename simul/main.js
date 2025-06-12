// File: main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // win 변수는 이 함수 안에서만 사용
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // 로컬파일 접근 허용 (추가)
      allowRunningInsecureContent: true // (추가)
    }
  });

  win.loadFile(path.join(__dirname, 'build', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});