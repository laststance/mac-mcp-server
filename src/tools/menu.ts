/**
 * Menu Bar and Status Item Tools
 *
 * Tools for interacting with application menus and status bar items via macOS Accessibility APIs.
 * Provides menu hierarchy retrieval, menu item clicking, state inspection, and status bar interaction.
 *
 * @module menu
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11
 */

import { z } from 'zod'

import { executeAppleScript } from '../lib/executor.js'
import { checkAccessibility } from '../lib/permission.js'
import { sanitizeIdentifier, sanitizeString } from '../lib/sanitizer.js'

// ============================================================================
// Constants
// ============================================================================

/**
 * Default timeout for menu operations in milliseconds.
 */
const MENU_TIMEOUT = 15000

/**
 * Time to wait for lazy-loaded menu items to populate (milliseconds).
 */
const MENU_LOAD_DELAY = 0.3

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Represents a menu item in the menu hierarchy.
 */
export interface MenuItem {
  /** Menu item name */
  name: string
  /** Keyboard shortcut (e.g., "⌘C") */
  shortcut?: string
  /** Whether the menu item is enabled */
  enabled: boolean
  /** Whether the menu item is checked (for checkable items) */
  checked: boolean
  /** Whether the menu item has a submenu */
  hasSubmenu: boolean
  /** Child menu items (if hasSubmenu is true) */
  children?: MenuItem[]
}

/**
 * Result of list_menu_items operation.
 */
export interface ListMenuItemsResult {
  success: boolean
  items?: MenuItem[]
  error?: string
}

/**
 * Result of click_menu_item operation.
 */
export interface ClickMenuItemResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Result of get_menu_item_state operation.
 */
export interface GetMenuItemStateResult {
  success: boolean
  enabled?: boolean
  checked?: boolean
  hasSubmenu?: boolean
  error?: string
}

/**
 * Represents a status bar item.
 */
export interface StatusBarItem {
  /** Item description or title */
  description: string
  /** Position in the status bar (from right) */
  position: number
  /** Associated process name */
  processName: string
}

/**
 * Result of list_status_bar_items operation.
 */
export interface ListStatusBarItemsResult {
  success: boolean
  items?: StatusBarItem[]
  error?: string
}

/**
 * Result of click_status_bar_item operation.
 */
export interface ClickStatusBarItemResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Result of click_status_bar_menu_item operation.
 */
export interface ClickStatusBarMenuItemResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Result of get_menu_bar_structure operation.
 */
export interface GetMenuBarStructureResult {
  success: boolean
  menus?: MenuItem[]
  processName?: string
  error?: string
}

/**
 * Input for list_menu_items tool.
 */
export interface ListMenuItemsInput {
  appName: string
}

/**
 * Input for click_menu_item tool.
 */
export interface ClickMenuItemInput {
  appName: string
  menuPath: string
}

/**
 * Input for get_menu_item_state tool.
 */
export interface GetMenuItemStateInput {
  appName: string
  menuPath: string
}

/**
 * Input for click_status_bar_item tool.
 */
export interface ClickStatusBarItemInput {
  identifier: string
}

/**
 * Input for click_status_bar_menu_item tool.
 */
export interface ClickStatusBarMenuItemInput {
  identifier: string
  menuPath: string
}

/**
 * Input for get_menu_bar_structure tool.
 */
