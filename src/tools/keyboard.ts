/**
 * Keyboard Input Tools
 *
 * Tools for simulating keyboard input: typing text, pressing keys, and key combinations.
 * Uses AppleScript via System Events for keyboard simulation.
 *
 * @module keyboard
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8
 */

import { z } from 'zod'

import { executeAppleScript } from '../lib/executor.js'
import { checkAccessibility } from '../lib/permission.js'
import { sanitizeString } from '../lib/sanitizer.js'

// ============================================================================
// Key Code Mapping
// ============================================================================

/**
 * Map of key names to macOS virtual key codes.
 * Based on the Key Code Reference Table from design.md.
 *
 * @see https://developer.apple.com/documentation/carbon/1455748-keycode_constants
 */
export const KEY_CODES: Record<string, number> = {
  // Common keys
  enter: 36,
  return: 36,
  escape: 53,
  tab: 48,
  delete: 51,
  backspace: 51,
  space: 49,

  // Arrow keys
  up: 126,
  down: 125,
  left: 123,
  right: 124,

  // Function keys
  f1: 122,
  f2: 120,
  f3: 99,
  f4: 118,
  f5: 96,
  f6: 97,
  f7: 98,
  f8: 100,
  f9: 101,
  f10: 109,
  f11: 103,
  f12: 111,

  // Additional common keys
  home: 115,
  end: 119,
  pageup: 116,
  pagedown: 121,
  forwarddelete: 117,
  clear: 71,
  help: 114,

  // Modifier keys (for press_key, not combinations)
  command: 55,
  shift: 56,
  capslock: 57,
  option: 58,
  control: 59,
  rightshift: 60,
  rightoption: 61,
  rightcontrol: 62,
  fn: 63,
}

// ============================================================================
// Modifier Keys Mapping
// ============================================================================

/**
 * Map of modifier key names to AppleScript modifier syntax.
 */
