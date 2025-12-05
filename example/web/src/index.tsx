// React imports for web application
import React from "react";
import App from "./App.tsx";              // Main application component
import ReactDOM from "react-dom/client";   // React DOM renderer
import "./index.css";                    // Global styles

// Create React root and render the main application
const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ========================================
// AUTOMATION TESTING DEMONSTRATION
// ========================================

/**
 * Automated testing demonstration for the web-based AI agent.
 * 
 * This section shows how to programmatically trigger AI agent
 * automation tasks within a web application. The test case
 * demonstrates:
 * 
 * 1. In-page automation capabilities
 * 2. Integration with the XSky AI Agent framework
 * 3. Real-world usage scenarios for web-based agents
 * 
 * The 500ms delay ensures the React app has fully mounted
 * before automation begins, preventing race conditions.
 */
import { auto_test_case } from "./main.ts";  // Import automation test functions

// Execute automated test case after app initialization
setTimeout(async () => {
  await auto_test_case();
}, 500);
