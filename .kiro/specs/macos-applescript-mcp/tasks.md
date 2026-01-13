# Implementation Plan

## Task Summary

**Total**: 12 major tasks, 28 sub-tasks
**Parallel Tasks**: 13 sub-tasks marked with (P)
**Requirements Coverage**: All 17 requirements (82 acceptance criteria)
**Design Refinements**: InputSanitizer + Tool Result Types Mapping

---

## Tasks

### Phase 1: Foundation

- [x] 1. Project Foundation & MCP Server Core
- [x] 1.1 Initialize the TypeScript project with MCP protocol support
  - Configure the development environment with TypeScript compiler settings
  - Install MCP SDK and Zod validation library dependencies
  - Set up module bundling for single executable output
  - Create project structure following modular architecture
  - _Requirements: 1.1_

- [x] 1.2 Create the MCP server that communicates over standard input/output
  - Implement server initialization with stdio transport for Claude Code compatibility
  - Handle ListTools requests by returning all available tools with their input schemas
  - Handle CallTool requests by routing to appropriate tool handlers
  - Return responses in MCP-compliant JSON format with content array
  - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [x] 2. AppleScript Execution Engine
- [x] 2.1 Build the central command executor that runs AppleScript via the system interpreter
  - Execute AppleScript commands using the osascript binary securely
  - Capture both standard output and error streams from script execution
  - Use execFile for security (no shell interpretation)
  - _Requirements: 2.1, 2.2_

- [x] 2.2 Add timeout protection and response parsing
  - Terminate scripts that exceed 30 seconds and return timeout error
  - Parse script output into structured JSON when format permits
  - Include detailed error information when scripts fail
  - _Requirements: 2.3, 2.4, 2.5_

- [x] 2.3 (P) Implement input sanitization utilities
  - Create sanitizeString() to escape AppleScript special characters (backslash, double quote)
  - Create sanitizePath() to validate file paths and reject null bytes
  - Create sanitizeIdentifier() for app names and window titles with length validation
  - Ensure all tool handlers use sanitization before building AppleScript commands
  - _Requirements: 11.2, 11.4_

- [x] 3. Permission Management System
  - Detect Accessibility permission status via System Events query
  - Detect Automation permission denial for specific applications
  - Detect Screen Recording permission status for screenshot operations
  - Generate actionable error messages with System Settings navigation paths
  - Cache permission status for performance with invalidation on errors
  - _Requirements: 11.1, 11.5, 11.6, 11.7_

- [x] 4. Error Handling Infrastructure
  - Define structured error response format with isError flag and content array
  - Implement input validation helpers for required parameters and types
  - Return validation errors specifying missing or invalid parameters
  - Handle unknown tool calls with clear error messaging
  - Ensure server stability when scripts return errors
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

---

### Phase 2: Basic Tools (No Permission Dependencies)

- [x] 5. System & Basic Tools
- [x] 5.1 (P) Implement system information retrieval tools
  - Return macOS version, hardware model, processor info, and total memory
  - Return battery percentage and charging status for portable Macs
  - Indicate desktop Mac status when no battery present
  - Return connected display information including resolution and name
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 5.2 (P) Implement clipboard management tools
  - Return current clipboard text content when requested
  - Set system clipboard to provided text content
  - Indicate content type when clipboard contains non-text data
  - Confirm successful clipboard operations
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5.3 (P) Implement notification display tools
  - Display macOS notifications with title and message
  - Support optional subtitle in notifications
  - Support optional notification sound playback
  - Confirm successful notification delivery
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 5.4 (P) Implement audio control tools
  - Return current system volume as percentage (0-100)
  - Set system volume to specified percentage with validation
  - Return validation error for volume values outside 0-100 range
  - Return current mute status
  - Enable and disable system audio mute
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 6. Application & Finder Tools
- [x] 6.1 (P) Implement application lifecycle management tools
  - Return list of running applications with names, bundle identifiers, and process IDs
  - Launch specified applications by name
  - Return error with application name when application not found
  - Gracefully quit specified applications
  - Bring specified applications to foreground
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6.2 (P) Implement Finder integration tools
  - Open Finder and select specified file path
  - Return error when specified path does not exist
  - Return list of currently selected files in Finder
  - Return path of frontmost Finder window
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

