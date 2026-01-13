/**
 * Tool Registration Module
 *
 * Registers all macOS automation tools with the MCP server.
 * Bridges the gap between tool implementations and MCP protocol.
 *
 * @module register-tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// System tools
import {
  GetSystemInfoSchema,
  GetBatteryStatusSchema,
  GetDisplayInfoSchema,
  getSystemInfo,
  getBatteryStatus,
  getDisplayInfo,
} from '../tools/system.js'

// Audio tools
import {
  GetVolumeSchema,
  SetVolumeSchema,
  GetMuteStatusSchema,
  SetMuteSchema,
  getVolume,
  setVolume,
  getMuteStatus,
  setMute,
} from '../tools/audio.js'

// Clipboard tools
import {
  GetClipboardSchema,
  SetClipboardSchema,
  getClipboard,
  setClipboard,
} from '../tools/clipboard.js'

// Notification tools
import {
  SendNotificationSchema,
  sendNotification,
  type SendNotificationInput,
} from '../tools/notification.js'

// Application tools
import {
  ListRunningAppsSchema,
  LaunchAppSchema,
  QuitAppSchema,
  ActivateAppSchema,
  listRunningApps,
  launchApp,
  quitApp,
  activateApp,
} from '../tools/application.js'

// Finder tools
import {
  RevealInFinderSchema,
  GetSelectedFilesSchema,
  GetFinderWindowPathSchema,
  revealInFinder,
  getSelectedFiles,
  getFinderWindowPath,
} from '../tools/finder.js'

// Window tools
import {
  ListWindowsSchema,
  FocusWindowSchema,
  MoveWindowSchema,
  ResizeWindowSchema,
  MinimizeWindowSchema,
  listWindows,
  focusWindow,
  moveWindow,
  resizeWindow,
  minimizeWindow,
  type ListWindowsInput,
  type WindowReferenceInput,
  type MoveWindowInput,
  type ResizeWindowInput,
} from '../tools/window.js'

// Mouse tools
import {
  ClickSchema,
  DoubleClickSchema,
  MoveMouseSchema,
  DragSchema,
  click,
  doubleClick,
  moveMouse,
  drag,
  type ClickInput,
} from '../tools/mouse.js'

// Keyboard tools
import {
  TypeTextSchema,
  PressKeySchema,
  KeyCombinationSchema,
  typeText,
  pressKey,
  keyCombination,
  type TypeTextInput,
} from '../tools/keyboard.js'

// Scroll tools
import {
  ScrollSchema,
  ScrollToElementSchema,
  scroll,
  scrollToElement,
  type ScrollInput,
} from '../tools/scroll.js'

// Screenshot tools
import {
  TakeScreenshotSchema,
  takeScreenshot,
  type ScreenshotInput,
} from '../tools/screenshot.js'

// UI Element tools
import {
  GetUIElementsSchema,
  ClickUIElementSchema,
  GetUIElementValueSchema,
  SetUIElementValueSchema,
  FocusUIElementSchema,
  getUIElements,
  clickUIElement,
  getUIElementValue,
  setUIElementValue,
  focusUIElement,
} from '../tools/ui-element.js'

// Menu tools
import {
  ListMenuItemsSchema,
  ClickMenuItemSchema,
  GetMenuItemStateSchema,
  ListStatusBarItemsSchema,
  ClickStatusBarItemSchema,
  ClickStatusBarMenuItemSchema,
  GetMenuBarStructureSchema,
  listMenuItems,
  clickMenuItem,
  getMenuItemState,
  listStatusBarItems,
  clickStatusBarItem,
  clickStatusBarMenuItem,
  getMenuBarStructure,
} from '../tools/menu.js'

/**
 * Converts a tool result to MCP response format.
 *
 * @param result - Tool result with success, data, error, or message fields
 * @returns MCP-compliant response
 */
function toMcpResponse(result: {
  success: boolean
  data?: unknown
  error?: string
  message?: string
}) {
  if (!result.success) {
    return {
      isError: true,
      content: [
        { type: 'text' as const, text: result.error ?? 'Unknown error' },
      ],
    }
  }

  const text = result.data
    ? JSON.stringify(result.data, null, 2)
    : (result.message ?? 'Success')

  return {
    content: [{ type: 'text' as const, text }],
  }
}

/**
 * Registers all macOS automation tools with the MCP server.
 *
 * @param server - The MCP server instance
 *
 * @example
 * const server = createMcpServer()
 * registerAllTools(server)
 * await server.connect(transport)
 */
