/**
 * Window Management Tools
 *
 * Tools for controlling macOS windows: listing, focusing, moving, resizing, and minimizing.
 * Uses AppleScript via System Events for window manipulation.
 *
 * @module window
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { z } from 'zod'

import { executeAppleScript } from '../lib/executor.js'
import { sanitizeIdentifier } from '../lib/sanitizer.js'

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Information about a single window.
 */
export interface WindowInfo {
  /** Window title/name */
  title: string
  /** Name of the application that owns this window */
  appName: string
  /** 1-based index of this window within its application */
  index: number
  /** Window position on screen */
  position: { x: number; y: number }
  /** Window dimensions */
  size: { width: number; height: number }
}

/**
 * Result of listing windows.
 */
export interface ListWindowsResult {
  success: boolean
  data?: WindowInfo[]
  error?: string
}

/**
 * Result of window actions (focus, move, resize, minimize).
 */
export interface WindowActionResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Input for filtering windows by app name.
 */
export interface ListWindowsInput {
  appName?: string
}

/**
 * Input for window reference (used by action tools).
 */
export interface WindowReferenceInput {
  appName: string
  windowIndex?: number
  windowTitle?: string
}

/**
 * Input for moving a window.
 */
export interface MoveWindowInput extends WindowReferenceInput {
  x: number
  y: number
}

/**
 * Input for resizing a window.
 */
