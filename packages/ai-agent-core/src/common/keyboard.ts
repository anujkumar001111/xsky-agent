/**
 * Complete Playwright Keyboard Key Mapping
 * Based on official Playwright USKeyboardLayout
 * 
 * Mapping Strategy:
 * - Single characters (a-z, 0-9, symbols) pass through unchanged per Playwright spec
 * - Special keys map to PascalCase names (e.g., "enter" -> "Enter")
 * - Case-insensitive lookup for special keys (e.g., "ENTER" -> "Enter")
 * - Unmapped keys are validated with warning
 */
export const PLAYWRIGHT_KEY_MAP: Record<string, string> = {
  // Function keys
  "escape": "Escape",
  "esc": "Escape",
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

  // Letter keys (lowercase explicit mapping for validation)
  "a": "a",
  "b": "b",
  "c": "c",
  "d": "d",
  "e": "e",
  "f": "f",
  "g": "g",
  "h": "h",
  "i": "i",
  "j": "j",
  "k": "k",
  "l": "l",
  "m": "m",
  "n": "n",
  "o": "o",
  "p": "p",
  "q": "q",
  "r": "r",
  "s": "s",
  "t": "t",
  "u": "u",
  "v": "v",
  "w": "w",
  "x": "x",
  "y": "y",
  "z": "z",

  // Number keys (0-9)
  "0": "0",
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",

  // Symbol keys (number row)
  "backquote": "Backquote",
  "`": "`",
  "~": "~",
  "!": "!",
  "@": "@",
  "#": "#",
  "$": "$",
  "%": "%",
  "^": "^",
  "&": "&",
  "*": "*",
  "(": "(",
  ")": ")",
  "minus": "Minus",
  "-": "-",
  "_": "_",
  "equal": "Equal",
  "=": "=",
  "+": "+",
  "backslash": "Backslash",
  "\\": "\\",
  "|": "|",
  "backspace": "Backspace",

  // First row
  "tab": "Tab",
  "bracketleft": "BracketLeft",
  "[": "[",
  "{": "{",
  "bracketright": "BracketRight",
  "]": "]",
  "}": "}",

  // Second row
  "capslock": "CapsLock",
  "semicolon": "Semicolon",
  ";": ";",
  ":": ":",
  "quote": "Quote",
  "'": "'",
  "\"": "\"",
  "enter": "Enter",
  "return": "Enter",

  // Third row
  "shiftleft": "ShiftLeft",
  "shift": "Shift",
  "comma": "Comma",
  ",": ",",
  "<": "<",
  "period": "Period",
  ".": ".",
  ">": ">",
  "slash": "Slash",
  "/": "/",
  "?": "?",
  "shiftright": "ShiftRight",

  // Bottom row (modifiers)
  "controlleft": "ControlLeft",
  "control": "Control",
  "ctrl": "Control",
  "metaleft": "MetaLeft",
  "meta": "Meta",
  "command": "Meta",
  "cmd": "Meta",
  "altleft": "AltLeft",
  "alt": "Alt",
  "option": "Alt",
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
  "pgup": "PageUp",
  "pagedown": "PageDown",
  "pgdn": "PageDown",
  "insert": "Insert",
  "delete": "Delete",
  "del": "Delete",
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
  "divide": "NumpadDivide",

  // International keys (from Playwright USKeyboardLayout)
  "intlbackslash": "IntlBackslash",
  "intlro": "IntlRo",
  "intlyen": "IntlYen",
  "nonconvert": "NonConvert",
  "convert": "Convert",
  "lang1": "Lang1",
  "lang2": "Lang2",
  "lang3": "Lang3",
  "lang4": "Lang4",
  "lang5": "Lang5",
  "kana": "KanaMode",
  "kanamode": "KanaMode",
  "alphanum": "Alphanumeric",
  "hiragana": "Hiragana",
  "katakana": "Katakana",
  "hangeul": "HangulMode",
  "hangulmode": "HangulMode",
  "hanja": "Hanja",
  "junja": "Junja"
};

/**
 * List of known modifier keys for keyCombination logic
 */
export const MODIFIER_KEYS = [
  'Shift', 'Control', 'Alt', 'Meta',
  'ShiftLeft', 'ControlLeft', 'AltLeft', 'MetaLeft',
  'ShiftRight', 'ControlRight', 'AltRight', 'MetaRight',
  'ControlOrMeta'
] as const;

/**
 * Validate a key against known mappings
 * @param key - The key to validate
 * @returns true if key is known/valid, false otherwise
 */
