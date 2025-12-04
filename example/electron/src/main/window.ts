import { BrowserWindow, WebContentsView, BaseWindow } from 'electron';
import * as path from 'path';
import { getPreloadPath } from '@xsky/ai-agent-electron';

export function createMainWindow(): { window: BrowserWindow; view: WebContentsView } {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'XSky AI Agent - Electron Example',
    backgroundColor: '#f0f2f5'
  });

  // Load the renderer UI
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Create the browser view for automation
  // We use the preload script provided by the electron package for secure automation
  const browserView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: getPreloadPath() // Use the secure preload from the package
    }
  });

  // Add the view to the window (BaseWindow.contentView is used in newer Electron versions)
  mainWindow.contentView.addChildView(browserView);

  // Initial bounds - will be updated on resize
  updateViewBounds(mainWindow, browserView);

  // Handle window resize
  mainWindow.on('resize', () => {
    updateViewBounds(mainWindow, browserView);
  });

  // Load a default page
  browserView.webContents.loadURL('https://google.com');

  return { window: mainWindow, view: browserView };
}

function updateViewBounds(window: BrowserWindow, view: WebContentsView) {
  const bounds = window.getContentBounds();

  // Layout: Browser on left (70%), Chat on right (30%)
  // We leave space at the top for the navigation bar (e.g., 60px)
  const navHeight = 60;
  const chatWidth = Math.floor(bounds.width * 0.3);
  const browserWidth = bounds.width - chatWidth;

  view.setBounds({
    x: 0,
    y: navHeight,
    width: browserWidth,
    height: bounds.height - navHeight
  });
}