export interface ResizeWindowInput extends WindowReferenceInput {
  width: number
  height: number
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for list_windows tool.
 * @param appName - Optional filter by application name
 */
export const ListWindowsSchema = z.object({
  appName: z.string().optional().describe('Filter windows by application name'),
})

/**
 * Schema for focus_window tool.
 * @param appName - Application name (required)
 * @param windowIndex - 1-based window index (optional, defaults to 1)
 * @param windowTitle - Window title to focus (alternative to index)
 */
export const FocusWindowSchema = z.object({
  appName: z.string().describe('Application name'),
  windowIndex: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('1-based window index'),
  windowTitle: z.string().optional().describe('Window title to focus'),
})

/**
 * Schema for move_window tool.
 * @param appName - Application name (required)
 * @param windowIndex - 1-based window index (optional)
 * @param windowTitle - Window title (alternative to index)
 * @param x - New X coordinate
 * @param y - New Y coordinate
 */
export const MoveWindowSchema = z.object({
  appName: z.string().describe('Application name'),
  windowIndex: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('1-based window index'),
  windowTitle: z.string().optional().describe('Window title'),
  x: z.number().describe('New X coordinate'),
  y: z.number().describe('New Y coordinate'),
})

/**
 * Schema for resize_window tool.
 * @param appName - Application name (required)
 * @param windowIndex - 1-based window index (optional)
 * @param windowTitle - Window title (alternative to index)
 * @param width - New width (must be positive)
 * @param height - New height (must be positive)
 */
export const ResizeWindowSchema = z.object({
  appName: z.string().describe('Application name'),
  windowIndex: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('1-based window index'),
  windowTitle: z.string().optional().describe('Window title'),
  width: z.number().positive().describe('New width in pixels'),
  height: z.number().positive().describe('New height in pixels'),
})

/**
 * Schema for minimize_window tool.
 * @param appName - Application name (required)
 * @param windowIndex - 1-based window index (optional)
 * @param windowTitle - Window title (alternative to index)
 */
export const MinimizeWindowSchema = z.object({
  appName: z.string().describe('Application name'),
  windowIndex: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('1-based window index'),
  windowTitle: z.string().optional().describe('Window title'),
})

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Lists all visible windows, optionally filtered by application name.
 *
 * @param input - Filter options
 * @returns
 * - On success: { success: true, data: WindowInfo[] }
 * - On failure: { success: false, error: string }
 *
 * @example
 * // List all windows
 * await listWindows({})
 *
 * @example
 * // List only Finder windows
 * await listWindows({ appName: 'Finder' })
 *
 * Requirements: 4.1, 4.2
 */
export async function listWindows(
  input: ListWindowsInput,
): Promise<ListWindowsResult> {
  const appFilter = input.appName
    ? sanitizeIdentifier(input.appName)
    : undefined

  // Build AppleScript to get window info
  // Uses pipe-delimited output for robustness
  const script = `
    tell application "System Events"
      set windowList to ""
      set allProcs to every process whose visible is true

      repeat with proc in allProcs
        try
          set procName to name of proc
          ${appFilter ? `if procName is not "${appFilter}" then` : ''}
          ${appFilter ? '-- skip non-matching apps' : ''}
          ${appFilter ? 'else' : ''}

          set winIndex to 1
          repeat with win in (windows of proc)
            try
              set winTitle to name of win
              if winTitle is missing value then set winTitle to ""

              set winPos to position of win
              set winSize to size of win

              set posX to item 1 of winPos
              set posY to item 2 of winPos
              set sizeW to item 1 of winSize
              set sizeH to item 2 of winSize

              -- Format: appName|index|title|posX|posY|width|height
              set winRecord to procName & "|||" & winIndex & "|||" & winTitle & "|||" & posX & "|||" & posY & "|||" & sizeW & "|||" & sizeH

              if windowList is "" then
                set windowList to winRecord
              else
                set windowList to windowList & "~~~" & winRecord
              end if

              set winIndex to winIndex + 1
            end try
          end repeat

          ${appFilter ? 'end if' : ''}
        end try
      end repeat

      return windowList
    end tell
  `

  const result = await executeAppleScript({ script, timeout: 15000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to list windows',
    }
  }

  const output = result.output ?? ''

  // Handle empty list
  if (output === '') {
    return {
      success: true,
      data: [],
    }
  }

  // Parse the pipe-delimited output
  const windows: WindowInfo[] = []
  const records = output.split('~~~')

  for (const record of records) {
    const parts = record.split('|||')
    if (parts.length >= 7) {
      const appName = parts[0] ?? ''
      const index = parseInt(parts[1] ?? '1', 10)
      const title = parts[2] ?? ''
      const posX = parseInt(parts[3] ?? '0', 10)
      const posY = parseInt(parts[4] ?? '0', 10)
      const width = parseInt(parts[5] ?? '0', 10)
      const height = parseInt(parts[6] ?? '0', 10)

      if (appName) {
        windows.push({
          title,
          appName,
          index,
          position: { x: posX, y: posY },
          size: { width, height },
        })
      }
    }
  }

  return {
    success: true,
    data: windows,
  }
}

/**
 * Brings a window to the front (focuses it).
 *
 * @param input - Window reference
 * @returns
 * - On success: { success: true, message: string }
 * - On failure: { success: false, error: string }
 *
 * @example
 * // Focus first Finder window
 * await focusWindow({ appName: 'Finder' })
 *
 * @example
 * // Focus specific window by index
 * await focusWindow({ appName: 'Finder', windowIndex: 2 })
 *
 * Requirements: 4.3
 */
export async function focusWindow(
  input: WindowReferenceInput,
): Promise<WindowActionResult> {
  const appName = sanitizeIdentifier(input.appName)
  const windowIndex = input.windowIndex ?? 1
  const windowTitle = input.windowTitle
    ? sanitizeIdentifier(input.windowTitle)
    : undefined

  // First check if app exists and is running
  const checkScript = `
    tell application "System Events"
      set procExists to exists (process "${appName}")
      return procExists
    end tell
  `

  const checkResult = await executeAppleScript({ script: checkScript })
  if (!checkResult.success || checkResult.output !== 'true') {
    return {
      success: false,
      error: `Application not found or not running: ${input.appName}`,
    }
  }

  // Build window reference
  let windowRef: string
  if (windowTitle) {
    windowRef = `window "${windowTitle}"`
  } else {
    windowRef = `window ${windowIndex}`
  }

  const script = `
    tell application "System Events"
      tell process "${appName}"
        try
          set frontmost to true
        end try
        try
          perform action "AXRaise" of ${windowRef}
          return "success"
        on error errMsg
          return "error: " & errMsg
        end try
      end tell
    end tell
  `

  const result = await executeAppleScript({ script, timeout: 10000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? `Failed to focus window of ${input.appName}`,
    }
  }

  const output = result.output ?? ''
  if (output.startsWith('error:')) {
    return {
      success: false,
      error: `Window not found: ${windowTitle ?? `index ${windowIndex}`} in ${input.appName}`,
    }
  }

  return {
    success: true,
    message: `Focused window ${windowTitle ?? windowIndex} of ${input.appName}`,
  }
}

/**
 * Moves a window to specified coordinates.
 *
 * @param input - Window reference and new position
 * @returns
 * - On success: { success: true, message: string }
 * - On failure: { success: false, error: string }
 *
 * @example
 * // Move Finder window to position (100, 100)
 * await moveWindow({ appName: 'Finder', x: 100, y: 100 })
 *
 * Requirements: 4.4
 */
export async function moveWindow(
  input: MoveWindowInput,
): Promise<WindowActionResult> {
  const appName = sanitizeIdentifier(input.appName)
  const windowIndex = input.windowIndex ?? 1
  const windowTitle = input.windowTitle
    ? sanitizeIdentifier(input.windowTitle)
    : undefined
  const { x, y } = input

  // First check if app exists
  const checkScript = `
    tell application "System Events"
      set procExists to exists (process "${appName}")
      return procExists
    end tell
  `

  const checkResult = await executeAppleScript({ script: checkScript })
  if (!checkResult.success || checkResult.output !== 'true') {
    return {
      success: false,
      error: `Application not found or not running: ${input.appName}`,
    }
  }

  // Build window reference
  let windowRef: string
  if (windowTitle) {
    windowRef = `window "${windowTitle}"`
  } else {
    windowRef = `window ${windowIndex}`
  }

  const script = `
    tell application "System Events"
      tell process "${appName}"
        try
          set position of ${windowRef} to {${x}, ${y}}
          return "success"
        on error errMsg
          return "error: " & errMsg
        end try
      end tell
    end tell
  `

  const result = await executeAppleScript({ script, timeout: 10000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? `Failed to move window of ${input.appName}`,
    }
  }

  const output = result.output ?? ''
  if (output.startsWith('error:')) {
    return {
      success: false,
      error: `Window not found or cannot be moved: ${windowTitle ?? `index ${windowIndex}`} in ${input.appName}`,
    }
  }

  return {
    success: true,
    message: `Moved window of ${input.appName} to (${x}, ${y})`,
  }
}

/**
 * Resizes a window to specified dimensions.
 *
 * @param input - Window reference and new dimensions
 * @returns
 * - On success: { success: true, message: string }
 * - On failure: { success: false, error: string }
 *
 * @example
 * // Resize Finder window to 800x600
 * await resizeWindow({ appName: 'Finder', width: 800, height: 600 })
 *
 * Requirements: 4.5
 */
export async function resizeWindow(
  input: ResizeWindowInput,
): Promise<WindowActionResult> {
  const appName = sanitizeIdentifier(input.appName)
  const windowIndex = input.windowIndex ?? 1
  const windowTitle = input.windowTitle
    ? sanitizeIdentifier(input.windowTitle)
    : undefined
  const { width, height } = input

  // First check if app exists
  const checkScript = `
    tell application "System Events"
      set procExists to exists (process "${appName}")
      return procExists
    end tell
  `

  const checkResult = await executeAppleScript({ script: checkScript })
  if (!checkResult.success || checkResult.output !== 'true') {
    return {
      success: false,
      error: `Application not found or not running: ${input.appName}`,
    }
  }

  // Build window reference
  let windowRef: string
  if (windowTitle) {
    windowRef = `window "${windowTitle}"`
  } else {
    windowRef = `window ${windowIndex}`
  }

  const script = `
    tell application "System Events"
      tell process "${appName}"
        try
          set size of ${windowRef} to {${width}, ${height}}
          return "success"
        on error errMsg
          return "error: " & errMsg
        end try
      end tell
    end tell
  `

  const result = await executeAppleScript({ script, timeout: 10000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? `Failed to resize window of ${input.appName}`,
    }
  }

  const output = result.output ?? ''
  if (output.startsWith('error:')) {
    return {
      success: false,
      error: `Window not found or cannot be resized: ${windowTitle ?? `index ${windowIndex}`} in ${input.appName}`,
    }
  }

  return {
    success: true,
    message: `Resized window of ${input.appName} to ${width}x${height}`,
  }
}

/**
 * Minimizes a window to the Dock.
 *
 * @param input - Window reference
 * @returns
 * - On success: { success: true, message: string }
 * - On failure: { success: false, error: string }
 *
 * @example
 * // Minimize first Finder window
 * await minimizeWindow({ appName: 'Finder' })
 *
 * Requirements: 4.6
 */
export async function minimizeWindow(
  input: WindowReferenceInput,
): Promise<WindowActionResult> {
  const appName = sanitizeIdentifier(input.appName)
  const windowIndex = input.windowIndex ?? 1
  const windowTitle = input.windowTitle
    ? sanitizeIdentifier(input.windowTitle)
    : undefined

  // First check if app exists
  const checkScript = `
    tell application "System Events"
      set procExists to exists (process "${appName}")
      return procExists
    end tell
  `

  const checkResult = await executeAppleScript({ script: checkScript })
  if (!checkResult.success || checkResult.output !== 'true') {
    return {
      success: false,
      error: `Application not found or not running: ${input.appName}`,
    }
  }

  // For minimize, use System Events to click the minimize button (button 3)
  // Button 3 is the yellow minimize button in macOS window title bars

  let windowRef: string
  if (windowTitle) {
    windowRef = `window "${windowTitle}"`
  } else {
    windowRef = `window ${windowIndex}`
  }

  // Use System Events to click the minimize button
  const script = `
    tell application "System Events"
      tell process "${appName}"
        try
          if exists ${windowRef} then
            click button 3 of ${windowRef}
            return "success"
          else
            return "error: window not found"
          end if
        on error errMsg
          return "error: " & errMsg
        end try
      end tell
    end tell
  `

  const result = await executeAppleScript({ script, timeout: 10000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? `Failed to minimize window of ${input.appName}`,
    }
  }

  const output = result.output ?? ''
  if (output.startsWith('error:')) {
    return {
      success: false,
      error: `Window not found or cannot be minimized: ${windowTitle ?? `index ${windowIndex}`} in ${input.appName}`,
    }
  }

  return {
    success: true,
    message: `Minimized window ${windowTitle ?? windowIndex} of ${input.appName}`,
  }
}