const MODIFIER_MAP: Record<string, string> = {
  command: 'command down',
  shift: 'shift down',
  option: 'option down',
  control: 'control down',
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Result of typing text.
 */
export interface TypeTextResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Result of pressing a key.
 */
export interface PressKeyResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Result of a key combination.
 */
export interface KeyCombinationResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Input for type_text tool.
 */
export interface TypeTextInput {
  text: string
  delay?: number
}

/**
 * Input for press_key tool.
 */
export interface PressKeyInput {
  key: string
  repeat?: number
}

/**
 * Input for key_combination tool.
 */
export interface KeyCombinationInput {
  modifiers: Array<'command' | 'shift' | 'option' | 'control'>
  key: string
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for type_text tool.
 * @param text - Text to type at the current cursor position
 * @param delay - Optional delay between keystrokes in milliseconds
 */
export const TypeTextSchema = z.object({
  text: z.string().describe('Text to type at the current cursor position'),
  delay: z
    .number()
    .min(0)
    .optional()
    .describe('Delay between keystrokes in milliseconds'),
})

/**
 * Schema for press_key tool.
 * @param key - Key name to press (e.g., "enter", "escape", "tab", "f1")
 * @param repeat - Number of times to press the key (default: 1)
 */
export const PressKeySchema = z.object({
  key: z
    .string()
    .describe(
      'Key name to press (e.g., "enter", "escape", "tab", "delete", "f1"-"f12", arrow keys)',
    ),
  repeat: z
    .number()
    .min(1)
    .optional()
    .default(1)
    .describe('Number of times to press the key'),
})

/**
 * Schema for key_combination tool.
 * @param modifiers - Array of modifier keys (command, shift, option, control)
 * @param key - Key to press with the modifiers
 */
export const KeyCombinationSchema = z.object({
  modifiers: z
    .array(z.enum(['command', 'shift', 'option', 'control']))
    .min(1)
    .describe('Modifier keys to hold (command, shift, option, control)'),
  key: z.string().describe('Key to press with the modifiers'),
})

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Types text character by character at the current cursor position.
 *
 * Uses AppleScript `keystroke` command via System Events. Requires
 * Accessibility permission to simulate keyboard input.
 *
 * @param input - Input containing text to type and optional delay
 * @returns Result indicating success or failure with error message
 *
 * @example
 * // Type simple text
 * const result = await typeText({ text: 'Hello World' })
 *
 * @example
 * // Type with delay between keystrokes
 * const result = await typeText({ text: 'Hello', delay: 50 })
 *
 * Requirements: 13.1, 13.2
 */
export async function typeText(input: TypeTextInput): Promise<TypeTextResult> {
  const { text, delay } = input

  // Handle empty text as no-op success
  if (text === '') {
    return {
      success: true,
      message: 'No text to type (empty string)',
    }
  }

  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  // Sanitize text for AppleScript string interpolation
  const sanitizedText = sanitizeString(text)

  // Build the AppleScript
  let script: string

  if (delay && delay > 0) {
    // Type character by character with delay
    // Convert delay from ms to seconds for AppleScript
    const delaySeconds = delay / 1000
    const chars = text.split('')
    const keystrokeCommands = chars
      .map((char) => {
        const sanitizedChar = sanitizeString(char)
        return `keystroke "${sanitizedChar}"\ndelay ${delaySeconds}`
      })
      .join('\n')

    script = `
      tell application "System Events"
        ${keystrokeCommands}
      end tell
      return "success"
    `
  } else {
    // Type all at once (faster)
    script = `
      tell application "System Events"
        keystroke "${sanitizedText}"
      end tell
      return "success"
    `
  }

  const result = await executeAppleScript({ script })

  if (result.success) {
    return {
      success: true,
      message: `Typed ${text.length} character(s)`,
    }
  } else {
    return {
      success: false,
      error: result.error || 'Failed to type text',
    }
  }
}

/**
 * Presses a key by name, optionally repeating multiple times.
 *
 * Supports special keys (Enter, Escape, Tab, Delete, Arrow keys),
 * function keys (F1-F12), and modifier keys. Uses AppleScript `key code`
 * command via System Events.
 *
 * @param input - Input containing key name and optional repeat count
 * @returns Result indicating success or failure with error message
 *
 * @example
 * // Press Enter key
 * const result = await pressKey({ key: 'enter' })
 *
 * @example
 * // Press Tab 3 times
 * const result = await pressKey({ key: 'tab', repeat: 3 })
 *
 * @example
 * // Press F5 function key
 * const result = await pressKey({ key: 'f5' })
 *
 * Requirements: 13.3, 13.4, 13.5, 13.8
 */
export async function pressKey(input: PressKeyInput): Promise<PressKeyResult> {
  const { key, repeat = 1 } = input

  // Normalize key name to lowercase
  const keyLower = key.toLowerCase()

  // Look up key code
  const keyCode = KEY_CODES[keyLower]
  if (keyCode === undefined) {
    return {
      success: false,
      error: `Unknown key: "${key}". Supported keys: ${Object.keys(KEY_CODES).join(', ')}`,
    }
  }

  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  // Build the AppleScript with repeat loop
  const script = `
    tell application "System Events"
      repeat ${repeat} times
        key code ${keyCode}
      end repeat
    end tell
    return "success"
  `

  const result = await executeAppleScript({ script })

  if (result.success) {
    return {
      success: true,
      message: `Pressed "${key}" ${repeat} time(s)`,
    }
  } else {
    return {
      success: false,
      error: result.error || 'Failed to press key',
    }
  }
}

/**
 * Presses a key combination with modifier keys.
 *
 * Holds the specified modifier keys (Command, Shift, Option, Control)
 * while pressing the target key. Supports both regular keys (a-z, 0-9)
 * and special keys (Enter, Tab, etc.).
 *
 * @param input - Input containing modifiers array and target key
 * @returns Result indicating success or failure with error message
 *
 * @example
 * // Press Cmd+C (copy)
 * const result = await keyCombination({ modifiers: ['command'], key: 'c' })
 *
 * @example
 * // Press Cmd+Shift+S (save as)
 * const result = await keyCombination({
 *   modifiers: ['command', 'shift'],
 *   key: 's'
 * })
 *
 * Requirements: 13.6, 13.7
 */
export async function keyCombination(
  input: KeyCombinationInput,
): Promise<KeyCombinationResult> {
  const { modifiers, key } = input

  // Check Accessibility permission
  const permStatus = await checkAccessibility()
  if (!permStatus.granted) {
    return {
      success: false,
      error: permStatus.guidance || 'Accessibility permission required',
    }
  }

  // Build modifier string for AppleScript
  const modifierString = modifiers.map((m) => MODIFIER_MAP[m]).join(', ')

  // Check if key is a special key (has a key code)
  const keyLower = key.toLowerCase()
  const keyCode = KEY_CODES[keyLower]

  let script: string

  if (keyCode !== undefined) {
    // Use key code for special keys
    script = `
      tell application "System Events"
        key code ${keyCode} using {${modifierString}}
      end tell
      return "success"
    `
  } else if (key.length === 1) {
    // Use keystroke for single character keys
    const sanitizedKey = sanitizeString(key)
    script = `
      tell application "System Events"
        keystroke "${sanitizedKey}" using {${modifierString}}
      end tell
      return "success"
    `
  } else {
    // Unknown key that's not a single character and not in KEY_CODES
    return {
      success: false,
      error: `Unknown key: "${key}". For special keys, use: ${Object.keys(KEY_CODES).join(', ')}. For regular keys, use single characters.`,
    }
  }

  const result = await executeAppleScript({ script })

  if (result.success) {
    const modifierNames = modifiers.join('+')
    return {
      success: true,
      message: `Pressed ${modifierNames}+${key}`,
    }
  } else {
    return {
      success: false,
      error: result.error || 'Failed to press key combination',
    }
  }
}
