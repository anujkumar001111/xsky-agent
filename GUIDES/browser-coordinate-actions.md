# Browser Coordinate Actions

This guide describes the coordinate-based mouse operations available in the browser agent. These tools allow for precise interaction with web pages using x/y coordinates, supplementing the existing element-labeling system.

**Note**: These tools are currently available in the Node.js Browser Agent.

## Overview

Coordinate actions are useful when:
*   Interactive elements are not detected by the labeling system.
*   You need to interact with a specific part of an element (e.g., drawing on a canvas).
*   You need to simulate hover states on specific regions.
*   You are working with complex UIs like maps or games.

## Configuration

To use coordinate tools, ensure `enableCoordinateTools` is set to `true` in your configuration (default is `true`).

## Tools

### `click_at_coordinates`

Clicks at a specific coordinate in the browser viewport.

**Parameters:**
*   `x` (number, required): X coordinate from screenshot.
*   `y` (number, required): Y coordinate from screenshot.
*   `button` (string, optional): Mouse button ("left", "right", "middle"). Default is "left".
*   `clicks` (number, optional): Number of clicks (1, 2, 3). Default is 1.

**Example:**
```json
{
  "name": "click_at_coordinates",
  "arguments": {
    "x": 100,
    "y": 200,
    "button": "left"
  }
}
```

### `hover_at_coordinates`

Moves cursor to specific coordinates to trigger hover states and reveal dynamic content.

**Parameters:**
*   `x` (number, required): X coordinate.
*   `y` (number, required): Y coordinate.

**Example:**
```json
{
  "name": "hover_at_coordinates",
  "arguments": {
    "x": 500,
    "y": 300
  }
}
```

### `drag_to_coordinates`

Drags the mouse from a start position to an end position.

**Parameters:**
*   `start_x` (number, required): Starting X coordinate.
*   `start_y` (number, required): Starting Y coordinate.
*   `end_x` (number, required): Ending X coordinate.
*   `end_y` (number, required): Ending Y coordinate.

**Example:**
```json
{
  "name": "drag_to_coordinates",
  "arguments": {
    "start_x": 100,
    "start_y": 100,
    "end_x": 200,
    "end_y": 200
  }
}
```

### `scroll_at_coordinates`

Scrolls the mouse wheel at a specific position.

**Parameters:**
*   `x` (number, required): X coordinate.
*   `y` (number, required): Y coordinate.
*   `direction` (string, required): "up", "down", "left", "right".
*   `amount` (number, optional): Scroll amount multiplier (default 3).

**Example:**
```json
{
  "name": "scroll_at_coordinates",
  "arguments": {
    "x": 500,
    "y": 300,
    "direction": "down"
  }
}
```

### `type_at_coordinates`

Clicks at coordinates and types text.

**Parameters:**
*   `x` (number, required): X coordinate.
*   `y` (number, required): Y coordinate.
*   `text` (string, required): Text to type.
*   `clear_first` (boolean, optional): Whether to clear existing text (default true).

**Example:**
```json
{
  "name": "type_at_coordinates",
  "arguments": {
    "x": 100,
    "y": 200,
    "text": "Hello World"
  }
}
```

## Scaling

Coordinates provided to these tools are automatically scaled if the agent is viewing a scaled screenshot. You should provide coordinates based on the screenshot you see.
