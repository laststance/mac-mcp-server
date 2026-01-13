# mac-mcp-server

A macOS AppleScript MCP (Model Context Protocol) server that enables Claude Code and other AI assistants to automate macOS through AppleScript and JXA (JavaScript for Automation).

## Overview

This MCP server provides a comprehensive set of tools for macOS automation, allowing AI assistants to:

- Retrieve system information (hardware, battery, displays)
- Manage applications (launch, quit, activate, list running apps)
- Control windows (move, resize, focus, minimize)
- Simulate keyboard and mouse input
- Interact with UI elements via Accessibility APIs
- Capture screenshots
- Access clipboard and notifications
- Control audio settings
- Navigate menus and status bar items

The server communicates over stdio for seamless Claude Code integration and uses AppleScript/JXA for system automation.

## Features

### System Information

| Tool                 | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| `get_system_info`    | Retrieves macOS version, hardware model, processor, and memory |
| `get_battery_status` | Gets battery percentage and charging status (MacBooks)         |
| `get_display_info`   | Lists connected displays with resolution information           |

### Clipboard Management

| Tool            | Description                                             |
| --------------- | ------------------------------------------------------- |
| `get_clipboard` | Reads current clipboard content (text, image, or files) |
| `set_clipboard` | Sets clipboard to specified text                        |

### Notifications

| Tool                | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `send_notification` | Displays a macOS notification with optional subtitle and sound |

### Audio Control

| Tool              | Description                                |
| ----------------- | ------------------------------------------ |
| `get_volume`      | Gets current system volume (0-100)         |
| `set_volume`      | Sets system volume to specified percentage |
| `get_mute_status` | Checks if system audio is muted            |
| `set_mute`        | Mutes or unmutes system audio              |

### Application Lifecycle

| Tool                | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| `list_running_apps` | Lists all running GUI applications with bundle IDs and PIDs |
| `launch_app`        | Launches an application by name                             |
| `quit_app`          | Gracefully quits an application                             |
| `activate_app`      | Brings an application to the foreground                     |

### Finder Integration

| Tool                     | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `reveal_in_finder`       | Opens Finder and selects the specified file or folder |
| `get_selected_files`     | Gets paths of currently selected files in Finder      |
| `get_finder_window_path` | Gets the path of the frontmost Finder window          |

### Window Management

| Tool              | Description                                      |
| ----------------- | ------------------------------------------------ |
| `list_windows`    | Lists all visible windows with position and size |
| `focus_window`    | Brings a specific window to the front            |
| `move_window`     | Moves a window to specified coordinates          |
| `resize_window`   | Resizes a window to specified dimensions         |
| `minimize_window` | Minimizes a window to the Dock                   |

### Mouse Control

| Tool           | Description                                             |
| -------------- | ------------------------------------------------------- |
| `click`        | Performs a mouse click (left, right, or middle button)  |
| `double_click` | Performs a double-click                                 |
| `move_mouse`   | Moves the cursor without clicking                       |
| `drag`         | Performs a drag operation from start to end coordinates |

### Keyboard Input

| Tool              | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `type_text`       | Types text at the current cursor position                |
| `press_key`       | Presses a key by name (Enter, Tab, Escape, F1-F12, etc.) |
| `key_combination` | Presses a key combination (e.g., Cmd+C, Cmd+Shift+S)     |

### Scroll and Navigation

| Tool                | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `scroll`            | Scrolls in a specified direction (up, down, left, right) |
| `scroll_to_element` | Scrolls until a UI element becomes visible               |

### Screenshots

| Tool              | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `take_screenshot` | Captures screen, display, window, or region as PNG/JPEG |

### UI Element Interaction

| Tool                   | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `get_ui_elements`      | Retrieves the UI element tree for an application |
| `click_ui_element`     | Clicks a UI element by path                      |
| `get_ui_element_value` | Gets the value of a UI element                   |
| `set_ui_element_value` | Sets the value of an editable UI element         |
| `focus_ui_element`     | Sets keyboard focus to a UI element              |

### Menu Bar Operations

| Tool                         | Description                                      |
| ---------------------------- | ------------------------------------------------ |
| `list_menu_items`            | Gets the menu hierarchy for an application       |
| `click_menu_item`            | Clicks a menu item by path (e.g., "File > Save") |
| `get_menu_item_state`        | Gets enabled/checked state of a menu item        |
| `list_status_bar_items`      | Lists visible status bar items                   |
| `click_status_bar_item`      | Clicks a status bar item to open its menu        |
| `click_status_bar_menu_item` | Clicks a menu item within a status bar menu      |
| `get_menu_bar_structure`     | Gets complete menu bar hierarchy for a process   |

## Installation

### Prerequisites

- macOS 10.15 (Catalina) or later
- Node.js 20.11.0 or later

### Install from npm

```bash
npm install -g mac-mcp-server
```

### Install from source

```bash
git clone https://github.com/laststance/mac-mcp-server.git
cd mac-mcp-server
pnpm install
pnpm build
```

### Claude Code Configuration

