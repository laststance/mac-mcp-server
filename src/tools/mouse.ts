/**
 * Mouse Control Tools
 *
 * Tools for simulating mouse input: clicking, double-clicking, moving, and dragging.
 * Uses JXA (JavaScript for Automation) with CoreGraphics for precise mouse control.
 *
 * @module mouse
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 11.7
 */

import { execFile } from 'child_process'
import { promisify } from 'util'

import { z } from 'zod'

import { checkAccessibility } from '../lib/permission.js'

const execFileAsync = promisify(execFile)

// ============================================================================
// Constants
// ============================================================================

/**
 * Default timeout for mouse operations in milliseconds.
 */
const MOUSE_TIMEOUT = 10000

/**
 * CoreGraphics event types for mouse operations.
 * These are the values used by CGEventCreateMouseEvent.
 */
const CG_EVENT_TYPES = {
  leftMouseDown: 1,
  leftMouseUp: 2,
  rightMouseDown: 3,
  rightMouseUp: 4,
  mouseMoved: 5,
  leftMouseDragged: 6,
  rightMouseDragged: 7,
  otherMouseDown: 25,
  otherMouseUp: 26,
  otherMouseDragged: 27,
}

/**
 * Mouse button identifiers for CoreGraphics.
 */
const CG_MOUSE_BUTTONS = {
  left: 0,
  right: 1,
  middle: 2,
}

/**
 * CoreGraphics modifier flags.
 * These match the values in CGEventFlags.
 */
