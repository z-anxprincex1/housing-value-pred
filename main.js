const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess;
const pendingCallbacks = [];
let buffer = '';

function startPythonPredictor() {
  const pythonCmd = 'python';
  const scriptPath = path.join(__dirname, 'predictor.py');
  
  pythonProcess = spawn(pythonCmd, [scriptPath], {
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });
  
  pythonProcess.stdout.on('data', (data) => {
    buffer += data.toString();
    let boundary = buffer.indexOf('\n');
    while (boundary !== -1) {
      const line = buffer.substring(0, boundary).trim();
      buffer = buffer.substring(boundary + 1);
      
      if (line) {
        try {
          const json = JSON.parse(line);
          const callback = pendingCallbacks.shift();
          if (callback) {
            callback.resolve(json);
          }
        } catch (e) {
          console.error("Failed to parse python stdout line:", line, e);
          const callback = pendingCallbacks.shift();
          if (callback) {
            callback.reject(e);
          }
        }
      }
      boundary = buffer.indexOf('\n');
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
    // Reject any remaining pending callbacks
    while (pendingCallbacks.length > 0) {
      const callback = pendingCallbacks.shift();
      if (callback) {
        callback.reject(new Error("Python process closed unexpectedly"));
      }
    }
  });
}

function sendPredictionRequest(data) {
  return new Promise((resolve, reject) => {
    if (!pythonProcess || pythonProcess.killed) {
      reject(new Error("Python backend process is not running"));
      return;
    }
    pendingCallbacks.push({ resolve, reject });
    pythonProcess.stdin.write(JSON.stringify(data) + '\n');
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 950,
    minWidth: 1100,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    autoHideMenuBar: true,
    title: "Housing Value Predictor & Locality Finder"
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  startPythonPredictor();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});

// IPC Handler for prediction calls
ipcMain.handle('predict', async (event, args) => {
  try {
    const result = await sendPredictionRequest(args);
    return result;
  } catch (error) {
    return { status: 'error', message: error.message };
  }
});
