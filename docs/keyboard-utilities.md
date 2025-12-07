# Keyboard Utilities Documentation

## Overview

The XSky AI Agent provides comprehensive keyboard automation utilities for Playwright-based browser agents. These utilities handle key normalization, combination execution, and validation with robust error handling and edge case support.

## Key Mapping System

### Supported Keys

The system supports **179 explicitly mapped keys** covering:

#### Letters (26)
- All lowercase letters: `a-z`
- Uppercase letters pass through unchanged (e.g., `"A"` → `"A"`)

#### Numbers (10)
- Digits: `0-9`

#### Symbols & Punctuation (40+)
- Common symbols: `!@#$%^&*()[]{}|;:,.<>?/`
- Quotes: `'"` (single and double)
- Math operators: `+-*/=`
- Brackets: `[]{}()`

#### Special Keys (Function/Navigation)
- Function keys: `F1-F12`
- Navigation: `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Home`, `End`, `PageUp`, `PageDown`
- Control: `Enter`, `Tab`, `Escape`, `Backspace`, `Delete`, `Insert`
- Modifiers: `Shift`, `Control`, `Alt`, `Meta` (with variants like `ShiftLeft`, `ControlRight`)

#### Numpad Keys
- Numbers: `Numpad0-Numpad9`
- Operations: `NumpadAdd`, `NumpadSubtract`, `NumpadMultiply`, `NumpadDivide`
- Special: `NumpadDecimal`, `NumpadEnter`

#### International Keys
- `IntlBackslash`, `IntlRo`, `IntlYen`
- Language keys: `Lang1-Lang5`
- IME keys: `KanaMode`, `Hiragana`, `Katakana`, `HangulMode`, `Hanja`

### Key Normalization Rules

#### Single Characters (Pass Through)
```typescript
normalizeKey("a") // "a" (unchanged)
normalizeKey("A") // "A" (unchanged)
normalizeKey("5") // "5" (unchanged)
normalizeKey("@") // "@" (unchanged)
```

#### Special Keys (Case-Insensitive Mapping)
```typescript
normalizeKey("enter")    // "Enter"
normalizeKey("ENTER")    // "Enter"
normalizeKey("return")   // "Enter" (alias)
normalizeKey("esc")      // "Escape" (alias)
normalizeKey("escape")   // "Escape"
```

#### Unknown Keys (Error)
```typescript
normalizeKey("UnknownKey123") // throws Error
```

## API Reference

### Functions

#### `validateKey(key: string): boolean`
Validates if a key is known/valid.

```typescript
validateKey("a")        // true
validateKey("enter")    // true
validateKey("Unknown")  // false
```

#### `normalizeKey(key: string): string`
Normalizes key names to Playwright-compatible format.

**Parameters:**
- `key`: The key name to normalize

**Returns:** Normalized Playwright key name

**Throws:** Error for unknown multi-character keys

**Examples:**
```typescript
normalizeKey("a")           // "a"
normalizeKey("A")           // "A"
normalizeKey("enter")       // "Enter"
normalizeKey("ENTER")       // "Enter"
normalizeKey("return")      // "Enter" (alias)
normalizeKey("UnknownKey")  // throws Error
```

#### `keyCombination(page, keys): Promise<void>`
Executes keyboard combinations with proper modifier sequencing.

**Parameters:**
- `page`: Playwright page instance
- `keys`: Array of key names

**Behavior:**
- Separates modifiers from action keys
- Holds modifiers down, presses action keys, releases modifiers
- Throws error if only modifiers provided
- Single key: just presses it

**Examples:**
```typescript
// Valid combinations
await keyCombination(page, ["Control", "c"])        // Ctrl+C
await keyCombination(page, ["Control", "Shift", "a"]) // Ctrl+Shift+A
await keyCombination(page, ["a"])                   // Just press "a"

// Invalid (throws error)
await keyCombination(page, ["Shift", "Control"])   // ERROR: no action key
```

#### `pressKeysInSequence(page, keys): Promise<void>`
Presses multiple keys in sequence, each pressed and released individually.

**Parameters:**
- `page`: Playwright page instance
- `keys`: Array of key names to press in sequence

**Example:**
```typescript
await pressKeysInSequence(page, ["a", "b", "c"]) // Types "abc"
```

#### `typeText(page, text, delay?): Promise<void>`
Types text with optional human-like delays.

**Parameters:**
- `page`: Playwright page instance
- `text`: Text to type
- `delay`: Delay between keystrokes in ms (default: 0)

**Example:**
```typescript
await typeText(page, "Hello World", 100) // Types with 100ms delay
```

## Browser Agent Tools

### `keyboard_action`
Low-level keyboard operations.

**Parameters:**
```typescript
{
  action: "press" | "down" | "up" | "type" | "insert",
  key: string
}
```

