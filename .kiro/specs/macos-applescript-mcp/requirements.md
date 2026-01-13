# Requirements Document

## Introduction

This document defines the requirements for an MCP (Model Context Protocol) Server that enables AI assistants to control macOS through AppleScript. The server will expose a comprehensive set of tools for application management, window control, system information retrieval, clipboard operations, notifications, Finder integration, audio control, mouse/keyboard input simulation, screenshot capture, UI element interaction via Accessibility APIs, and menu bar/status item manipulation.

## Requirements

### Requirement 1: MCP Server Core Infrastructure

**Objective:** As a developer, I want a TypeScript MCP server that integrates with Claude Code, so that I can control macOS via AppleScript commands.

#### Acceptance Criteria

1. The MCP Server shall expose tools following Model Context Protocol specification
2. When initialized, the MCP Server shall connect via stdio transport for Claude Code compatibility
3. When a ListTools request is received, the MCP Server shall return all available tools with their schemas
4. When a CallTool request is received, the MCP Server shall execute the corresponding tool handler
5. The MCP Server shall return responses in MCP-compliant JSON format with content array

### Requirement 2: AppleScript Execution Engine

**Objective:** As the MCP Server, I want to execute AppleScript commands safely, so that macOS operations can be performed reliably.

#### Acceptance Criteria

1. When an AppleScript command is submitted, the AppleScript Engine shall execute it using the osascript binary
2. The AppleScript Engine shall capture both stdout and stderr from AppleScript execution
3. If AppleScript execution exceeds 30 seconds, the AppleScript Engine shall terminate the script and return a timeout error
4. If AppleScript returns an error, the AppleScript Engine shall include the error details in the response
5. The AppleScript Engine shall parse AppleScript output into structured JSON when possible

### Requirement 3: Application Control Tools

**Objective:** As an AI assistant, I want to manage macOS applications, so that I can help users launch, quit, and switch between apps.

#### Acceptance Criteria

1. When list_running_apps is called, the MCP Server shall return a list of all running applications with their names, bundle identifiers, and process IDs
2. When launch_app is called with an application name, the MCP Server shall launch the specified application
3. If the application is not found, the launch_app tool shall return an error with the application name that was not found
4. When quit_app is called with an application name, the MCP Server shall gracefully quit the specified application
5. When activate_app is called with an application name, the MCP Server shall bring the specified application to the foreground

### Requirement 4: Window Management Tools

**Objective:** As an AI assistant, I want to control windows, so that I can help users organize their workspace.

#### Acceptance Criteria

1. When list_windows is called, the MCP Server shall return all visible windows with their titles, application names, positions, and sizes
2. When list_windows is called with an application name parameter, the MCP Server shall return only windows belonging to that application
3. When focus_window is called with a window identifier, the MCP Server shall bring that window to the front
4. When move_window is called with x and y coordinates, the MCP Server shall move the window to the specified position
5. When resize_window is called with width and height, the MCP Server shall resize the window to the specified dimensions
6. When minimize_window is called with a window identifier, the MCP Server shall minimize the specified window

### Requirement 5: System Information Tools

**Objective:** As an AI assistant, I want to retrieve system information, so that I can provide context about the user's Mac.

#### Acceptance Criteria

1. When get_system_info is called, the MCP Server shall return the macOS version, hardware model, processor info, and total memory
2. When get_battery_status is called, the MCP Server shall return the battery percentage and charging status
3. If the Mac has no battery, get_battery_status shall return a response indicating it is a desktop Mac without battery
4. When get_display_info is called, the MCP Server shall return information about connected displays including resolution and name

### Requirement 6: Clipboard Tools

**Objective:** As an AI assistant, I want to access the clipboard, so that I can read and write content for the user.

#### Acceptance Criteria

1. When get_clipboard is called, the MCP Server shall return the current clipboard text content
2. When set_clipboard is called with text content, the MCP Server shall set the system clipboard to that content
3. If the clipboard contains non-text content, get_clipboard shall indicate the content type present
4. When set_clipboard completes successfully, the MCP Server shall confirm the content was set

### Requirement 7: Notification Tools

**Objective:** As an AI assistant, I want to display notifications, so that I can alert users to important events.

#### Acceptance Criteria

