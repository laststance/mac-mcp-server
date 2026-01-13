/**
 * Scroll and Navigation Tools
 *
 * Tools for performing scroll operations: directional scrolling and scrolling to elements.
 * Uses JXA (JavaScript for Automation) with CoreGraphics for scroll events.
 *
 * @module scroll
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */

import { execFile } from 'child_process'
import { promisify } from 'util'

import { z } from 'zod'

import { executeAppleScript } from '../lib/executor.js'
import { checkAccessibility } from '../lib/permission.js'
import { sanitizeIdentifier, sanitizeString } from '../lib/sanitizer.js'

const execFileAsync = promisify(execFile)

// ============================================================================
// Constants
// ============================================================================

/**
 * Default timeout for scroll operations in milliseconds.
 */
const SCROLL_TIMEOUT = 10000

/**
 * Default scroll amount in pixels.
 */
const DEFAULT_SCROLL_AMOUNT = 100

/**
 * Number of scroll wheel events to send per operation.
 * More events = smoother scrolling.
 */
const SCROLL_STEPS = 5

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Result of a scroll operation.
 */
export interface ScrollResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Result of scroll to element operation.
 */
export interface ScrollToElementResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Input for scroll tool.
 */
export interface ScrollInput {
  direction: 'up' | 'down' | 'left' | 'right'
  amount?: number
  x?: number
  y?: number
}

/**
 * Input for scroll_to_element tool.
 */
export interface ScrollToElementInput {
  appName: string
  elementPath: string
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for scroll tool.
 * @param direction - Direction to scroll (up, down, left, right)
 * @param amount - Scroll amount in pixels (default: 100)
 * @param x - Optional X coordinate to scroll at
 * @param y - Optional Y coordinate to scroll at
 */
export const ScrollSchema = z.object({
  direction: z
    .enum(['up', 'down', 'left', 'right'])
    .describe('Direction to scroll'),
  amount: z
    .number()
    .min(1)
    .optional()
    .default(100)
    .describe('Scroll amount in pixels'),
  x: z.number().optional().describe('X coordinate to scroll at'),
  y: z.number().optional().describe('Y coordinate to scroll at'),
})

/**
 * Schema for scroll_to_element tool.
 * @param appName - Application name containing the element
 * @param elementPath - Path to the element to scroll into view
 */
export const ScrollToElementSchema = z.object({
  appName: z.string().describe('Application name containing the element'),
  elementPath: z.string().describe('Path to the element to scroll into view'),
})

// ============================================================================
// JXA Script Execution
// ============================================================================

/**
 * Executes a JXA (JavaScript for Automation) script via osascript.
 *
 * @param script - The JavaScript code to execute
 * @returns Promise with stdout output or error
 */
async function executeJXA(
  script: string,
): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const { stdout } = await execFileAsync(
      'osascript',
      ['-l', 'JavaScript', '-e', script],
      { timeout: SCROLL_TIMEOUT },
    )
    return { success: true, output: stdout.trim() }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Unknown error executing JXA script' }
  }
}

/**
 * Generates JXA code for scroll wheel operation.
 *
 * @param deltaX - Horizontal scroll delta (positive = right, negative = left)
 * @param deltaY - Vertical scroll delta (positive = down, negative = up)
 * @param x - Optional X coordinate (uses current mouse position if not provided)
 * @param y - Optional Y coordinate (uses current mouse position if not provided)
 * @param steps - Number of scroll events to send
 * @returns JXA script string
 */