Add the following to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "mac-mcp-server": {
      "command": "npx",
      "args": ["-y", "mac-mcp-server"]
    }
  }
}
```

Or if installed from source:

```json
{
  "mcpServers": {
    "mac-mcp-server": {
      "command": "node",
      "args": ["/path/to/mac-mcp-server/dist/index.js"]
    }
  }
}
```

## macOS Permissions

This server requires specific macOS permissions to function. The first time you use certain tools, macOS will prompt you to grant access.

### Permission Types

#### Accessibility Permission

**Required for:** Keyboard input, mouse control, UI element interaction, window management

**Grant access:**

1. Open System Settings > Privacy & Security > Accessibility
2. Add Terminal (or Claude Code / your IDE) to the list of allowed apps
3. Restart Terminal / Claude Code after granting permission

**Direct link:**

```bash
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
```

#### Automation Permission

**Required for:** Controlling other applications (Finder, Safari, etc.)

**Grant access:**

1. Open System Settings > Privacy & Security > Automation
2. Enable checkboxes for target applications under your terminal app
3. If prompted during first use, click "OK" to allow

**Direct link:**

```bash
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"
```

#### Screen Recording Permission

**Required for:** Screenshots

**Grant access:**

1. Open System Settings > Privacy & Security > Screen Recording
2. Add Terminal (or Claude Code / your IDE) to the list of allowed apps
3. Restart Terminal / Claude Code after granting permission

**Direct link:**

```bash
open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
```

### Troubleshooting Permissions

| Issue                                  | Solution                                                |
| -------------------------------------- | ------------------------------------------------------- |
| Permission added but not working       | Restart Terminal / Claude Code completely               |
| App not appearing in list              | Try the operation once to trigger the permission dialog |
| Permission still denied after granting | Remove the app from the list, then re-add it            |
| All permission issues persist          | Restart macOS                                           |
| "assistive access" error               | Grant Accessibility permission specifically             |
| "-1743" error code                     | Grant Automation permission for the target app          |

## Usage Examples

### Get System Information

```typescript
// Get system info
await get_system_info({})
// Returns: { macOSVersion: "15.0", hardwareModel: "MacBook Pro", ... }

// Get battery status
await get_battery_status({})
// Returns: { percentage: 85, isCharging: true, isDesktop: false }
```

### Application Management

```typescript
// List running applications
await list_running_apps({})
// Returns: [{ name: "Safari", bundleId: "com.apple.Safari", processId: 1234 }, ...]

// Launch an application
await launch_app({ name: 'Safari' })

// Quit an application
await quit_app({ name: 'Safari' })
```

### Window Management

```typescript
// List all windows
await list_windows({})

// Focus a specific window
await focus_window({ appName: 'Finder', windowIndex: 1 })

// Move a window
await move_window({ appName: 'Finder', x: 100, y: 100 })

// Resize a window
await resize_window({ appName: 'Finder', width: 800, height: 600 })
```

### Keyboard and Mouse

```typescript
// Type text
await type_text({ text: 'Hello, World!' })

// Press a key
await press_key({ key: 'enter' })

// Key combination (Cmd+C)
await key_combination({ modifiers: ['command'], key: 'c' })

// Click at coordinates
await click({ x: 500, y: 300 })

// Right-click
await click({ x: 500, y: 300, button: 'right' })

// Cmd+click
await click({ x: 500, y: 300, modifiers: ['command'] })
```

### Screenshots

```typescript
// Capture full screen (returns base64)
await take_screenshot({})

// Capture to file
await take_screenshot({ filePath: '/tmp/screenshot.png' })

// Capture specific region
await take_screenshot({
  region: { x: 100, y: 100, width: 800, height: 600 },
})

// Capture specific display
await take_screenshot({ display: 1 })
```

### UI Element Interaction

```typescript
// Get UI element tree
await get_ui_elements({ appName: 'Safari', maxDepth: 3 })

// Click a button by path
await click_ui_element({
  appName: 'Safari',
  elementPath: 'window1/button1',
})

// Set text field value
await set_ui_element_value({
  appName: 'TextEdit',
  elementPath: 'window1/textfield1',
  value: 'New text',
})
```

### Menu Operations

```typescript
// List application menus
await list_menu_items({ appName: 'Finder' })

// Click a menu item
await click_menu_item({
  appName: 'Finder',
  menuPath: 'File > New Finder Window',
})

// Get menu item state
await get_menu_item_state({
  appName: 'Finder',
  menuPath: 'View > Show Path Bar',
})
```

## Development

### Build

```bash
pnpm build
```

### Development Mode (Watch)

```bash
pnpm dev
```

### Run Tests

```bash
pnpm test
```

### Type Check

```bash
pnpm typecheck
```

### Lint

```bash
pnpm lint
pnpm lint:fix
```

### Format

```bash
pnpm format
```

### Project Structure

```
mac-mcp-server/
├── src/
│   ├── index.ts           # Entry point, MCP server setup
│   ├── lib/
│   │   ├── server.ts      # MCP server configuration
│   │   ├── executor.ts    # AppleScript execution
│   │   ├── permission.ts  # Permission checking and guidance
│   │   └── sanitizer.ts   # Input sanitization
│   └── tools/
│       ├── system.ts      # System information tools
│       ├── clipboard.ts   # Clipboard management
│       ├── notification.ts # Notification display
│       ├── audio.ts       # Audio control
│       ├── application.ts # Application lifecycle
│       ├── finder.ts      # Finder integration
│       ├── window.ts      # Window management
│       ├── mouse.ts       # Mouse control
│       ├── keyboard.ts    # Keyboard input
│       ├── scroll.ts      # Scroll operations
│       ├── screenshot.ts  # Screenshot capture
│       ├── ui-element.ts  # UI element interaction
│       └── menu.ts        # Menu bar operations
├── dist/                  # Compiled output
├── package.json
└── tsconfig.json
```

## Security

This MCP server is designed with security in mind:

- **AppleScript-only execution**: All automation is performed through AppleScript and JXA. No arbitrary shell commands are executed.
- **Input sanitization**: All user inputs are sanitized before being included in AppleScript to prevent injection attacks.
- **No data persistence**: The server does not store any user data or credentials.
- **Permission-gated access**: All sensitive operations require explicit macOS permission grants.
- **Scoped automation**: Each tool has a specific, limited purpose rather than providing general system access.

## License

MIT

## Author

[Laststance.io](https://github.com/laststance)
