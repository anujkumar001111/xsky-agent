// Mock html2canvas
jest.mock('html2canvas', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({
    toDataURL: () => 'data:image/jpeg;base64,mocked-image-data'
  })
}));

// Mock window/document properties if needed
Object.defineProperty(window, 'scrollX', { value: 0, writable: true });
Object.defineProperty(window, 'scrollY', { value: 0, writable: true });

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
