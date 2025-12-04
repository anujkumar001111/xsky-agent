// Web Streams API (Node >=18)
import { TransformStream, ReadableStream, WritableStream } from 'stream/web';
import { Blob as NodeBlob } from 'buffer';
import { TextDecoder, TextEncoder } from 'util';
import { MessageChannel, MessagePort } from 'worker_threads';

if (!(globalThis as any).TransformStream) {
  (globalThis as any).TransformStream = TransformStream;
}
if (!(globalThis as any).ReadableStream) {
  (globalThis as any).ReadableStream = ReadableStream;
}
if (!(globalThis as any).WritableStream) {
  (globalThis as any).WritableStream = WritableStream;
}
if (!(globalThis as any).Blob) {
  (globalThis as any).Blob = NodeBlob as any;
}

// Minimal File polyfill (before loading undici)
if (!(globalThis as any).File) {
  class NodeFile extends (globalThis as any).Blob {
    name: string;
    lastModified: number;
    constructor(fileBits: any[] = [], fileName: string = '', options: any = {}) {
      super(fileBits, options);
      this.name = String(fileName);
      this.lastModified = options?.lastModified ?? Date.now();
    }
    get [Symbol.toStringTag]() {
      return 'File';
    }
  }
  (globalThis as any).File = NodeFile as any;
}

// TextEncoder/Decoder polyfills (Node provides but ensure globals)
if (!(globalThis as any).TextEncoder) {
  (globalThis as any).TextEncoder = TextEncoder as any;
}
if (!(globalThis as any).TextDecoder) {
  (globalThis as any).TextDecoder = TextDecoder as any;
}

// Minimal DOMException polyfill
if (!(globalThis as any).DOMException) {
  class NodeDOMException extends Error {
    name: string;
    constructor(message?: string, name: string = 'DOMException') {
      super(message);
      this.name = name;
    }
  }
  ;(globalThis as any).DOMException = NodeDOMException as any;
}

// Worker-like globals needed by undici (define BEFORE requiring undici)
if (!(globalThis as any).MessageChannel) {
  (globalThis as any).MessageChannel = MessageChannel as any;
}
if (!(globalThis as any).MessagePort) {
  (globalThis as any).MessagePort = MessagePort as any;
}

// TextDecoderStream polyfill using TransformStream
if (!(globalThis as any).TextDecoderStream) {
  class PolyfillTextDecoderStream {
    readable: ReadableStream<string>;
    writable: WritableStream<Uint8Array>;
    constructor(label = 'utf-8', options?: any) {
      const decoder = new TextDecoder(label, options);
      const ts = new TransformStream<Uint8Array, string>({
        transform(chunk, controller) {
          controller.enqueue(decoder.decode(chunk, { stream: true }));
        },
        flush(controller) {
          const tail = decoder.decode();
          if (tail) controller.enqueue(tail);
        }
      });
      this.readable = ts.readable;
      this.writable = ts.writable;
    }
    get [Symbol.toStringTag]() {
      return 'TextDecoderStream';
    }
  }
  (globalThis as any).TextDecoderStream = PolyfillTextDecoderStream as any;
}

// Fetch API primitives via undici (load AFTER setting Blob/File/MessagePort/DOMException)
const { fetch: undiciFetch, Headers: UndiciHeaders, Request: UndiciRequest, Response: UndiciResponse, FormData: UndiciFormData } = require('undici');

if (!(globalThis as any).fetch) {
  (globalThis as any).fetch = undiciFetch as any;
}
if (!(globalThis as any).Headers) {
  (globalThis as any).Headers = UndiciHeaders as any;
}
if (!(globalThis as any).Request) {
  (globalThis as any).Request = UndiciRequest as any;
}
if (!(globalThis as any).Response) {
  (globalThis as any).Response = UndiciResponse as any;
}
if (!(globalThis as any).FormData) {
  (globalThis as any).FormData = UndiciFormData as any;
}