const CG_MODIFIER_FLAGS = {
  command: 0x100000, // kCGEventFlagMaskCommand
  shift: 0x20000, // kCGEventFlagMaskShift
  option: 0x80000, // kCGEventFlagMaskAlternate
  control: 0x40000, // kCGEventFlagMaskControl
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Result of a click operation.
 */
export interface ClickResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Result of a double-click operation.
 */
export interface DoubleClickResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Result of a mouse move operation.
 */
export interface MoveMouseResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Result of a drag operation.
 */
export interface DragResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Input for click tool.
 */
export interface ClickInput {
  x: number
  y: number
  button?: 'left' | 'right' | 'middle'
  modifiers?: Array<'command' | 'shift' | 'option' | 'control'>
}

/**
 * Input for double_click tool.
 */
export interface DoubleClickInput {
  x: number
  y: number
}

/**
 * Input for move_mouse tool.
 */
export interface MoveMouseInput {
  x: number
  y: number
}

/**
 * Input for drag tool.
 */
export interface DragInput {
  startX: number
  startY: number
  endX: number
  endY: number
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for click tool.
 * @param x - X coordinate for the click
 * @param y - Y coordinate for the click
 * @param button - Mouse button (left, right, middle) - defaults to left
 * @param modifiers - Optional modifier keys to hold during click
 */
export const ClickSchema = z.object({
  x: z.number().describe('X coordinate for the click'),
  y: z.number().describe('Y coordinate for the click'),
  button: z
    .enum(['left', 'right', 'middle'])
    .optional()
    .default('left')
    .describe('Mouse button to click (left, right, or middle)'),
  modifiers: z
    .array(z.enum(['command', 'shift', 'option', 'control']))
    .optional()
    .describe('Modifier keys to hold during click'),
})

/**
 * Schema for double_click tool.
 * @param x - X coordinate for the double-click
 * @param y - Y coordinate for the double-click
 */
export const DoubleClickSchema = z.object({
  x: z.number().describe('X coordinate for the double-click'),
  y: z.number().describe('Y coordinate for the double-click'),
})

/**
 * Schema for move_mouse tool.
 * @param x - X coordinate to move the cursor to
 * @param y - Y coordinate to move the cursor to
 */
export const MoveMouseSchema = z.object({
  x: z.number().describe('X coordinate to move the cursor to'),
  y: z.number().describe('Y coordinate to move the cursor to'),
})

/**
 * Schema for drag tool.
 * @param startX - Starting X coordinate
 * @param startY - Starting Y coordinate
 * @param endX - Ending X coordinate
 * @param endY - Ending Y coordinate
 */
export const DragSchema = z.object({
  startX: z.number().describe('Starting X coordinate'),
  startY: z.number().describe('Starting Y coordinate'),
  endX: z.number().describe('Ending X coordinate'),
  endY: z.number().describe('Ending Y coordinate'),
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
      { timeout: MOUSE_TIMEOUT },
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
 * Generates JXA code for mouse click operation.
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param button - Mouse button (left, right, middle)
 * @param modifierFlags - Combined modifier flags
 * @param clickCount - Number of clicks (1 for single, 2 for double)
 * @returns JXA script string
 */
function generateClickScript(
  x: number,
  y: number,
  button: 'left' | 'right' | 'middle',
  modifierFlags: number,
  clickCount: number,
): string {
  const cgButton = CG_MOUSE_BUTTONS[button]

  let downEvent: number
  let upEvent: number

  switch (button) {
    case 'right':
      downEvent = CG_EVENT_TYPES.rightMouseDown
      upEvent = CG_EVENT_TYPES.rightMouseUp
      break
    case 'middle':
      downEvent = CG_EVENT_TYPES.otherMouseDown
      upEvent = CG_EVENT_TYPES.otherMouseUp
      break
    default:
      downEvent = CG_EVENT_TYPES.leftMouseDown
      upEvent = CG_EVENT_TYPES.leftMouseUp
  }

  // JXA script using CoreGraphics for mouse events
  return `
    ObjC.import('Cocoa');
    ObjC.import('CoreGraphics');

    var point = $.CGPointMake(${x}, ${y});

    for (var i = 0; i < ${clickCount}; i++) {
      // Create mouse down event
      var downEvent = $.CGEventCreateMouseEvent(null, ${downEvent}, point, ${cgButton});
      if (${modifierFlags} !== 0) {
        $.CGEventSetFlags(downEvent, ${modifierFlags});
      }
      $.CGEventSetIntegerValueField(downEvent, $.kCGMouseEventClickState, ${clickCount});
      $.CGEventPost($.kCGHIDEventTap, downEvent);

      // Small delay between down and up
      $.NSThread.sleepForTimeInterval(0.01);

      // Create mouse up event
      var upEvent = $.CGEventCreateMouseEvent(null, ${upEvent}, point, ${cgButton});
      if (${modifierFlags} !== 0) {
        $.CGEventSetFlags(upEvent, ${modifierFlags});
      }
      $.CGEventSetIntegerValueField(upEvent, $.kCGMouseEventClickState, ${clickCount});
      $.CGEventPost($.kCGHIDEventTap, upEvent);

      if (i < ${clickCount} - 1) {
        $.NSThread.sleepForTimeInterval(0.05);
      }
    }

    'success';
  `
}

/**
 * Generates JXA code for mouse move operation.
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns JXA script string
 */
function generateMoveScript(x: number, y: number): string {
  return `
    ObjC.import('Cocoa');
    ObjC.import('CoreGraphics');

    var point = $.CGPointMake(${x}, ${y});
    var moveEvent = $.CGEventCreateMouseEvent(null, ${CG_EVENT_TYPES.mouseMoved}, point, 0);
    $.CGEventPost($.kCGHIDEventTap, moveEvent);

    'success';
  `
}

/**
 * Generates JXA code for mouse drag operation.
 *
 * @param startX - Starting X coordinate
 * @param startY - Starting Y coordinate
 * @param endX - Ending X coordinate
 * @param endY - Ending Y coordinate
 * @returns JXA script string
 */
function generateDragScript(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): string {
  return `
    ObjC.import('Cocoa');
    ObjC.import('CoreGraphics');

    var startPoint = $.CGPointMake(${startX}, ${startY});
    var endPoint = $.CGPointMake(${endX}, ${endY});

    // Move to start position
    var moveEvent = $.CGEventCreateMouseEvent(null, ${CG_EVENT_TYPES.mouseMoved}, startPoint, 0);
    $.CGEventPost($.kCGHIDEventTap, moveEvent);
    $.NSThread.sleepForTimeInterval(0.05);

    // Mouse down at start position
    var downEvent = $.CGEventCreateMouseEvent(null, ${CG_EVENT_TYPES.leftMouseDown}, startPoint, 0);
    $.CGEventPost($.kCGHIDEventTap, downEvent);
    $.NSThread.sleepForTimeInterval(0.05);

    // Interpolate drag path for smoother movement
    var steps = 10;
    var dx = (${endX} - ${startX}) / steps;
    var dy = (${endY} - ${startY}) / steps;

    for (var i = 1; i <= steps; i++) {
      var currentX = ${startX} + (dx * i);
      var currentY = ${startY} + (dy * i);
      var currentPoint = $.CGPointMake(currentX, currentY);
      var dragEvent = $.CGEventCreateMouseEvent(null, ${CG_EVENT_TYPES.leftMouseDragged}, currentPoint, 0);
      $.CGEventPost($.kCGHIDEventTap, dragEvent);
      $.NSThread.sleepForTimeInterval(0.02);
    }

    // Mouse up at end position
    var upEvent = $.CGEventCreateMouseEvent(null, ${CG_EVENT_TYPES.leftMouseUp}, endPoint, 0);
    $.CGEventPost($.kCGHIDEventTap, upEvent);

    'success';
  `
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Performs a mouse click at the specified coordinates.
 *
 * Supports left, right, and middle button clicks, with optional modifier keys.
 * Uses CoreGraphics CGEventCreateMouseEvent for precise control.
 *
 * @param input - Input containing coordinates, button, and optional modifiers
 * @returns Result indicating success or failure with error message
 *
 * @example
 * // Left click at coordinates
 * const result = await click({ x: 100, y: 200 })
 *
 * @example
 * // Right click
 * const result = await click({ x: 100, y: 200, button: 'right' })
 *
 * @example
 * // Cmd+click
 * const result = await click({ x: 100, y: 200, modifiers: ['command'] })
 *
 * Requirements: 12.1, 12.2, 12.3, 12.7, 12.8, 11.7
 */
export async function click(input: ClickInput): Promise<ClickResult> {
  const { x, y, button = 'left', modifiers } = input

  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  // Calculate modifier flags
  let modifierFlags = 0
  if (modifiers && modifiers.length > 0) {
    for (const mod of modifiers) {
      modifierFlags |= CG_MODIFIER_FLAGS[mod]
    }
  }

  // Generate and execute JXA script
  const script = generateClickScript(x, y, button, modifierFlags, 1)
  const result = await executeJXA(script)

  if (result.success) {
    const modifierStr =
      modifiers && modifiers.length > 0
        ? ` with ${modifiers.join('+')} modifier(s)`
        : ''
    return {
      success: true,
      message: `Clicked ${button} button at (${x}, ${y})${modifierStr}`,
    }
  } else {
    return {
      success: false,
      error: result.error || 'Failed to perform click',
    }
  }
}

/**
 * Performs a double-click at the specified coordinates.
 *
 * Uses CoreGraphics to send two rapid click events with proper click state.
 *
 * @param input - Input containing coordinates
 * @returns Result indicating success or failure with error message
 *
 * @example
 * const result = await doubleClick({ x: 100, y: 200 })
 *
 * Requirements: 12.4
 */
export async function doubleClick(
  input: DoubleClickInput,
): Promise<DoubleClickResult> {
  const { x, y } = input

  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  // Generate and execute JXA script for double-click
  const script = generateClickScript(x, y, 'left', 0, 2)
  const result = await executeJXA(script)

  if (result.success) {
    return {
      success: true,
      message: `Double-clicked at (${x}, ${y})`,
    }
  } else {
    return {
      success: false,
      error: result.error || 'Failed to perform double-click',
    }
  }
}

/**
 * Moves the mouse cursor to the specified coordinates without clicking.
 *
 * @param input - Input containing target coordinates
 * @returns Result indicating success or failure with error message
 *
 * @example
 * const result = await moveMouse({ x: 500, y: 300 })
 *
 * Requirements: 12.5
 */
export async function moveMouse(
  input: MoveMouseInput,
): Promise<MoveMouseResult> {
  const { x, y } = input

  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  // Generate and execute JXA script
  const script = generateMoveScript(x, y)
  const result = await executeJXA(script)

  if (result.success) {
    return {
      success: true,
      message: `Moved cursor to (${x}, ${y})`,
    }
  } else {
    return {
      success: false,
      error: result.error || 'Failed to move cursor',
    }
  }
}

/**
 * Performs a mouse drag operation from start to end coordinates.
 *
 * Interpolates the path between start and end for smooth dragging.
 *
 * @param input - Input containing start and end coordinates
 * @returns Result indicating success or failure with error message
 *
 * @example
 * const result = await drag({
 *   startX: 100,
 *   startY: 200,
 *   endX: 300,
 *   endY: 400
 * })
 *
 * Requirements: 12.6
 */
export async function drag(input: DragInput): Promise<DragResult> {
  const { startX, startY, endX, endY } = input

  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  // Generate and execute JXA script
  const script = generateDragScript(startX, startY, endX, endY)
  const result = await executeJXA(script)

  if (result.success) {
    return {
      success: true,
      message: `Dragged from (${startX}, ${startY}) to (${endX}, ${endY})`,
    }
  } else {
    return {
      success: false,
      error: result.error || 'Failed to perform drag',
    }
  }
}