export function registerAllTools(server: McpServer): void {
  // ========== System Tools ==========

  server.tool(
    'get_system_info',
    'Retrieves macOS system information including version, hardware model, processor, and memory',
    GetSystemInfoSchema.shape,
    async () => toMcpResponse(await getSystemInfo()),
  )

  server.tool(
    'get_battery_status',
    'Gets battery percentage and charging status (MacBooks only, returns isDesktop: true for desktop Macs)',
    GetBatteryStatusSchema.shape,
    async () => toMcpResponse(await getBatteryStatus()),
  )

  server.tool(
    'get_display_info',
    'Lists connected displays with name, resolution, and main display indicator',
    GetDisplayInfoSchema.shape,
    async () => toMcpResponse(await getDisplayInfo()),
  )

  // ========== Audio Tools ==========

  server.tool(
    'get_volume',
    'Gets the current system volume as a percentage (0-100)',
    GetVolumeSchema.shape,
    async () => toMcpResponse(await getVolume()),
  )

  server.tool(
    'set_volume',
    'Sets the system volume to a specified percentage (0-100)',
    SetVolumeSchema.shape,
    async (params) => toMcpResponse(await setVolume(params)),
  )

  server.tool(
    'get_mute_status',
    'Checks if system audio is currently muted',
    GetMuteStatusSchema.shape,
    async () => toMcpResponse(await getMuteStatus()),
  )

  server.tool(
    'set_mute',
    'Mutes or unmutes system audio',
    SetMuteSchema.shape,
    async (params) => toMcpResponse(await setMute(params)),
  )

  // ========== Clipboard Tools ==========

  server.tool(
    'get_clipboard',
    'Reads current clipboard content (text, image paths, or file paths)',
    GetClipboardSchema.shape,
    async () => toMcpResponse(await getClipboard()),
  )

  server.tool(
    'set_clipboard',
    'Sets clipboard to specified text content',
    SetClipboardSchema.shape,
    async (params) => toMcpResponse(await setClipboard(params)),
  )

  // ========== Notification Tools ==========

  server.tool(
    'send_notification',
    'Displays a macOS notification with title, optional message, subtitle, and sound',
    SendNotificationSchema.shape,
    async (params) =>
      toMcpResponse(await sendNotification(params as SendNotificationInput)),
  )

  // ========== Application Tools ==========

  server.tool(
    'list_running_apps',
    'Lists all running GUI applications with name, bundle ID, and process ID',
    ListRunningAppsSchema.shape,
    async () => toMcpResponse(await listRunningApps()),
  )

  server.tool(
    'launch_app',
    'Launches an application by name (e.g., "Safari", "Finder")',
    LaunchAppSchema.shape,
    async (params) => toMcpResponse(await launchApp(params)),
  )

  server.tool(
    'quit_app',
    'Gracefully quits an application by name',
    QuitAppSchema.shape,
    async (params) => toMcpResponse(await quitApp(params)),
  )

  server.tool(
    'activate_app',
    'Brings an application to the foreground',
    ActivateAppSchema.shape,
    async (params) => toMcpResponse(await activateApp(params)),
  )

  // ========== Finder Tools ==========

  server.tool(
    'reveal_in_finder',
    'Opens Finder and selects the specified file or folder',
    RevealInFinderSchema.shape,
    async (params) => toMcpResponse(await revealInFinder(params)),
  )

  server.tool(
    'get_selected_files',
    'Gets paths of files currently selected in Finder',
    GetSelectedFilesSchema.shape,
    async () => toMcpResponse(await getSelectedFiles()),
  )

  server.tool(
    'get_finder_window_path',
    'Gets the path of the frontmost Finder window',
    GetFinderWindowPathSchema.shape,
    async () => toMcpResponse(await getFinderWindowPath()),
  )

  // ========== Window Tools ==========

  server.tool(
    'list_windows',
    'Lists all visible windows with app name, title, position, and size. Optional: filter by app name',
    ListWindowsSchema.shape,
    async (params) =>
      toMcpResponse(await listWindows(params as ListWindowsInput)),
  )

  server.tool(
    'focus_window',
    'Brings a specific window to the front by app name and optional window index',
    FocusWindowSchema.shape,
    async (params) =>
      toMcpResponse(await focusWindow(params as WindowReferenceInput)),
  )

  server.tool(
    'move_window',
    'Moves a window to specified x, y coordinates',
    MoveWindowSchema.shape,
    async (params) =>
      toMcpResponse(await moveWindow(params as MoveWindowInput)),
  )

  server.tool(
    'resize_window',
    'Resizes a window to specified width and height',
    ResizeWindowSchema.shape,
    async (params) =>
      toMcpResponse(await resizeWindow(params as ResizeWindowInput)),
  )

  server.tool(
    'minimize_window',
    'Minimizes a window to the Dock',
    MinimizeWindowSchema.shape,
    async (params) =>
      toMcpResponse(await minimizeWindow(params as WindowReferenceInput)),
  )

  // ========== Mouse Tools ==========

  server.tool(
    'click',
    'Performs a mouse click at specified coordinates. Supports left, right, middle buttons and modifier keys',
    ClickSchema.shape,
    async (params) => toMcpResponse(await click(params as ClickInput)),
  )

  server.tool(
    'double_click',
    'Performs a double-click at specified coordinates',
    DoubleClickSchema.shape,
    async (params) => toMcpResponse(await doubleClick(params)),
  )

  server.tool(
    'move_mouse',
    'Moves the mouse cursor to specified coordinates without clicking',
    MoveMouseSchema.shape,
    async (params) => toMcpResponse(await moveMouse(params)),
  )

  server.tool(
    'drag',
    'Performs a drag operation from start to end coordinates',
    DragSchema.shape,
    async (params) => toMcpResponse(await drag(params)),
  )

  // ========== Keyboard Tools ==========

  server.tool(
    'type_text',
    'Types text at the current cursor position with optional delay between characters',
    TypeTextSchema.shape,
    async (params) => toMcpResponse(await typeText(params as TypeTextInput)),
  )

  server.tool(
    'press_key',
    'Presses a key by name (Enter, Tab, Escape, F1-F12, Arrow keys, etc.)',
    PressKeySchema.shape,
    async (params) => toMcpResponse(await pressKey(params)),
  )

  server.tool(
    'key_combination',
    'Presses a key combination with modifiers (e.g., Cmd+C, Cmd+Shift+S)',
    KeyCombinationSchema.shape,
    async (params) => toMcpResponse(await keyCombination(params)),
  )

  // ========== Scroll Tools ==========

  server.tool(
    'scroll',
    'Scrolls in a specified direction (up, down, left, right) at optional coordinates',
    ScrollSchema.shape,
    async (params) => toMcpResponse(await scroll(params as ScrollInput)),
  )

  server.tool(
    'scroll_to_element',
    'Scrolls until a UI element with specified text or role becomes visible',
    ScrollToElementSchema.shape,
    async (params) => toMcpResponse(await scrollToElement(params)),
  )

  // ========== Screenshot Tools ==========

  server.tool(
    'take_screenshot',
    'Captures a screenshot of the screen, display, window, or region. Returns base64-encoded image (auto-resized to max 1920px for API compatibility) or saves to file at full resolution',
    TakeScreenshotSchema.shape,
    async (params) =>
      toMcpResponse(await takeScreenshot(params as ScreenshotInput)),
  )

  // ========== UI Element Tools ==========

  server.tool(
    'get_ui_elements',
    'Retrieves the UI element tree for an application. Use maxDepth to limit tree depth',
    GetUIElementsSchema.shape,
    async (params) => toMcpResponse(await getUIElements(params)),
  )

  server.tool(
    'click_ui_element',
    'Clicks a UI element by path (e.g., "window1/button1")',
    ClickUIElementSchema.shape,
    async (params) => toMcpResponse(await clickUIElement(params)),
  )

  server.tool(
    'get_ui_element_value',
    'Gets the value of a UI element (text field content, checkbox state, etc.)',
    GetUIElementValueSchema.shape,
    async (params) => toMcpResponse(await getUIElementValue(params)),
  )

  server.tool(
    'set_ui_element_value',
    'Sets the value of an editable UI element (text fields, sliders, etc.)',
    SetUIElementValueSchema.shape,
    async (params) => toMcpResponse(await setUIElementValue(params)),
  )

  server.tool(
    'focus_ui_element',
    'Sets keyboard focus to a UI element',
    FocusUIElementSchema.shape,
    async (params) => toMcpResponse(await focusUIElement(params)),
  )

  // ========== Menu Tools ==========

  server.tool(
    'list_menu_items',
    'Gets the menu hierarchy for an application',
    ListMenuItemsSchema.shape,
    async (params) => toMcpResponse(await listMenuItems(params)),
  )

  server.tool(
    'click_menu_item',
    'Clicks a menu item by path (e.g., "File > Save", "Edit > Copy")',
    ClickMenuItemSchema.shape,
    async (params) => toMcpResponse(await clickMenuItem(params)),
  )

  server.tool(
    'get_menu_item_state',
    'Gets the enabled/checked state of a menu item',
    GetMenuItemStateSchema.shape,
    async (params) => toMcpResponse(await getMenuItemState(params)),
  )

  server.tool(
    'list_status_bar_items',
    'Lists visible status bar (menu bar extras) items',
    ListStatusBarItemsSchema.shape,
    async () => toMcpResponse(await listStatusBarItems()),
  )

  server.tool(
    'click_status_bar_item',
    'Clicks a status bar item to open its menu',
    ClickStatusBarItemSchema.shape,
    async (params) => toMcpResponse(await clickStatusBarItem(params)),
  )

  server.tool(
    'click_status_bar_menu_item',
    'Clicks a menu item within a status bar menu',
    ClickStatusBarMenuItemSchema.shape,
    async (params) => toMcpResponse(await clickStatusBarMenuItem(params)),
  )

  server.tool(
    'get_menu_bar_structure',
    'Gets the complete menu bar hierarchy for a process by PID',
    GetMenuBarStructureSchema.shape,
    async (params) => toMcpResponse(await getMenuBarStructure(params)),
  )
}
