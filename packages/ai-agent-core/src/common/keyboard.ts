/**
 * Complete Playwright Keyboard Key Mapping
 * Based on official Playwright USKeyboardLayout
 */
export const PLAYWRIGHT_KEY_MAP = {
  // Function keys
  "escape": "Escape",
  "f1": "F1",
  "f2": "F2",
  "f3": "F3",
  "f4": "F4",
  "f5": "F5",
  "f6": "F6",
  "f7": "F7",
  "f8": "F8",
  "f9": "F9",
  "f10": "F10",
  "f11": "F11",
  "f12": "F12",

  // Number row
  "backquote": "Backquote",
  "`": "Backquote",
  "digit1": "Digit1",
  "1": "Digit1",
  "digit2": "Digit2",
  "2": "Digit2",
  "digit3": "Digit3",
  "3": "Digit3",
  "digit4": "Digit4",
  "4": "Digit4",
  "digit5": "Digit5",
  "5": "Digit5",
  "digit6": "Digit6",
  "6": "Digit6",
  "digit7": "Digit7",
  "7": "Digit7",
  "digit8": "Digit8",
  "8": "Digit8",
  "digit9": "Digit9",
  "9": "Digit9",
  "digit0": "Digit0",
  "0": "Digit0",
  "minus": "Minus",
  "-": "Minus",
  "equal": "Equal",
  "=": "Equal",
  "backslash": "Backslash",
  "\\": "Backslash",
  "backspace": "Backspace",

  // First row
  "tab": "Tab",
  "keyq": "KeyQ",
  "q": "KeyQ",
  "keyw": "KeyW",
  "w": "KeyW",
  "keye": "KeyE",
  "e": "KeyE",
  "keyr": "KeyR",
  "r": "KeyR",
  "keyt": "KeyT",
  "t": "KeyT",
  "keyy": "KeyY",
  "y": "KeyY",
  "keyu": "KeyU",
  "u": "KeyU",
  "keyi": "KeyI",
  "i": "KeyI",
  "keyo": "KeyO",
  "o": "KeyO",
  "keyp": "KeyP",
  "p": "KeyP",
  "bracketleft": "BracketLeft",
  "[": "BracketLeft",
  "bracketright": "BracketRight",
  "]": "BracketRight",

  // Second row
  "capslock": "CapsLock",
  "keya": "KeyA",
  "a": "KeyA",
  "keys": "KeyS",
  "s": "KeyS",
  "keyd": "KeyD",
  "d": "KeyD",
  "keyf": "KeyF",
  "f": "KeyF",
  "keyg": "KeyG",
  "g": "KeyG",
  "keyh": "KeyH",
  "h": "KeyH",
  "keyj": "KeyJ",
  "j": "KeyJ",
  "keyk": "KeyK",
  "k": "KeyK",
  "keyl": "KeyL",
  "l": "KeyL",
  "semicolon": "Semicolon",
  ";": "Semicolon",
  "quote": "Quote",
  "'": "Quote",
  "enter": "Enter",
  "return": "Enter",

  // Third row
  "shiftleft": "ShiftLeft",
  "shift": "Shift",
  "keyz": "KeyZ",
  "z": "KeyZ",
  "keyx": "KeyX",
  "x": "KeyX",
  "keyc": "KeyC",
  "c": "KeyC",
  "keyv": "KeyV",
  "v": "KeyV",
  "keyb": "KeyB",
  "b": "KeyB",
  "keyn": "KeyN",
  "n": "KeyN",
  "keym": "KeyM",
  "m": "KeyM",
  "comma": "Comma",
  ",": "Comma",
  "period": "Period",
  ".": "Period",
  "slash": "Slash",
  "/": "Slash",
  "shiftright": "ShiftRight",

  // Bottom row (modifiers)
  "controlleft": "ControlLeft",
  "control": "Control",
  "metaleft": "MetaLeft",
  "meta": "Meta",
  "command": "Meta",
  "altleft": "AltLeft",
  "alt": "Alt",
  "space": "Space",
  " ": "Space",
  "altright": "AltRight",
  "altgraph": "AltGraph",
  "metaright": "MetaRight",
  "contextmenu": "ContextMenu",
  "controlright": "ControlRight",

  // Special cross-platform modifier
  "controlormeta": "ControlOrMeta",

  // Center block
  "printscreen": "PrintScreen",
  "scrolllock": "ScrollLock",
  "pause": "Pause",
  "pageup": "PageUp",
  "pagedown": "PageDown",
  "insert": "Insert",
  "delete": "Delete",
  "home": "Home",
  "end": "End",

  // Arrow keys
  "arrowleft": "ArrowLeft",
  "left": "ArrowLeft",
  "arrowup": "ArrowUp",
  "up": "ArrowUp",
  "arrowright": "ArrowRight",
  "right": "ArrowRight",
  "arrowdown": "ArrowDown",
  "down": "ArrowDown",

  // Numpad
  "numlock": "NumLock",
  "numpaddivide": "NumpadDivide",
  "numpadmultiply": "NumpadMultiply",
  "numpadsubtract": "NumpadSubtract",
  "numpad7": "Numpad7",
  "numpad8": "Numpad8",
  "numpad9": "Numpad9",
  "numpad4": "Numpad4",
  "numpad5": "Numpad5",
  "numpad6": "Numpad6",
  "numpadadd": "NumpadAdd",
  "numpad1": "Numpad1",
  "numpad2": "Numpad2",
  "numpad3": "Numpad3",
  "numpad0": "Numpad0",
  "numpaddecimal": "NumpadDecimal",
  "numpadenter": "NumpadEnter",

  // Legacy aliases
  "multiply": "NumpadMultiply",
  "add": "NumpadAdd",
  "subtract": "NumpadSubtract",
  "decimal": "NumpadDecimal",
  "divide": "NumpadDivide"
};

/**
 * Normalize a key name to its Playwright equivalent
 * @param key - The key name to normalize
 * @returns The normalized Playwright key name
 */
export function normalizeKey(key: string): string {
  if (!key) return key;
  const normalized = key.toLowerCase();
  return (PLAYWRIGHT_KEY_MAP as any)[normalized] || key;
}

/**
 * Execute keyboard combination with proper modifier sequencing
 * @param page - Playwright page instance
 * @param keys - Array of key names
 */
export async function keyCombination(page: any, keys: string[]): Promise<void> {
  if (!keys || keys.length === 0) return;

  // Normalize all keys
  const normalizedKeys = keys.map(k => normalizeKey(k));

  // Press modifiers down (all except last key)
  for (const key of normalizedKeys.slice(0, -1)) {
    await page.keyboard.down(key);
  }

  // Press the final key (complete action)
  await page.keyboard.press(normalizedKeys[normalizedKeys.length - 1]);

  // Release modifiers in reverse order
  for (const key of normalizedKeys.slice(0, -1).reverse()) {
    await page.keyboard.up(key);
  }
}

/**
 * Type text with realistic human-like delays (optional)
 * @param page - Playwright page instance
 * @param text - Text to type
 * @param delay - Delay between keystrokes in ms (default: 0)
 */
export async function typeText(page: any, text: string, delay: number = 0): Promise<void> {
  if (!text) return;
  await page.keyboard.type(text, { delay });
}