---

### Phase 3: Window Management

- [x] 7. Window Management Tools
- [x] 7.1 Implement window listing capabilities
  - Return all visible windows with titles, application names, positions, and sizes
  - Support filtering windows by application name parameter
  - Assign unique identifiers to windows for subsequent operations
  - _Requirements: 4.1, 4.2_

- [x] 7.2 Implement window manipulation capabilities
  - Bring specified window to front when focus requested
  - Move window to specified x/y coordinates
  - Resize window to specified width and height
  - Minimize specified window
  - _Requirements: 4.3, 4.4, 4.5, 4.6_

---

### Phase 4: Input Simulation (Accessibility Required)

- [x] 8. Input Simulation Tools
- [x] 8.1 (P) Implement mouse control tools
  - Perform left mouse click at specified coordinates
  - Support right-click and middle-click button options
  - Perform double-click at specified coordinates
  - Move cursor to specified position without clicking
  - Perform mouse drag between start and end coordinates
  - Support modifier keys (Command, Shift, Option, Control) during clicks
  - Hold modifier keys during click operations when specified
  - Require Accessibility permission with guidance on denial
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 11.7_

- [x] 8.2 (P) Implement keyboard input tools
  - Type text character by character at current cursor position
  - Support configurable delay between keystrokes
  - Press and release individual keys by name
  - Support special keys (Enter, Escape, Tab, Delete, Backspace, Arrow keys)
  - Support function keys F1 through F12
  - Press key combinations with modifiers (Command, Shift, Option, Control)
  - Activate target application before typing when required
  - Support repeating key presses specified number of times
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

- [x] 8.3 Implement scroll and navigation tools
  - Scroll vertically up or down in specified direction
  - Scroll horizontally left or right in specified direction
  - Scroll by specified pixel amount
  - Scroll at specified screen coordinates
  - Scroll until specified UI element becomes visible
  - Return error when target area does not support scrolling
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

---

### Phase 5: Screenshot Capture (Screen Recording Required)

- [x] 9. Screenshot Tools
- [x] 9.1 Implement screen capture functionality
  - Capture entire primary screen when no parameters specified
  - Capture specified display when display number provided
  - Capture only specified window when window ID provided
  - Capture rectangular region when coordinates provided
  - Return error when specified window does not exist
  - Require Screen Recording permission with guidance on denial
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.8, 11.6_

- [x] 9.2 Implement screenshot output options
  - Return screenshot as base64-encoded data by default
  - Support PNG and JPEG output formats
  - Save screenshot to specified file path when requested
  - _Requirements: 14.5, 14.6, 14.7_

---

### Phase 6: UI Automation (Accessibility Required)

- [x] 10. UI Element Interaction Tools
- [x] 10.1 Implement UI element tree retrieval
  - Return tree of accessible UI elements for specified application
  - Include element roles, titles, values, and positions in tree
  - Limit tree traversal to specified maximum depth
  - Generate unique element path identifiers for each element
  - _Requirements: 15.1, 15.2_

- [x] 10.2 Implement UI element interaction capabilities
  - Click specified UI element by element path
  - Return current value of specified UI element
  - Set editable element values when requested
  - Set keyboard focus to specified element
  - Return error with identifier when element not found
  - Require Accessibility permission with guidance on denial
  - _Requirements: 15.3, 15.4, 15.5, 15.6, 15.7, 11.1, 11.3_

---

### Phase 7: Menu Operations

- [x] 11. Menu Bar and Status Item Tools
- [x] 11.1 (P) Implement application menu tools
  - Return complete menu hierarchy for specified application
  - Include menu names, item names, and keyboard shortcuts in hierarchy
  - Click specified menu item by menu path
  - Return menu item state (enabled, checked, has submenu)
  - Return error with available items when menu path invalid
  - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [x] 11.2 (P) Implement status bar tools
  - Return all visible status bar items with descriptions and positions
  - Include associated process names for status items
  - Click status bar icon by description or process name
  - Open status menu and click specified menu item
  - Return error listing available items when status item not found
  - _Requirements: 17.5, 17.6, 17.7, 17.8_

