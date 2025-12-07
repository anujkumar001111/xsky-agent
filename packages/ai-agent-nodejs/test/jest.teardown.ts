// Global teardown for Jest tests
export default async function globalTeardown() {
  console.log('Global teardown: All tests completed');

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Note: Browser cleanup happens in test file afterAll hooks.
  // The forceExit flag in jest.config.js handles Playwright's internal
  // timers and WebSocket connections that would otherwise prevent exit.
}