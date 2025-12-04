// Mock electron
jest.mock('electron', () => ({
  WebContentsView: jest.fn().mockImplementation(() => ({
    webContents: {
      loadURL: jest.fn().mockResolvedValue(undefined),
      getURL: jest.fn().mockReturnValue('http://localhost/'),
      getTitle: jest.fn().mockReturnValue('Test Page'),
      capturePage: jest.fn().mockResolvedValue({
        toDataURL: () => 'data:image/jpeg;base64,mocked-image'
      }),
      executeJavaScript: jest.fn().mockResolvedValue(undefined),
      navigationHistory: {
        canGoBack: jest.fn().mockReturnValue(true),
        goBack: jest.fn()
      }
    },
    getBounds: jest.fn().mockReturnValue({ width: 800, height: 600 })
  })),
  BrowserView: jest.fn(),
  ipcRenderer: {
    send: jest.fn(),
    on: jest.fn(),
    invoke: jest.fn()
  },
  contextBridge: {
    exposeInMainWorld: jest.fn()
  }
}));

// Polyfills for node environment
import { TransformStream, ReadableStream, WritableStream } from 'stream/web';
import { TextDecoder, TextEncoder } from 'util';

if (!(globalThis as any).TransformStream) {
  (globalThis as any).TransformStream = TransformStream;
}
if (!(globalThis as any).ReadableStream) {
  (globalThis as any).ReadableStream = ReadableStream;
}
if (!(globalThis as any).WritableStream) {
  (globalThis as any).WritableStream = WritableStream;
}
if (!(globalThis as any).TextEncoder) {
  (globalThis as any).TextEncoder = TextEncoder;
}
if (!(globalThis as any).TextDecoder) {
  (globalThis as any).TextDecoder = TextDecoder;
}