- [x] 11.3 Implement menu bar structure retrieval
  - Return complete menu bar hierarchy for specified process
  - Include all menus, items, enabled states, and checked states
  - Support system menu extras via SystemUIServer process
  - Support third-party menu extras via their application processes
  - Wait for lazy-loaded menu items to populate after clicking
  - _Requirements: 17.9, 17.10, 17.11_

---

### Phase 8: Integration & Security

- [x] 12. Integration and Security Hardening
- [x] 12.1 Enforce security constraints across all tools
  - Ensure server only executes AppleScript commands, not arbitrary shell commands
  - Restrict window management to properties permitted by Accessibility APIs
  - Prevent persistence or transmission of user data beyond immediate responses
  - Sanitize all inputs to prevent AppleScript injection
  - _Requirements: 11.2, 11.3, 11.4_

- [x] 12.2 Validate end-to-end tool operation
  - Verify all tools respond correctly with MCP-compliant format
  - Test error responses for all error categories
  - Validate permission guidance messages are actionable
  - Confirm tool discovery returns complete tool list with schemas
  - Test multi-tool workflow sequences
  - _Requirements: 1.3, 1.4, 1.5, 10.1, 10.5_

---

## Requirements Coverage Matrix

| Requirement | Task(s) | Acceptance Criteria |
|-------------|---------|---------------------|
| 1 | 1.1, 1.2, 12.2 | 1.1, 1.2, 1.3, 1.4, 1.5 |
| 2 | 2.1, 2.2 | 2.1, 2.2, 2.3, 2.4, 2.5 |
| 3 | 6.1 | 3.1, 3.2, 3.3, 3.4, 3.5 |
| 4 | 7.1, 7.2 | 4.1, 4.2, 4.3, 4.4, 4.5, 4.6 |
| 5 | 5.1 | 5.1, 5.2, 5.3, 5.4 |
| 6 | 5.2 | 6.1, 6.2, 6.3, 6.4 |
| 7 | 5.3 | 7.1, 7.2, 7.3, 7.4 |
| 8 | 6.2 | 8.1, 8.2, 8.3, 8.4 |
| 9 | 5.4 | 9.1, 9.2, 9.3, 9.4, 9.5, 9.6 |
| 10 | 2.2, 4, 12.2 | 10.1, 10.2, 10.3, 10.4, 10.5 |
| 11 | 2.3, 3, 8.1, 9.1, 10.2, 12.1 | 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7 |
| 12 | 8.1 | 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8 |
| 13 | 8.2 | 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8 |
| 14 | 9.1, 9.2 | 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8 |
| 15 | 10.1, 10.2 | 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7 |
| 16 | 8.3 | 16.1, 16.2, 16.3, 16.4, 16.5, 16.6 |
| 17 | 11.1, 11.2, 11.3 | 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11 |

---

## Parallel Execution Guide

**Phase 2 (Maximum Parallelism)**:
- Tasks 5.1, 5.2, 5.3, 5.4: All parallel - no shared resources
- Tasks 6.1, 6.2: Parallel - different application targets

**Phase 4 (Partial Parallelism)**:
- Tasks 8.1, 8.2: Parallel - same permission, different input APIs
- Task 8.3: After 8.1 (may use mouse positioning)

**Phase 7 (Partial Parallelism)**:
- Tasks 11.1, 11.2: Parallel - different UI targets
- Task 11.3: After 11.1, 11.2 (uses both capabilities)

**Phase 1 (Partial Parallelism)**:
- Task 2.3: Parallel with 2.2 after 2.1 completes (sanitizer is independent)

**Sequential Dependencies**:
- Tasks 1-4: Foundation must complete before all others
- Task 7: Depends on Task 2 (executor)
- Tasks 8, 9, 10: Depend on Task 3 (permission system)
- Task 12: Final integration after all tools complete