export interface GetMenuBarStructureInput {
  processName: string
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for list_menu_items tool.
 */
export const ListMenuItemsSchema = z.object({
  appName: z.string().describe('Application name to get menu hierarchy from'),
})

/**
 * Schema for click_menu_item tool.
 */
export const ClickMenuItemSchema = z.object({
  appName: z.string().describe('Application name'),
  menuPath: z.string().describe('Menu path (e.g., "File > Save As...")'),
})

/**
 * Schema for get_menu_item_state tool.
 */
export const GetMenuItemStateSchema = z.object({
  appName: z.string().describe('Application name'),
  menuPath: z.string().describe('Menu path'),
})

/**
 * Schema for list_status_bar_items tool.
 */
export const ListStatusBarItemsSchema = z.object({})

/**
 * Schema for click_status_bar_item tool.
 */
export const ClickStatusBarItemSchema = z.object({
  identifier: z.string().describe('Status item description or process name'),
})

/**
 * Schema for click_status_bar_menu_item tool.
 */
export const ClickStatusBarMenuItemSchema = z.object({
  identifier: z.string().describe('Status item identifier'),
  menuPath: z.string().describe('Menu item path'),
})

/**
 * Schema for get_menu_bar_structure tool.
 */
export const GetMenuBarStructureSchema = z.object({
  processName: z.string().describe('Process name'),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parses a menu path string into array of menu names.
 *
 * @param menuPath - Menu path like "File > Save As..."
 * @returns Array of menu names
 */
function parseMenuPath(menuPath: string): string[] {
  return menuPath
    .split('>')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Retrieves the complete menu hierarchy for the specified application.
 *
 * Returns menu names, item names, keyboard shortcuts, and item states.
 *
 * @param input - Input containing application name
 * @returns Result with menu item hierarchy or error
 *
 * @example
 * const result = await listMenuItems({ appName: 'Finder' })
 * if (result.success) {
 *   console.log(result.items) // Array of MenuItem
 * }
 *
 * Requirements: 17.1, 17.2
 */
export async function listMenuItems(
  input: ListMenuItemsInput,
): Promise<ListMenuItemsResult> {
  const { appName } = input

  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  // Sanitize inputs
  let sanitizedAppName: string
  try {
    sanitizedAppName = sanitizeIdentifier(appName)
  } catch (error) {
    return {
      success: false,
      error: `Invalid application name: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }

  const script = `
    tell application "System Events"
      tell process "${sanitizedAppName}"
        try
          if not (exists) then
            return "error: Application '${sanitizedAppName}' is not running"
          end if

          -- Get menu bar
          set menuBar to menu bar 1

          set resultJson to "["
          set menuBarItems to menu bar items of menuBar
          set itemIndex to 1

          repeat with menuBarItem in menuBarItems
            try
              if itemIndex > 1 then
                set resultJson to resultJson & ","
              end if

              set itemName to name of menuBarItem
              set resultJson to resultJson & "{"
              set resultJson to resultJson & quote & "name" & quote & ":" & quote & itemName & quote & ","
              set resultJson to resultJson & quote & "enabled" & quote & ":true,"
              set resultJson to resultJson & quote & "checked" & quote & ":false,"
              set resultJson to resultJson & quote & "hasSubmenu" & quote & ":true"

              -- Get submenu items (first level only for performance)
              try
                set subMenuItems to menu items of menu 1 of menuBarItem
                if (count of subMenuItems) > 0 then
                  set resultJson to resultJson & "," & quote & "children" & quote & ":["
                  set subIndex to 1
                  repeat with subItem in subMenuItems
                    try
                      if subIndex > 1 then
                        set resultJson to resultJson & ","
                      end if

                      set subName to name of subItem
                      set subEnabled to enabled of subItem
                      set subChecked to false
                      try
                        set subChecked to (value of attribute "AXMenuItemMarkChar" of subItem) is not missing value
                      end try
                      set subHasSubmenu to false
                      try
                        set subHasSubmenu to (count of menus of subItem) > 0
                      end try

                      set resultJson to resultJson & "{"
                      set resultJson to resultJson & quote & "name" & quote & ":" & quote & subName & quote & ","
                      set resultJson to resultJson & quote & "enabled" & quote & ":" & (subEnabled as text) & ","
                      set resultJson to resultJson & quote & "checked" & quote & ":" & (subChecked as text) & ","
                      set resultJson to resultJson & quote & "hasSubmenu" & quote & ":" & (subHasSubmenu as text)

                      -- Get keyboard shortcut if available
                      try
                        set shortcut to value of attribute "AXMenuItemCmdChar" of subItem
                        if shortcut is not missing value and shortcut is not "" then
                          set modifiers to value of attribute "AXMenuItemCmdModifiers" of subItem
                          set shortcutStr to ""
                          if modifiers is not missing value then
                            -- Build modifier string (this is simplified)
                            set shortcutStr to "⌘" & shortcut
                          else
                            set shortcutStr to shortcut
                          end if
                          set resultJson to resultJson & "," & quote & "shortcut" & quote & ":" & quote & shortcutStr & quote
                        end if
                      end try

                      set resultJson to resultJson & "}"
                      set subIndex to subIndex + 1

                      -- Limit items
                      if subIndex > 30 then exit repeat
                    end try
                  end repeat
                  set resultJson to resultJson & "]"
                end if
              end try

              set resultJson to resultJson & "}"
              set itemIndex to itemIndex + 1

              -- Limit menu bar items
              if itemIndex > 15 then exit repeat
            end try
          end repeat

          set resultJson to resultJson & "]"
          return resultJson
        on error errMsg
          return "error: " & errMsg
        end try
      end tell
    end tell
  `

  const result = await executeAppleScript({ script, timeout: MENU_TIMEOUT })

  if (result.success && result.output) {
    const output = result.output.toString()

    if (output.startsWith('error:')) {
      return {
        success: false,
        error: output.substring(7).trim(),
      }
    }

    try {
      const items = JSON.parse(output)
      return {
        success: true,
        items,
      }
    } catch {
      return {
        success: false,
        error: `Failed to parse menu items: ${output.substring(0, 100)}`,
      }
    }
  }

  return {
    success: false,
    error: result.error || 'Failed to get menu items',
  }
}

/**
 * Clicks the specified menu item.
 *
 * @param input - Input containing application name and menu path
 * @returns Result indicating success or failure
 *
 * @example
 * const result = await clickMenuItem({
 *   appName: 'Finder',
 *   menuPath: 'File > New Finder Window'
 * })
 *
 * Requirements: 17.2, 17.4
 */
export async function clickMenuItem(
  input: ClickMenuItemInput,
): Promise<ClickMenuItemResult> {
  const { appName, menuPath } = input

  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  // Sanitize inputs
  let sanitizedAppName: string
  let sanitizedPath: string
  try {
    sanitizedAppName = sanitizeIdentifier(appName)
    sanitizedPath = sanitizeString(menuPath)
  } catch (error) {
    return {
      success: false,
      error: `Invalid input: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }

  // Validate menu path
  if (!sanitizedPath || sanitizedPath.trim() === '') {
    return {
      success: false,
      error: 'Menu path cannot be empty',
    }
  }

  // Parse menu path
  const pathParts = parseMenuPath(sanitizedPath)
  if (pathParts.length < 2) {
    return {
      success: false,
      error:
        'Menu path must include at least menu name and item name (e.g., "File > New")',
    }
  }

  const menuName = pathParts[0]!.replace(/"/g, '\\"')
  const itemPath = pathParts.slice(1)

  // Build the click command - itemPath has at least 1 element since pathParts.length >= 2
  const lastItem = itemPath[itemPath.length - 1]!
  const clickCommand = `click menu item "${lastItem.replace(/"/g, '\\"')}"`

  // Build the menu navigation path
  let menuNav = `of menu 1 of menu bar item "${menuName}" of menu bar 1`
  for (let i = 0; i < itemPath.length - 1; i++) {
    const item = itemPath[i]!
    menuNav = `of menu 1 of menu item "${item.replace(/"/g, '\\"')}" ${menuNav}`
  }

  const script = `
    tell application "System Events"
      tell process "${sanitizedAppName}"
        try
          if not (exists) then
            return "error: Application '${sanitizedAppName}' is not running"
          end if

          -- Bring app to front
          set frontmost to true
          delay 0.1

          -- Click the menu item
          ${clickCommand} ${menuNav}

          return "success: Clicked menu item '${sanitizedPath}'"
        on error errMsg
          return "error: Menu item not found at path '${sanitizedPath}': " & errMsg
        end try
      end tell
    end tell
  `

  const result = await executeAppleScript({ script, timeout: MENU_TIMEOUT })

  if (result.success && result.output) {
    const output = result.output.toString()

    if (output.startsWith('success:')) {
      return {
        success: true,
        message: output.substring(9).trim(),
      }
    } else if (output.startsWith('error:')) {
      return {
        success: false,
        error: output.substring(7).trim(),
      }
    }
  }

  return {
    success: false,
    error: result.error || 'Failed to click menu item',
  }
}

/**
 * Gets the state of the specified menu item.
 *
 * @param input - Input containing application name and menu path
 * @returns Result with menu item state (enabled, checked, hasSubmenu)
 *
 * @example
 * const result = await getMenuItemState({
 *   appName: 'Finder',
 *   menuPath: 'View > Show Path Bar'
 * })
 *
 * Requirements: 17.3
 */
export async function getMenuItemState(
  input: GetMenuItemStateInput,
): Promise<GetMenuItemStateResult> {
  const { appName, menuPath } = input

  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  // Sanitize inputs
  let sanitizedAppName: string
  let sanitizedPath: string
  try {
    sanitizedAppName = sanitizeIdentifier(appName)
    sanitizedPath = sanitizeString(menuPath)
  } catch (error) {
    return {
      success: false,
      error: `Invalid input: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }

  // Parse menu path
  const pathParts = parseMenuPath(sanitizedPath)
  if (pathParts.length < 2) {
    return {
      success: false,
      error: 'Menu path must include at least menu name and item name',
    }
  }

  const menuName = pathParts[0]!.replace(/"/g, '\\"')
  const itemPath = pathParts.slice(1)

  // Build reference to the menu item - itemPath has at least 1 element since pathParts.length >= 2
  const lastItem = itemPath[itemPath.length - 1]!
  const itemRef = `menu item "${lastItem.replace(/"/g, '\\"')}"`
  let menuNav = `of menu 1 of menu bar item "${menuName}" of menu bar 1`
  for (let i = 0; i < itemPath.length - 1; i++) {
    const item = itemPath[i]!
    menuNav = `of menu 1 of menu item "${item.replace(/"/g, '\\"')}" ${menuNav}`
  }

  const script = `
    tell application "System Events"
      tell process "${sanitizedAppName}"
        try
          if not (exists) then
            return "error: Application '${sanitizedAppName}' is not running"
          end if

          set targetItem to ${itemRef} ${menuNav}

          set itemEnabled to enabled of targetItem
          set itemChecked to false
          try
            set markChar to value of attribute "AXMenuItemMarkChar" of targetItem
            if markChar is not missing value and markChar is not "" then
              set itemChecked to true
            end if
          end try
          set itemHasSubmenu to false
          try
            set itemHasSubmenu to (count of menus of targetItem) > 0
          end try

          return "state:" & (itemEnabled as text) & ":" & (itemChecked as text) & ":" & (itemHasSubmenu as text)
        on error errMsg
          return "error: Menu item not found at path '${sanitizedPath}': " & errMsg
        end try
      end tell
    end tell
  `

  const result = await executeAppleScript({ script, timeout: MENU_TIMEOUT })

  if (result.success && result.output) {
    const output = result.output.toString()

    if (output.startsWith('state:')) {
      const parts = output.substring(6).split(':')
      return {
        success: true,
        enabled: parts[0] === 'true',
        checked: parts[1] === 'true',
        hasSubmenu: parts[2] === 'true',
      }
    } else if (output.startsWith('error:')) {
      return {
        success: false,
        error: output.substring(7).trim(),
      }
    }
  }

  return {
    success: false,
    error: result.error || 'Failed to get menu item state',
  }
}

/**
 * Lists all visible status bar items.
 *
 * @returns Result with array of status bar items
 *
 * @example
 * const result = await listStatusBarItems()
 * if (result.success) {
 *   console.log(result.items) // Array of StatusBarItem
 * }
 *
 * Requirements: 17.5
 */
export async function listStatusBarItems(): Promise<ListStatusBarItemsResult> {
  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  const script = `
    tell application "System Events"
      try
        set resultJson to "["
        set itemIndex to 1

        -- Get status bar items from SystemUIServer
        tell process "SystemUIServer"
          set menuBar to menu bar 1
          set menuBarItems to menu bar items of menuBar

          repeat with menuBarItem in menuBarItems
            try
              if itemIndex > 1 then
                set resultJson to resultJson & ","
              end if

              set itemDesc to description of menuBarItem
              if itemDesc is missing value or itemDesc is "" then
                set itemDesc to "Unknown"
              end if

              set resultJson to resultJson & "{"
              set resultJson to resultJson & quote & "description" & quote & ":" & quote & itemDesc & quote & ","
              set resultJson to resultJson & quote & "position" & quote & ":" & itemIndex & ","
              set resultJson to resultJson & quote & "processName" & quote & ":" & quote & "SystemUIServer" & quote
              set resultJson to resultJson & "}"

              set itemIndex to itemIndex + 1

              if itemIndex > 30 then exit repeat
            end try
          end repeat
        end tell

        -- Also check Control Center items
        try
          tell process "ControlCenter"
            set ccMenuBar to menu bar 1
            set ccItems to menu bar items of ccMenuBar

            repeat with ccItem in ccItems
              try
                if itemIndex > 1 then
                  set resultJson to resultJson & ","
                end if

                set itemDesc to description of ccItem
                if itemDesc is missing value or itemDesc is "" then
                  set itemDesc to "Control Center"
                end if

                set resultJson to resultJson & "{"
                set resultJson to resultJson & quote & "description" & quote & ":" & quote & itemDesc & quote & ","
                set resultJson to resultJson & quote & "position" & quote & ":" & itemIndex & ","
                set resultJson to resultJson & quote & "processName" & quote & ":" & quote & "ControlCenter" & quote
                set resultJson to resultJson & "}"

                set itemIndex to itemIndex + 1

                if itemIndex > 40 then exit repeat
              end try
            end repeat
          end tell
        end try

        set resultJson to resultJson & "]"
        return resultJson
      on error errMsg
        return "error: " & errMsg
      end try
    end tell
  `

  const result = await executeAppleScript({ script, timeout: MENU_TIMEOUT })

  if (result.success && result.output) {
    const output = result.output.toString()

    if (output.startsWith('error:')) {
      return {
        success: false,
        error: output.substring(7).trim(),
      }
    }

    try {
      const items = JSON.parse(output)
      return {
        success: true,
        items,
      }
    } catch {
      return {
        success: false,
        error: `Failed to parse status bar items: ${output.substring(0, 100)}`,
      }
    }
  }

  return {
    success: false,
    error: result.error || 'Failed to list status bar items',
  }
}

/**
 * Clicks a status bar item to open its menu.
 *
 * @param input - Input containing status item identifier
 * @returns Result indicating success or failure
 *
 * @example
 * const result = await clickStatusBarItem({ identifier: 'Bluetooth' })
 *
 * Requirements: 17.6
 */
export async function clickStatusBarItem(
  input: ClickStatusBarItemInput,
): Promise<ClickStatusBarItemResult> {
  const { identifier } = input

  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  // Sanitize inputs
  let sanitizedId: string
  try {
    sanitizedId = sanitizeString(identifier)
  } catch (error) {
    return {
      success: false,
      error: `Invalid identifier: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }

  const script = `
    tell application "System Events"
      try
        -- Try SystemUIServer first
        tell process "SystemUIServer"
          set menuBar to menu bar 1
          set menuBarItems to menu bar items of menuBar

          repeat with menuBarItem in menuBarItems
            try
              set itemDesc to description of menuBarItem
              if itemDesc contains "${sanitizedId}" then
                click menuBarItem
                delay ${MENU_LOAD_DELAY}
                return "success: Clicked status bar item '${sanitizedId}'"
              end if
            end try
          end repeat
        end tell

        -- Try ControlCenter
        try
          tell process "ControlCenter"
            set ccMenuBar to menu bar 1
            set ccItems to menu bar items of ccMenuBar

            repeat with ccItem in ccItems
              try
                set itemDesc to description of ccItem
                if itemDesc contains "${sanitizedId}" then
                  click ccItem
                  delay ${MENU_LOAD_DELAY}
                  return "success: Clicked status bar item '${sanitizedId}'"
                end if
              end try
            end repeat
          end tell
        end try

        return "error: Status bar item '${sanitizedId}' not found"
      on error errMsg
        return "error: " & errMsg
      end try
    end tell
  `

  const result = await executeAppleScript({ script, timeout: MENU_TIMEOUT })

  if (result.success && result.output) {
    const output = result.output.toString()

    if (output.startsWith('success:')) {
      return {
        success: true,
        message: output.substring(9).trim(),
      }
    } else if (output.startsWith('error:')) {
      return {
        success: false,
        error: output.substring(7).trim(),
      }
    }
  }

  return {
    success: false,
    error: result.error || 'Failed to click status bar item',
  }
}

/**
 * Clicks a menu item within a status bar item's menu.
 *
 * Opens the status bar menu and clicks the specified item.
 *
 * @param input - Input containing status item identifier and menu path
 * @returns Result indicating success or failure
 *
 * @example
 * const result = await clickStatusBarMenuItem({
 *   identifier: 'Wi-Fi',
 *   menuPath: 'Turn Wi-Fi Off'
 * })
 *
 * Requirements: 17.7, 17.8, 17.11
 */
export async function clickStatusBarMenuItem(
  input: ClickStatusBarMenuItemInput,
): Promise<ClickStatusBarMenuItemResult> {
  const { identifier, menuPath } = input

  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  // Sanitize inputs
  let sanitizedId: string
  let sanitizedMenuPath: string
  try {
    sanitizedId = sanitizeString(identifier)
    sanitizedMenuPath = sanitizeString(menuPath)
  } catch (error) {
    return {
      success: false,
      error: `Invalid input: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }

  const script = `
    tell application "System Events"
      try
        set foundItem to false

        -- Try SystemUIServer first
        tell process "SystemUIServer"
          set menuBar to menu bar 1
          set menuBarItems to menu bar items of menuBar

          repeat with menuBarItem in menuBarItems
            try
              set itemDesc to description of menuBarItem
              if itemDesc contains "${sanitizedId}" then
                click menuBarItem
                delay ${MENU_LOAD_DELAY}

                -- Wait for menu to load (handles lazy-loading)
                set maxWait to 5
                set waitCount to 0
                repeat while waitCount < maxWait
                  try
                    set menuItems to menu items of menu 1 of menuBarItem
                    if (count of menuItems) > 0 then
                      exit repeat
                    end if
                  end try
                  delay 0.2
                  set waitCount to waitCount + 1
                end repeat

                -- Click the menu item
                click menu item "${sanitizedMenuPath}" of menu 1 of menuBarItem
                set foundItem to true
                return "success: Clicked menu item '${sanitizedMenuPath}' in status bar item '${sanitizedId}'"
              end if
            end try
          end repeat
        end tell

        if not foundItem then
          -- Try ControlCenter
          try
            tell process "ControlCenter"
              set ccMenuBar to menu bar 1
              set ccItems to menu bar items of ccMenuBar

              repeat with ccItem in ccItems
                try
                  set itemDesc to description of ccItem
                  if itemDesc contains "${sanitizedId}" then
                    click ccItem
                    delay ${MENU_LOAD_DELAY}

                    click menu item "${sanitizedMenuPath}" of menu 1 of ccItem
                    return "success: Clicked menu item '${sanitizedMenuPath}' in status bar item '${sanitizedId}'"
                  end if
                end try
              end repeat
            end tell
          end try
        end if

        return "error: Status bar item '${sanitizedId}' not found or menu item '${sanitizedMenuPath}' not found"
      on error errMsg
        return "error: " & errMsg
      end try
    end tell
  `

  const result = await executeAppleScript({ script, timeout: MENU_TIMEOUT })

  if (result.success && result.output) {
    const output = result.output.toString()

    if (output.startsWith('success:')) {
      return {
        success: true,
        message: output.substring(9).trim(),
      }
    } else if (output.startsWith('error:')) {
      return {
        success: false,
        error: output.substring(7).trim(),
      }
    }
  }

  return {
    success: false,
    error: result.error || 'Failed to click status bar menu item',
  }
}

/**
 * Gets the complete menu bar hierarchy for a process.
 *
 * @param input - Input containing process name
 * @returns Result with complete menu hierarchy
 *
 * @example
 * const result = await getMenuBarStructure({ processName: 'Finder' })
 *
 * Requirements: 17.9, 17.10
 */
export async function getMenuBarStructure(
  input: GetMenuBarStructureInput,
): Promise<GetMenuBarStructureResult> {
  const { processName } = input

  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  // Sanitize inputs
  let sanitizedProcess: string
  try {
    sanitizedProcess = sanitizeIdentifier(processName)
  } catch (error) {
    return {
      success: false,
      error: `Invalid process name: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }

  const script = `
    tell application "System Events"
      tell process "${sanitizedProcess}"
        try
          if not (exists) then
            return "error: Process '${sanitizedProcess}' is not running"
          end if

          set menuBar to menu bar 1
          set resultJson to "["
          set menuBarItems to menu bar items of menuBar
          set itemIndex to 1

          repeat with menuBarItem in menuBarItems
            try
              if itemIndex > 1 then
                set resultJson to resultJson & ","
              end if

              set itemName to name of menuBarItem
              set itemEnabled to true
              try
                set itemEnabled to enabled of menuBarItem
              end try

              set resultJson to resultJson & "{"
              set resultJson to resultJson & quote & "name" & quote & ":" & quote & itemName & quote & ","
              set resultJson to resultJson & quote & "enabled" & quote & ":" & (itemEnabled as text) & ","
              set resultJson to resultJson & quote & "checked" & quote & ":false,"
              set resultJson to resultJson & quote & "hasSubmenu" & quote & ":true"

              -- Get submenu structure
              try
                set subMenu to menu 1 of menuBarItem
                set subItems to menu items of subMenu

                if (count of subItems) > 0 then
                  set resultJson to resultJson & "," & quote & "children" & quote & ":["
                  set subIndex to 1

                  repeat with subItem in subItems
                    try
                      if subIndex > 1 then
                        set resultJson to resultJson & ","
                      end if

                      set subName to name of subItem
                      set subEnabled to enabled of subItem
                      set subChecked to false
                      try
                        set markChar to value of attribute "AXMenuItemMarkChar" of subItem
                        if markChar is not missing value and markChar is not "" then
                          set subChecked to true
                        end if
                      end try
                      set subHasSubmenu to false
                      try
                        set subHasSubmenu to (count of menus of subItem) > 0
                      end try

                      set resultJson to resultJson & "{"
                      set resultJson to resultJson & quote & "name" & quote & ":" & quote & subName & quote & ","
                      set resultJson to resultJson & quote & "enabled" & quote & ":" & (subEnabled as text) & ","
                      set resultJson to resultJson & quote & "checked" & quote & ":" & (subChecked as text) & ","
                      set resultJson to resultJson & quote & "hasSubmenu" & quote & ":" & (subHasSubmenu as text)
                      set resultJson to resultJson & "}"

                      set subIndex to subIndex + 1
                      if subIndex > 50 then exit repeat
                    end try
                  end repeat

                  set resultJson to resultJson & "]"
                end if
              end try

              set resultJson to resultJson & "}"
              set itemIndex to itemIndex + 1
              if itemIndex > 20 then exit repeat
            end try
          end repeat

          set resultJson to resultJson & "]"
          return "result:" & resultJson
        on error errMsg
          return "error: " & errMsg
        end try
      end tell
    end tell
  `

  const result = await executeAppleScript({ script, timeout: MENU_TIMEOUT })

  if (result.success && result.output) {
    const output = result.output.toString()

    if (output.startsWith('result:')) {
      try {
        const menus = JSON.parse(output.substring(7))
        return {
          success: true,
          menus,
          processName: sanitizedProcess,
        }
      } catch {
        return {
          success: false,
          error: `Failed to parse menu structure: ${output.substring(0, 100)}`,
        }
      }
    } else if (output.startsWith('error:')) {
      return {
        success: false,
        error: output.substring(7).trim(),
      }
    }
  }

  return {
    success: false,
    error: result.error || 'Failed to get menu bar structure',
  }
}