export function validateKey(key: string): boolean {
  if (!key) return false;
  
  // Single character keys pass through (a-z, A-Z, 0-9, symbols)
  if (key.length === 1) return true;
  
  // Check if it's in the mapping (case-insensitive)
  const normalized = key.toLowerCase();
  return normalized in PLAYWRIGHT_KEY_MAP;
}

/**
 * Normalize a key name to its Playwright equivalent
 *
 * Behavior:
 * - Single characters (a-z, 0-9, symbols): Pass through unchanged
 * - Special keys (enter, tab, etc.): Map to PascalCase (case-insensitive lookup)
 * - Unknown multi-char keys: Throw error (prevents silent failures)
 *
 * @param key - The key name to normalize
 * @returns The normalized Playwright key name
 * @throws Error for unknown multi-character keys
 *
 * @example
 * normalizeKey("a") // "a" (single char unchanged)
 * normalizeKey("A") // "A" (uppercase single char unchanged)
 * normalizeKey("enter") // "Enter" (special key)
 * normalizeKey("ENTER") // "Enter" (case-insensitive)
 * normalizeKey("return") // "Enter" (alias)
 * normalizeKey("unknownKey") // throws Error
 */
export function normalizeKey(key: string): string {
  if (!key) return key;

  // Single character keys pass through unchanged (Playwright spec)
  if (key.length === 1) {
    return key;
  }

  // Multi-character keys: case-insensitive lookup
  const normalized = key.toLowerCase();
  const mapped = PLAYWRIGHT_KEY_MAP[normalized];

  if (mapped) {
    return mapped;
  }

  // Unknown key - throw error to prevent silent failures
  throw new Error(
    `[keyboard] Unknown key "${key}". ` +
    `Supported keys include: ${Object.keys(PLAYWRIGHT_KEY_MAP).slice(0, 10).join(', ')}... ` +
    `See docs/keyboard-utilities.md for complete list.`
  );
}

/**
 * Execute keyboard combination with proper modifier sequencing
 * 
 * Behavior:
 * - Separates modifiers (Shift/Control/Alt/Meta) from action keys
 * - Holds modifiers down, presses action keys, releases modifiers
 * - If ONLY modifiers provided: throws error (invalid combination)
 * - If single key provided: presses it without modifiers
 * 
 * @param page - Playwright page instance
 * @param keys - Array of key names (modifiers + action keys)
 * 
 * @example
 * keyCombination(page, ["Control", "c"]) // Ctrl+C
 * keyCombination(page, ["Control", "Shift", "a"]) // Ctrl+Shift+A
 * keyCombination(page, ["a"]) // Just press "a"
 * keyCombination(page, ["Shift", "Control"]) // ERROR: no action key
 * keyCombination(page, ["ArrowDown", "Enter"]) // Press ArrowDown, then Enter (sequential)
 */
export async function keyCombination(page: any, keys: string[]): Promise<void> {
  if (!keys || keys.length === 0) {
    throw new Error('[keyboard] keyCombination requires at least one key');
  }

  // Normalize all keys
  const normalizedKeys = keys.map(k => normalizeKey(k));

  // Single key: just press it
  if (normalizedKeys.length === 1) {
    await page.keyboard.press(normalizedKeys[0]);
    return;
  }

  // Identify modifiers vs action keys
  const modifierKeys = normalizedKeys.filter(key => MODIFIER_KEYS.includes(key as any));
  const actionKeys = normalizedKeys.filter(key => !MODIFIER_KEYS.includes(key as any));

  // All modifiers, no action keys = invalid
  if (actionKeys.length === 0) {
    throw new Error(
      `[keyboard] keyCombination requires at least one action key. ` +
      `Got only modifiers: ${keys.join(', ')}. ` +
      `Example: ["Control", "c"] for Ctrl+C`
    );
  }

  // Press modifiers down
  for (const key of modifierKeys) {
    await page.keyboard.down(key);
  }

  // Press action keys
  for (const key of actionKeys) {
    await page.keyboard.press(key);
  }

  // Release modifiers in reverse order
  for (const key of [...modifierKeys].reverse()) {
    await page.keyboard.up(key);
  }
}

/**
 * Press keys in sequence (each key pressed and released individually)
 * @param page - Playwright page instance
 * @param keys - Array of key names to press in sequence
 */
export async function pressKeysInSequence(page: any, keys: string[]): Promise<void> {
  if (!keys || keys.length === 0) return;

  for (const key of keys) {
    await page.keyboard.press(normalizeKey(key));
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