// Mock chrome API
const mockChrome = {
  tabs: {
    create: jest.fn(),
    query: jest.fn(),
    update: jest.fn(),
    get: jest.fn(),
    captureVisibleTab: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  windows: {
    getLastFocused: jest.fn(),
    getCurrent: jest.fn()
  },
  scripting: {
    executeScript: jest.fn()
  },
  runtime: {
    id: 'mock-extension-id'
  }
};

(globalThis as any).chrome = mockChrome;

// Polyfills for node environment (since we import core which imports AI SDK)
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