1. When send_notification is called with title and message, the MCP Server shall display a macOS notification
2. The send_notification tool shall accept optional subtitle parameter
3. The send_notification tool shall accept optional sound parameter to play notification sound
4. When the notification is sent, the MCP Server shall return confirmation of successful delivery

### Requirement 8: Finder Integration Tools

**Objective:** As an AI assistant, I want to interact with Finder, so that I can help users with file operations.

#### Acceptance Criteria

1. When reveal_in_finder is called with a file path, the MCP Server shall open Finder and select that file
2. When get_selected_files is called, the MCP Server shall return the list of currently selected files in Finder
3. If the path does not exist, reveal_in_finder shall return an error indicating the path is invalid
4. When get_finder_window_path is called, the MCP Server shall return the path of the frontmost Finder window

### Requirement 9: Audio Control Tools

**Objective:** As an AI assistant, I want to control audio settings, so that I can adjust volume for users.

#### Acceptance Criteria

1. When get_volume is called, the MCP Server shall return the current system volume as a percentage (0-100)
2. When set_volume is called with a value between 0 and 100, the MCP Server shall set the system volume to that percentage
3. If set_volume is called with a value outside 0-100, the MCP Server shall return a validation error
4. When get_mute_status is called, the MCP Server shall return whether system audio is muted
5. When set_mute is called with true, the MCP Server shall mute system audio
6. When set_mute is called with false, the MCP Server shall unmute system audio

### Requirement 10: Error Handling and Resilience

**Objective:** As a developer, I want robust error handling, so that failures are communicated clearly to the AI assistant.

#### Acceptance Criteria

1. If AppleScript execution fails, the MCP Server shall return isError: true with a descriptive error message
2. If required parameters are missing from a tool call, the MCP Server shall return a validation error specifying the missing parameters
3. If a tool receives an invalid input type, the MCP Server shall return an error with the expected format
4. The MCP Server shall not crash when AppleScript returns an error
5. If an unknown tool is called, the MCP Server shall return an error indicating the tool does not exist

### Requirement 11: Security and Permissions

**Objective:** As a user, I want proper permission handling, so that the server operates within macOS security boundaries.

#### Acceptance Criteria

1. If Accessibility permission is required but not granted, the MCP Server shall return an error explaining how to grant permission in System Settings
2. The MCP Server shall only execute AppleScript commands and shall not execute arbitrary shell commands
3. While executing window management tools, the MCP Server shall only access window properties permitted by macOS Accessibility APIs
4. The MCP Server shall not persist or transmit any user data beyond the immediate tool response
5. If Automation permission for a specific app is denied, the MCP Server shall return an error identifying which app permission is needed
6. If Screen Recording permission is required for screenshots but not granted, the MCP Server shall return an error explaining how to grant permission
7. When mouse or keyboard control tools are used, the MCP Server shall require Accessibility permission

### Requirement 12: Mouse Control Tools

**Objective:** As an AI assistant, I want to control mouse input, so that I can automate clicking and pointing operations on macOS.

#### Acceptance Criteria

1. When click is called with x and y coordinates, the MCP Server shall perform a left mouse click at that position
2. When click is called with button parameter set to "right", the MCP Server shall perform a right-click at the specified coordinates
3. When click is called with button parameter set to "middle", the MCP Server shall perform a middle-click at the specified coordinates
4. When double_click is called with coordinates, the MCP Server shall perform a double-click at that position
5. When move_mouse is called with x and y coordinates, the MCP Server shall move the cursor to that position without clicking
6. When drag is called with start coordinates and end coordinates, the MCP Server shall perform a mouse drag operation between those points
7. The click tool shall support modifier keys parameter accepting Command, Shift, Option, and Control
8. When click is called with modifiers, the MCP Server shall hold the specified modifier keys during the click

### Requirement 13: Keyboard Input Tools

**Objective:** As an AI assistant, I want to simulate keyboard input, so that I can type text and trigger keyboard shortcuts.

#### Acceptance Criteria

1. When type_text is called with a string, the MCP Server shall type each character sequentially at the current cursor position
2. When type_text is called with delay parameter, the MCP Server shall pause the specified milliseconds between keystrokes
3. When press_key is called with a key name, the MCP Server shall press and release that key
4. The press_key tool shall support special keys including Enter, Escape, Tab, Delete, Backspace, and Arrow keys
5. The press_key tool shall support function keys F1 through F12
6. When key_combination is called with modifiers and key, the MCP Server shall press the key combination (e.g., Command+C, Command+Shift+S)
7. If the target application requires focus before typing, the MCP Server shall activate that application first
8. When press_key is called with repeat parameter, the MCP Server shall press the key the specified number of times