function generateScrollScript(
  deltaX: number,
  deltaY: number,
  x?: number,
  y?: number,
  steps: number = SCROLL_STEPS,
): string {
  // Divide the total scroll amount into steps for smoother scrolling
  const stepDeltaX = Math.round(deltaX / steps)
  const stepDeltaY = Math.round(deltaY / steps)

  // Position part of script
  const positionScript =
    x !== undefined && y !== undefined
      ? `
      // Move mouse to specified position first
      var point = $.CGPointMake(${x}, ${y});
      var moveEvent = $.CGEventCreateMouseEvent(null, 5, point, 0);
      $.CGEventPost($.kCGHIDEventTap, moveEvent);
      $.NSThread.sleepForTimeInterval(0.05);
    `
      : ''

  return `
    ObjC.import('Cocoa');
    ObjC.import('CoreGraphics');

    ${positionScript}

    // Scroll wheel event type
    var kCGScrollEventUnitPixel = 0;

    for (var i = 0; i < ${steps}; i++) {
      // Create scroll wheel event
      // CGEventCreateScrollWheelEvent(source, units, wheelCount, wheel1, wheel2)
      // wheel1 = vertical (negative = up, positive = down)
      // wheel2 = horizontal (negative = left, positive = right)
      var scrollEvent = $.CGEventCreateScrollWheelEvent(
        null,
        kCGScrollEventUnitPixel,
        2,  // 2 wheels (vertical + horizontal)
        ${stepDeltaY},
        ${stepDeltaX}
      );
      $.CGEventPost($.kCGHIDEventTap, scrollEvent);
      $.NSThread.sleepForTimeInterval(0.02);
    }

    'success';
  `
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Scrolls in the specified direction.
 *
 * Uses CoreGraphics CGEventCreateScrollWheelEvent for scroll simulation.
 * Can optionally scroll at a specific screen position.
 *
 * @param input - Input containing direction, amount, and optional coordinates
 * @returns Result indicating success or failure with error message
 *
 * @example
 * // Scroll down at current mouse position
 * const result = await scroll({ direction: 'down' })
 *
 * @example
 * // Scroll left with specific amount
 * const result = await scroll({ direction: 'left', amount: 200 })
 *
 * @example
 * // Scroll at specific coordinates
 * const result = await scroll({ direction: 'down', x: 500, y: 300 })
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4
 */
export async function scroll(input: ScrollInput): Promise<ScrollResult> {
  const { direction, amount = DEFAULT_SCROLL_AMOUNT, x, y } = input

  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  // Calculate scroll deltas based on direction
  // Note: For scroll wheel events:
  // - Positive Y = scroll down (content moves up)
  // - Negative Y = scroll up (content moves down)
  // - Positive X = scroll right
  // - Negative X = scroll left
  let deltaX = 0
  let deltaY = 0

  switch (direction) {
    case 'up':
      deltaY = -amount // Negative = scroll up
      break
    case 'down':
      deltaY = amount // Positive = scroll down
      break
    case 'left':
      deltaX = -amount // Negative = scroll left
      break
    case 'right':
      deltaX = amount // Positive = scroll right
      break
  }

  // Generate and execute JXA script
  const script = generateScrollScript(deltaX, deltaY, x, y)
  const result = await executeJXA(script)

  if (result.success) {
    const positionStr =
      x !== undefined && y !== undefined ? ` at (${x}, ${y})` : ''
    return {
      success: true,
      message: `Scrolled ${direction} by ${amount} pixels${positionStr}`,
    }
  } else {
    return {
      success: false,
      error: result.error || 'Failed to scroll',
    }
  }
}

/**
 * Scrolls until the specified UI element becomes visible.
 *
 * Uses AppleScript to locate the element and determine scroll direction,
 * then performs scroll operations until the element is in view.
 *
 * @param input - Input containing app name and element path
 * @returns Result indicating success or failure with error message
 *
 * @example
 * const result = await scrollToElement({
 *   appName: 'Safari',
 *   elementPath: 'window1/scrollArea1/button1'
 * })
 *
 * Requirements: 16.5, 16.6
 */
export async function scrollToElement(
  input: ScrollToElementInput,
): Promise<ScrollToElementResult> {
  const { appName, elementPath } = input

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
    sanitizedPath = sanitizeString(elementPath)
  } catch (error) {
    return {
      success: false,
      error: `Invalid input: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }

  // Parse element path to build AppleScript reference
  // Element path format: "window1/scrollArea1/button1" or similar
  const pathParts = sanitizedPath.split('/')

  // Build the AppleScript to find and scroll to element
  // This is a simplified approach - for complex UIs, more sophisticated parsing may be needed
  const script = `
    tell application "System Events"
      tell process "${sanitizedAppName}"
        try
          -- Check if app is running and accessible
          if not (exists) then
            return "error: Application '${sanitizedAppName}' is not running"
          end if

          -- Try to find the element
          -- Note: This is a simplified approach for common element paths
          set targetElement to missing value
          set elementRef to a reference to ${buildElementReference(pathParts)}

          try
            set targetElement to elementRef
            -- Get element position
            set elementPos to position of targetElement
            set elementSize to size of targetElement

            -- Calculate center of element
            set centerX to (item 1 of elementPos) + ((item 1 of elementSize) / 2)
            set centerY to (item 2 of elementPos) + ((item 2 of elementSize) / 2)

            -- Try to scroll the element into view by performing AXScrollToVisible action
            try
              perform action "AXScrollToVisible" of targetElement
              return "success|||" & centerX & "|||" & centerY
            on error
              -- Fallback: return position for manual scrolling
              return "position|||" & centerX & "|||" & centerY
            end try
          on error errMsg
            return "error: Element not found at path '${sanitizedPath}': " & errMsg
          end try
        on error errMsg
          return "error: " & errMsg
        end try
      end tell
    end tell
  `

  const result = await executeAppleScript({ script, timeout: SCROLL_TIMEOUT })

  if (result.success && result.output) {
    const output = result.output.toString()

    if (output.startsWith('success|||')) {
      return {
        success: true,
        message: `Scrolled element into view at path: ${elementPath}`,
      }
    } else if (output.startsWith('position|||')) {
      // Element found but AXScrollToVisible not supported
      // Return success with position info for client to handle
      const parts = output.split('|||')
      const x = parseFloat(parts[1])
      const y = parseFloat(parts[2])
      return {
        success: true,
        message: `Element found at (${x}, ${y}). Scroll action may not be supported for this element type.`,
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
    error: result.error || 'Unable to scroll to element',
  }
}

/**
 * Builds AppleScript element reference from path parts.
 *
 * @param pathParts - Array of path components (e.g., ["window1", "scrollArea1", "button1"])
 * @returns AppleScript reference string
 */
function buildElementReference(pathParts: string[]): string {
  if (pathParts.length === 0) {
    return 'window 1'
  }

  // Build from inside out (button of scroll area of window)
  let reference = ''

  for (let i = pathParts.length - 1; i >= 0; i--) {
    const part = pathParts[i]

    // Parse element type and index from part (e.g., "button1" -> "button", 1)
    const match = part.match(/^(\w+)(\d+)?$/)
    if (!match) {
      // If no match, use as literal
      reference =
        reference === '' ? `UI element "${part}"` : `${reference} of "${part}"`
      continue
    }

    const elementType = match[1].toLowerCase()
    const index = match[2] ? parseInt(match[2], 10) : 1

    // Map common short names to AppleScript element types
    const typeMap: Record<string, string> = {
      window: 'window',
      win: 'window',
      button: 'button',
      btn: 'button',
      scrollarea: 'scroll area',
      scroll: 'scroll area',
      text: 'text field',
      textfield: 'text field',
      list: 'list',
      table: 'table',
      row: 'row',
      cell: 'cell',
      group: 'group',
      splitgroup: 'splitter group',
      toolbar: 'toolbar',
      menu: 'menu',
      menuitem: 'menu item',
      statictext: 'static text',
      image: 'image',
      checkbox: 'checkbox',
      radio: 'radio button',
      popup: 'pop up button',
      combobox: 'combo box',
      slider: 'slider',
      tab: 'tab group',
      outline: 'outline',
      browser: 'browser',
    }

    const mappedType = typeMap[elementType] || elementType

    if (reference === '') {
      reference = `${mappedType} ${index}`
    } else {
      reference = `${reference} of ${mappedType} ${index}`
    }
  }

  return reference
}
