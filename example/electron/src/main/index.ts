import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createMainWindow } from './window';
import { setupIpcHandlers } from './ipc-handlers';
import { AgentService } from './agent-service';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

let mainWindow: BrowserWindow | null = null;
let agentService: AgentService | null = null;

async function initialize() {
  // Create the main window
  const { window, view } = createMainWindow();
  mainWindow = window;

  // Initialize the agent service
  agentService = new AgentService(window, view);

  // Set up IPC handlers
  setupIpcHandlers(agentService, view);

  mainWindow.on('closed', () => {
    mainWindow = null;
    agentService = null;
  });
}

app.whenReady().then(async () => {
  await initialize();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      initialize();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