**Examples:**
```javascript
// Press and release a key
await agent.callTool("keyboard_action", { action: "press", key: "Enter" });

// Hold a key down
await agent.callTool("keyboard_action", { action: "down", key: "Shift" });

// Type text
await agent.callTool("keyboard_action", { action: "type", key: "hello" });
```

### `keyboard_combination`
Key combinations with automatic modifier detection.

**Parameters:**
```typescript
{
  keys: string[] // Array of key names
}
```

**Examples:**
```javascript
// Ctrl+C (copy)
await agent.callTool("keyboard_combination", { keys: ["Control", "c"] });

// Ctrl+Shift+A (select all)
await agent.callTool("keyboard_combination", { keys: ["Control", "Shift", "a"] });

// Single key
await agent.callTool("keyboard_combination", { keys: ["Enter"] });
```

### `press_keys_sequence`
Sequential key presses.

**Parameters:**
```typescript
{
  keys: string[] // Keys to press in sequence
}
```

**Example:**
```javascript
await agent.callTool("press_keys_sequence", { keys: ["a", "b", "c"] });
```

### `type_text_enhanced`
Human-like text typing.

**Parameters:**
```typescript
{
  text: string,
  delay?: number // Delay between keystrokes (default: 0)
}
```

**Example:**
```javascript
await agent.callTool("type_text_enhanced", { text: "Hello World", delay: 100 });
```

## Edge Cases & Error Handling

### All-Modifier Combinations
```typescript
// This throws an error
await agent.callTool("keyboard_combination", { keys: ["Shift", "Control"] });
// Error: "keyCombination requires at least one action key"
```

### Unknown Keys
```typescript
// This throws an error
await agent.callTool("keyboard_action", { action: "press", key: "UnknownKey" });
// Error: "Unknown key \"UnknownKey\"..."
```

### Case Handling
```typescript
// Single characters preserve case
await agent.callTool("keyboard_action", { action: "press", key: "A" }); // Presses uppercase A

// Special keys are case-insensitive
await agent.callTool("keyboard_action", { action: "press", key: "ENTER" }); // Presses Enter
```

### Empty Input
```typescript
await keyCombination(page, []); // Throws error
await pressKeysInSequence(page, []); // No-op
await typeText(page, ""); // No-op
```

## Implementation Details

### Modifier Detection
The system uses an explicit list of modifier keys:
```typescript
const MODIFIER_KEYS = [
  'Shift', 'Control', 'Alt', 'Meta',
  'ShiftLeft', 'ControlLeft', 'AltLeft', 'MetaLeft',
  'ShiftRight', 'ControlRight', 'AltRight', 'MetaRight',
  'ControlOrMeta'
];
```

### Key Mapping Strategy
1. **Single characters**: Pass through unchanged (Playwright expects `"a"`, not `"KeyA"`)
2. **Special keys**: Map to PascalCase names (e.g., `"enter"` → `"Enter"`)
3. **Case-insensitive lookup**: `"ENTER"` → `"Enter"`
4. **Strict validation**: Unknown keys throw errors

### Error Handling
- **Validation**: `validateKey()` checks against known mappings
- **Errors**: Unknown keys throw descriptive errors with suggestions
- **Input validation**: Pre-flight checks prevent invalid operations
- **Clear messaging**: Error messages include supported key examples

## Testing

The implementation includes comprehensive test coverage:

- **50 total tests** covering keyboard and coordinate tools
- **43 unit tests** for keyboard actions, combinations, sequences, coordinate tools, and edge cases (including regression tests)
- **7 integration tests** with real Playwright browser instances (typing, sequences, special keys, and error handling)

## Migration Guide

### From Old Implementation
The new implementation includes breaking changes for error handling:

**Before:**
```typescript
// This would warn and continue
await agent.callTool("keyboard_action", { action: "press", key: "UnknownKey" });
// Warning logged, execution continued
```

**After:**
```typescript
// This throws an error
await agent.callTool("keyboard_action", { action: "press", key: "UnknownKey" });
// Error: "Unknown key \"UnknownKey\"..."
```

**Before:**
```typescript
// This would warn for unknown keys
normalizeKey("UnknownKey") // "UnknownKey" (with warning)
```

**After:**
```typescript
// This throws an error
normalizeKey("UnknownKey") // throws Error
```

## Performance Considerations

- **Key mapping**: O(1) lookup using JavaScript object
- **Validation**: Fast single-character and map checks
- **Normalization**: Minimal string operations
- **Memory**: Static key map loaded once per process

## Future Enhancements

- **Platform-specific mappings**: OS-aware key resolution
- **Custom key maps**: User-defined key mappings
- **Key sequence validation**: Pre-flight checks for complex sequences
- **Timing controls**: Configurable delays between key presses