### Requirement 14: Screenshot Capture Tools

**Objective:** As an AI assistant, I want to capture screenshots, so that I can observe the current screen state.

#### Acceptance Criteria

1. When take_screenshot is called without parameters, the MCP Server shall capture the entire primary screen
2. When take_screenshot is called with display parameter, the MCP Server shall capture the specified display
3. When take_screenshot is called with window parameter, the MCP Server shall capture only the specified window
4. When take_screenshot is called with region coordinates (x, y, width, height), the MCP Server shall capture only that rectangular area
5. The take_screenshot tool shall return the image as base64-encoded data by default
6. When take_screenshot is called with format parameter, the MCP Server shall support PNG and JPEG output formats
7. When take_screenshot is called with file_path parameter, the MCP Server shall save the screenshot to that path
8. If the specified window does not exist, take_screenshot shall return an error indicating the window was not found

### Requirement 15: UI Element Interaction Tools

**Objective:** As an AI assistant, I want to interact with UI elements by their accessibility properties, so that I can automate application interactions reliably.

#### Acceptance Criteria

1. When get_ui_elements is called with an application name, the MCP Server shall return a tree of accessible UI elements with their roles, titles, values, and positions
2. When get_ui_elements is called with max_depth parameter, the MCP Server shall limit the tree traversal to that depth
3. When click_ui_element is called with an element path or identifier, the MCP Server shall click that specific UI element
4. When get_ui_element_value is called with an element identifier, the MCP Server shall return the current value of that element
5. When set_ui_element_value is called with identifier and value, the MCP Server shall set the element's value if it is editable
6. If the UI element is not found, the MCP Server shall return an error with the element identifier that was not found
7. When focus_ui_element is called with an element identifier, the MCP Server shall set keyboard focus to that element

### Requirement 16: Scroll and Navigation Tools

**Objective:** As an AI assistant, I want to perform scroll operations, so that I can navigate content within applications.

#### Acceptance Criteria

1. When scroll is called with direction "up" or "down", the MCP Server shall scroll vertically in that direction
2. When scroll is called with direction "left" or "right", the MCP Server shall scroll horizontally in that direction
3. When scroll is called with amount parameter, the MCP Server shall scroll by the specified pixel amount
4. When scroll is called with x and y coordinates, the MCP Server shall scroll at that specific screen position
5. When scroll_to_element is called with a UI element identifier, the MCP Server shall scroll until that element is visible
6. If the target area does not support scrolling, the MCP Server shall return an error indicating scrolling is not available

### Requirement 17: Menu Bar and Status Item Tools

**Objective:** As an AI assistant, I want to interact with application menus and status bar items, so that I can automate menu-based operations and control status bar applications.

#### Acceptance Criteria

**Application Menu Operations:**

1. When list_menu_items is called with an application name, the MCP Server shall return the complete menu hierarchy for that application including menu names, item names, and keyboard shortcuts
2. When click_menu_item is called with application name and menu path (e.g., "File > Save As..."), the MCP Server shall click that menu item
3. When get_menu_item_state is called with application name and menu path, the MCP Server shall return whether the menu item is enabled, checked, or has a submenu
4. If the menu item path is invalid, the MCP Server shall return an error with available menu items at the failed level

**Status Bar Operations:**

5. When list_status_bar_items is called, the MCP Server shall return all visible status bar items with their descriptions, positions, and associated process names
6. When click_status_bar_item is called with an item description or process name, the MCP Server shall click that status bar icon to open its menu
7. When click_status_bar_menu_item is called with status item identifier and menu item path, the MCP Server shall open the status menu and click the specified menu item
8. If the status bar item is not found, the MCP Server shall return an error listing available status bar items

**Menu Bar Structure:**

9. When get_menu_bar_structure is called with a process name, the MCP Server shall return the complete menu bar hierarchy including all menus, items, enabled states, and checked states
10. The MCP Server shall support both system menu extras (via SystemUIServer process) and third-party menu extras (via their respective application processes)
11. When interacting with third-party status bar items, the MCP Server shall handle lazy-loaded menu items by waiting for the menu to populate after clicking
