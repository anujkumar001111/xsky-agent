# Tools Reference

## Built-in System Tools

These tools are automatically available when needed by the workflow structure.

### `variable_storage`
- **Purpose**: Read/write context variables (`{{var}}`).
- **Methods**: `set`, `get`, `list`.
- **Usage**: Sharing data between steps/agents.

### `human_interact`
- **Purpose**: Ask the user for input.
- **Methods**: `ask(question)`.
- **Usage**: When the agent is stuck or needs clarification.

### `task_node_status`
- **Purpose**: Report status of the current workflow node.
- **Methods**: `update(status)`.

### `foreach_task`
- **Purpose**: Internal tool to handle `<forEach>` loop logic.

### `watch_trigger`
- **Purpose**: Internal tool to handle `<watch>` logic.

## Browser Tools

Common tools exposed by BrowserAgents.

- `navigate(url)`: Go to URL.
- `click(element_id)`: Click an element (using numeric labels).
- `type(element_id, text)`: Type into input.
- `scroll(direction, amount)`: Scroll page.
- `get_page_state()`: Get accessibility tree / DOM snapshot.
- `capture_screenshot()`: Return base64 screenshot.
- `go_back()` / `go_forward()`: History navigation.

## File Tools

Common tools exposed by FileAgents.

- `read_file(path)`
- `write_file(path, content)`
- `list_directory(path)`
- `file_exists(path)`
