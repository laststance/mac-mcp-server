# mac-mcp-server

[![npm version](https://img.shields.io/npm/v/mac-mcp-server.svg)](https://www.npmjs.com/package/mac-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.11.0-brightgreen.svg)](https://nodejs.org/)
[![macOS](https://img.shields.io/badge/macOS-10.15%2B-blue.svg)](https://www.apple.com/macos/)

A macOS AppleScript MCP (Model Context Protocol) server that enables Claude Code and other AI assistants to automate macOS through AppleScript and JXA (JavaScript for Automation).

## Overview

This MCP server provides 44 tools for comprehensive macOS automation, allowing AI assistants to:

- Retrieve system information (hardware, battery, displays)
- Manage applications (launch, quit, activate, list running apps)
- Control windows (move, resize, focus, minimize)
- Simulate keyboard and mouse input
- Interact with UI elements via Accessibility APIs
- Capture screenshots (auto-optimized for API compatibility)
- Access clipboard and notifications
- Control audio settings
- Navigate menus and status bar items

The server communicates over stdio for seamless Claude Code integration and uses AppleScript/JXA for system automation.

## Quick Start

### Prerequisites

- macOS 10.15 (Catalina) or later
- Node.js 20.11.0 or later

### Install from npm

```bash
npm install -g mac-mcp-server
```

### Configure Claude Code

Add the following to your Claude Code MCP configuration (`~/.claude.json` or Claude Desktop settings):

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

Restart Claude Code to load the MCP server.

### Grant macOS Permissions

On first use, macOS will prompt you to grant required permissions. See the [Permissions Guide](#macos-permissions) below for details.

## Tool Reference

### System Information

| Tool                 | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| `get_system_info`    | Retrieves macOS version, hardware model, processor, and memory |
| `get_battery_status` | Gets battery percentage and charging status (MacBooks)         |
| `get_display_info`   | Lists connected displays with resolution information           |

### Audio Control

| Tool              | Description                                |
| ----------------- | ------------------------------------------ |
| `get_volume`      | Gets current system volume (0-100)         |
| `set_volume`      | Sets system volume to specified percentage |
| `get_mute_status` | Checks if system audio is muted            |
| `set_mute`        | Mutes or unmutes system audio              |

### Clipboard and Notifications

| Tool                | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `get_clipboard`     | Reads current clipboard content (text, image, or files)        |
| `set_clipboard`     | Sets clipboard to specified text                               |
| `send_notification` | Displays a macOS notification with optional subtitle and sound |

### Application Management

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

**Screenshot Features:**

- **Auto-resize**: Screenshots are resized to max 1600px (configurable) for API compatibility
- **Auto-compress**: File size limited to 1.8MB using JPEG compression when needed
- **Full resolution**: Use `rawFile: true` for file output at full resolution
- **Disable processing**: Set `maxDimension: 0` and `maxFileSize: 0` to disable all processing

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

## macOS Permissions

This server requires specific macOS permissions to function. The first time you use certain tools, macOS will prompt you to grant access.

### Required Permissions

#### 1. Accessibility

**Required for:** Keyboard input, mouse control, UI element interaction, window management

**Grant access:**

1. Open **System Settings > Privacy & Security > Accessibility**
2. Click the **+** button and add your terminal app (Terminal, iTerm2, or Claude Code)
3. Toggle the switch to enable access
4. **Restart your terminal** after granting permission

**Quick access:**

```bash
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
```

#### 2. Automation

**Required for:** Controlling other applications (Finder, Safari, etc.)

**Grant access:**

1. Open **System Settings > Privacy & Security > Automation**
2. Find your terminal app in the list
3. Enable checkboxes for target applications you want to control
4. If prompted during first use, click **OK** to allow

**Quick access:**

```bash
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"
```

#### 3. Screen Recording

**Required for:** Screenshots

**Grant access:**

1. Open **System Settings > Privacy & Security > Screen Recording**
2. Click the **+** button and add your terminal app
3. Toggle the switch to enable access
4. **Restart your terminal** after granting permission

**Quick access:**

```bash
open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
```

### Troubleshooting Permissions

| Issue                                  | Solution                                                  |
| -------------------------------------- | --------------------------------------------------------- |
| Permission added but not working       | Restart your terminal app completely (Cmd+Q, then reopen) |
| App not appearing in permission list   | Run the operation once to trigger the permission dialog   |
| Permission still denied after granting | Remove the app from the list, restart, then re-add it     |
| All permission issues persist          | Restart macOS                                             |
| "assistive access" error               | Grant **Accessibility** permission specifically           |
| "-1743" error code                     | Grant **Automation** permission for the target app        |
| Screenshot returns black image         | Grant **Screen Recording** permission and restart         |

### Permission Checklist

Before using mac-mcp-server, verify these permissions are granted:

- [ ] **Accessibility** - Terminal/Claude Code added and enabled
- [ ] **Automation** - Target apps enabled under your terminal
- [ ] **Screen Recording** - Terminal/Claude Code added and enabled
- [ ] **App restarted** after granting permissions

## Usage Examples

### System Information

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
// Capture full screen (auto-resized and compressed for API)
await take_screenshot({})

// Capture to file (also auto-processed by default)
await take_screenshot({ filePath: '/tmp/screenshot.png' })

// Capture at full resolution (no processing)
await take_screenshot({ filePath: '/tmp/full.png', rawFile: true })

// Capture specific region
await take_screenshot({
  region: { x: 100, y: 100, width: 800, height: 600 },
})

// Custom compression settings
await take_screenshot({
  maxDimension: 1920, // Max 1920px
  maxFileSize: 1_000_000, // Max 1MB
  quality: 70, // JPEG quality 70
})

// Disable all processing for base64 output
await take_screenshot({ maxDimension: 0, maxFileSize: 0 })
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

## Installation from Source

For development or customization:

```bash
git clone https://github.com/laststance/mac-mcp-server.git
cd mac-mcp-server
pnpm install
pnpm build
```

Then configure Claude Code to use the local build:

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

## Development

### Commands

| Command          | Description               |
| ---------------- | ------------------------- |
| `pnpm build`     | Build for production      |
| `pnpm dev`       | Development mode (watch)  |
| `pnpm test`      | Run tests                 |
| `pnpm typecheck` | TypeScript type checking  |
| `pnpm lint`      | Lint code                 |
| `pnpm lint:fix`  | Lint and auto-fix         |
| `pnpm format`    | Format code with Prettier |

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

## Requirements

| Requirement | Version                   |
| ----------- | ------------------------- |
| macOS       | 10.15 (Catalina) or later |
| Node.js     | 20.11.0 or later          |
| pnpm        | 10.28.0 (for development) |

## License

MIT

## Author

[Laststance.io](https://github.com/laststance)

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
