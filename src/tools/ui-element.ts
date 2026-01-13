/**
 * UI Element Interaction Tools
 *
 * Tools for interacting with UI elements via macOS Accessibility APIs.
 * Provides tree retrieval, clicking, value get/set, and focus operations.
 *
 * @module ui-element
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 11.1, 11.3
 */

import { z } from 'zod'

import { executeAppleScript } from '../lib/executor.js'
import { checkAccessibility } from '../lib/permission.js'
import { sanitizeIdentifier, sanitizeString } from '../lib/sanitizer.js'

// ============================================================================
// Constants
// ============================================================================

/**
 * Default timeout for UI element operations in milliseconds.
 */
const UI_ELEMENT_TIMEOUT = 15000

/**
 * Default maximum depth for UI element tree traversal.
 */
const DEFAULT_MAX_DEPTH = 3

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Represents a UI element in the accessibility tree.
 */
export interface UIElement {
  /** Element role (e.g., "button", "window", "text field") */
  role: string
  /** Element title or label */
  title?: string
  /** Element value (for controls like text fields, checkboxes) */
  value?: string
  /** Element position on screen */
  position: { x: number; y: number }
  /** Element size */
  size: { width: number; height: number }
  /** Unique path identifier for this element */
  path: string
  /** Child elements (if any and within maxDepth) */
  children?: UIElement[]
}

/**
 * Result of get_ui_elements operation.
 */
export interface GetUIElementsResult {
  success: boolean
  elements?: UIElement[]
  error?: string
}

/**
 * Result of click_ui_element operation.
 */
export interface ClickUIElementResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Result of get_ui_element_value operation.
 */
export interface GetUIElementValueResult {
  success: boolean
  value?: string | null
  error?: string
}

/**
 * Result of set_ui_element_value operation.
 */
export interface SetUIElementValueResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Result of focus_ui_element operation.
 */
export interface FocusUIElementResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Input for get_ui_elements tool.
 */
export interface GetUIElementsInput {
  appName: string
  maxDepth?: number
}

/**
 * Input for click_ui_element tool.
 */
export interface ClickUIElementInput {
  appName: string
  elementPath: string
}

/**
 * Input for get_ui_element_value tool.
 */
export interface GetUIElementValueInput {
  appName: string
  elementPath: string
}

/**
 * Input for set_ui_element_value tool.
 */
export interface SetUIElementValueInput {
  appName: string
  elementPath: string
  value: string
}

/**
 * Input for focus_ui_element tool.
 */
export interface FocusUIElementInput {
  appName: string
  elementPath: string
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for get_ui_elements tool.
 * @param appName - Application name to get UI elements from
 * @param maxDepth - Maximum tree traversal depth (default: 3)
 */
export const GetUIElementsSchema = z.object({
  appName: z.string().describe('Application name to get UI elements from'),
  maxDepth: z
    .number()
    .optional()
    .default(3)
    .describe('Maximum tree traversal depth (default: 3)'),
})

/**
 * Schema for click_ui_element tool.
 * @param appName - Application name containing the element
 * @param elementPath - Path to the element to click
 */
export const ClickUIElementSchema = z.object({
  appName: z.string().describe('Application name containing the element'),
  elementPath: z.string().describe('Path to the element to click'),
})

/**
 * Schema for get_ui_element_value tool.
 * @param appName - Application name containing the element
 * @param elementPath - Path to the element
 */
export const GetUIElementValueSchema = z.object({
  appName: z.string().describe('Application name containing the element'),
  elementPath: z.string().describe('Path to the element'),
})

/**
 * Schema for set_ui_element_value tool.
 * @param appName - Application name containing the element
 * @param elementPath - Path to the element
 * @param value - Value to set
 */
export const SetUIElementValueSchema = z.object({
  appName: z.string().describe('Application name containing the element'),
  elementPath: z.string().describe('Path to the element'),
  value: z.string().describe('Value to set'),
})

/**
 * Schema for focus_ui_element tool.
 * @param appName - Application name containing the element
 * @param elementPath - Path to the element to focus
 */
export const FocusUIElementSchema = z.object({
  appName: z.string().describe('Application name containing the element'),
  elementPath: z.string().describe('Path to the element to focus'),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Builds AppleScript element reference from path parts.
 *
 * @param pathParts - Array of path components (e.g., ["window1", "button1"])
 * @returns AppleScript reference string
 *
 * @example
 * buildElementReference(["window1", "button1"]) // => "button 1 of window 1"
 */
function buildElementReference(pathParts: string[]): string {
  if (pathParts.length === 0) {
    return 'window 1'
  }

  // Build from inside out (button of scroll area of window)
  let reference = ''

  for (let i = pathParts.length - 1; i >= 0; i--) {
    // Safe access - i is within array bounds
    const part = pathParts[i]!

    // Parse element type and index from part (e.g., "button1" -> "button", 1)
    const match = part.match(/^(\w+)(\d+)?$/)
    if (!match) {
      // If no match, use as literal
      reference =
        reference === '' ? `UI element "${part}"` : `${reference} of "${part}"`
      continue
    }

    // match[1] is guaranteed by the regex pattern (required capture group)
    const elementType = match[1]!.toLowerCase()
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
      textArea: 'text area',
      textarea: 'text area',
      list: 'list',
      table: 'table',
      row: 'row',
      cell: 'cell',
      group: 'group',
      splitgroup: 'splitter group',
      toolbar: 'toolbar',
      menu: 'menu',
      menuitem: 'menu item',
      menubar: 'menu bar',
      statictext: 'static text',
      image: 'image',
      checkbox: 'checkbox',
      radio: 'radio button',
      popup: 'pop up button',
      combobox: 'combo box',
      slider: 'slider',
      tab: 'tab group',
      tabgroup: 'tab group',
      outline: 'outline',
      browser: 'browser',
      sheet: 'sheet',
      drawer: 'drawer',
      webarea: 'web area',
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

/**
 * Parses UI element JSON output from AppleScript.
 *
 * @param jsonStr - JSON string from AppleScript output
 * @returns Array of UIElement objects or null if parsing fails
 */
function parseUIElementsJson(jsonStr: string): UIElement[] | null {
  try {
    const parsed = JSON.parse(jsonStr)
    if (Array.isArray(parsed)) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Retrieves a tree of accessible UI elements for the specified application.
 *
 * Returns element roles, titles, values, positions, sizes, and unique path identifiers.
 * Tree depth is limited by maxDepth parameter.
 *
 * @param input - Input containing app name and optional max depth
 * @returns Result with UI element tree or error
 *
 * @example
 * const result = await getUIElements({ appName: 'Safari', maxDepth: 3 })
 * if (result.success) {
 *   console.log(result.elements) // Array of UIElement
 * }
 *
 * Requirements: 15.1, 15.2
 */
export async function getUIElements(
  input: GetUIElementsInput,
): Promise<GetUIElementsResult> {
  const { appName, maxDepth = DEFAULT_MAX_DEPTH } = input

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

  // Clamp maxDepth to reasonable range
  const clampedDepth = Math.max(1, Math.min(maxDepth, 10))

  // AppleScript to get UI element tree as JSON
  // Using simpler escaping approach to avoid complex nested escaping issues
  const script = `
    tell application "System Events"
      tell process "${sanitizedAppName}"
        try
          if not (exists) then
            return "error: Application '${sanitizedAppName}' is not running"
          end if

          -- Get all windows
          set windowList to windows
          if (count of windowList) is 0 then
            return "[]"
          end if

          set resultJson to "["
          set winIndex to 1
          repeat with win in windowList
            try
              set winPath to "window" & winIndex

              if winIndex > 1 then
                set resultJson to resultJson & ","
              end if

              set resultJson to resultJson & my buildElementJson(win, winPath, 1, ${clampedDepth})
              set winIndex to winIndex + 1

              -- Limit windows
              if winIndex > 10 then exit repeat
            end try
          end repeat
          set resultJson to resultJson & "]"

          return resultJson
        on error errMsg
          return "error: " & errMsg
        end try
      end tell
    end tell

    -- Helper to escape strings for JSON (simplified - just handles quotes)
    on escapeForJson(theText)
      set AppleScript's text item delimiters to quote
      set textItems to text items of theText
      set AppleScript's text item delimiters to (ASCII character 92) & quote
      set escapedText to textItems as text
      set AppleScript's text item delimiters to ""
      return escapedText
    end escapeForJson

    -- Helper to build element JSON
    on buildElementJson(elem, elemPath, currentDepth, maxD)
      set elemJson to "{"

      try
        -- Get role
        set elemRole to role of elem
        set elemJson to elemJson & quote & "role" & quote & ":" & quote & (my escapeForJson(elemRole)) & quote & ","
      on error
        set elemJson to elemJson & quote & "role" & quote & ":" & quote & "unknown" & quote & ","
      end try

      try
        -- Get title
        set elemTitle to name of elem
        if elemTitle is not missing value and elemTitle is not "" then
          set elemJson to elemJson & quote & "title" & quote & ":" & quote & (my escapeForJson(elemTitle as text)) & quote & ","
        end if
      end try

      try
        -- Get value
        set elemValue to value of elem
        if elemValue is not missing value then
          try
            set elemJson to elemJson & quote & "value" & quote & ":" & quote & (my escapeForJson(elemValue as text)) & quote & ","
          end try
        end if
      end try

      try
        -- Get position
        set elemPos to position of elem
        if elemPos is not missing value then
          set elemJson to elemJson & quote & "position" & quote & ":{" & quote & "x" & quote & ":" & (item 1 of elemPos) & "," & quote & "y" & quote & ":" & (item 2 of elemPos) & "},"
        else
          set elemJson to elemJson & quote & "position" & quote & ":{" & quote & "x" & quote & ":0," & quote & "y" & quote & ":0},"
        end if
      on error
        set elemJson to elemJson & quote & "position" & quote & ":{" & quote & "x" & quote & ":0," & quote & "y" & quote & ":0},"
      end try

      try
        -- Get size
        set elemSize to size of elem
        if elemSize is not missing value then
          set elemJson to elemJson & quote & "size" & quote & ":{" & quote & "width" & quote & ":" & (item 1 of elemSize) & "," & quote & "height" & quote & ":" & (item 2 of elemSize) & "},"
        else
          set elemJson to elemJson & quote & "size" & quote & ":{" & quote & "width" & quote & ":0," & quote & "height" & quote & ":0},"
        end if
      on error
        set elemJson to elemJson & quote & "size" & quote & ":{" & quote & "width" & quote & ":0," & quote & "height" & quote & ":0},"
      end try

      -- Add path
      set elemJson to elemJson & quote & "path" & quote & ":" & quote & (my escapeForJson(elemPath)) & quote

      -- Get children if within depth limit
      if currentDepth < maxD then
        try
          set childElements to UI elements of elem
          if (count of childElements) > 0 then
            set elemJson to elemJson & "," & quote & "children" & quote & ":["
            set childIndex to 1
            repeat with child in childElements
              try
                -- Build child path
                set childRole to role of child
                set childPath to elemPath & "/" & childRole & childIndex

                if childIndex > 1 then
                  set elemJson to elemJson & ","
                end if

                set elemJson to elemJson & (my buildElementJson(child, childPath, currentDepth + 1, maxD))
                set childIndex to childIndex + 1

                -- Limit children to prevent massive output
                if childIndex > 50 then exit repeat
              end try
            end repeat
            set elemJson to elemJson & "]"
          end if
        end try
      end if

      set elemJson to elemJson & "}"
      return elemJson
    end buildElementJson
  `

  const result = await executeAppleScript({
    script,
    timeout: UI_ELEMENT_TIMEOUT,
  })

  if (result.success && result.output) {
    const output = result.output.toString()

    if (output.startsWith('error:')) {
      return {
        success: false,
        error: output.substring(7).trim(),
      }
    }

    // Parse JSON output
    const elements = parseUIElementsJson(output)
    if (elements !== null) {
      return {
        success: true,
        elements,
      }
    }

    // Failed to parse - return raw output as error
    return {
      success: false,
      error: `Failed to parse UI elements: ${output.substring(0, 200)}`,
    }
  }

  return {
    success: false,
    error: result.error || 'Failed to get UI elements',
  }
}

/**
 * Clicks the specified UI element.
 *
 * Uses Accessibility APIs to perform a click action on the element.
 *
 * @param input - Input containing app name and element path
 * @returns Result indicating success or failure
 *
 * @example
 * const result = await clickUIElement({
 *   appName: 'Safari',
 *   elementPath: 'window1/button1'
 * })
 *
 * Requirements: 15.3, 15.6, 11.1, 11.3
 */
export async function clickUIElement(
  input: ClickUIElementInput,
): Promise<ClickUIElementResult> {
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

  // Validate element path
  if (!sanitizedPath || sanitizedPath.trim() === '') {
    return {
      success: false,
      error: 'Element path cannot be empty',
    }
  }

  // Parse element path
  const pathParts = sanitizedPath.split('/')
  const elementRef = buildElementReference(pathParts)

  const script = `
    tell application "System Events"
      tell process "${sanitizedAppName}"
        try
          if not (exists) then
            return "error: Application '${sanitizedAppName}' is not running"
          end if

          set targetElement to ${elementRef}

          -- Try AXPress action first (for buttons)
          try
            perform action "AXPress" of targetElement
            return "success: Clicked element at path '${sanitizedPath}'"
          on error
            -- Fallback to click if AXPress not available
            try
              click targetElement
              return "success: Clicked element at path '${sanitizedPath}'"
            on error errMsg
              return "error: Failed to click element: " & errMsg
            end try
          end try
        on error errMsg
          return "error: Element not found at path '${sanitizedPath}': " & errMsg
        end try
      end tell
    end tell
  `

  const result = await executeAppleScript({
    script,
    timeout: UI_ELEMENT_TIMEOUT,
  })

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
    error: result.error || 'Failed to click UI element',
  }
}

/**
 * Gets the current value of the specified UI element.
 *
 * @param input - Input containing app name and element path
 * @returns Result with element value or error
 *
 * @example
 * const result = await getUIElementValue({
 *   appName: 'TextEdit',
 *   elementPath: 'window1/textfield1'
 * })
 *
 * Requirements: 15.4, 15.6
 */
export async function getUIElementValue(
  input: GetUIElementValueInput,
): Promise<GetUIElementValueResult> {
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

  // Parse element path
  const pathParts = sanitizedPath.split('/')
  const elementRef = buildElementReference(pathParts)

  const script = `
    tell application "System Events"
      tell process "${sanitizedAppName}"
        try
          if not (exists) then
            return "error: Application '${sanitizedAppName}' is not running"
          end if

          set targetElement to ${elementRef}

          try
            set elemValue to value of targetElement
            if elemValue is missing value then
              return "value:null"
            else
              return "value:" & (elemValue as text)
            end if
          on error
            -- Try getting title/name instead
            try
              set elemName to name of targetElement
              if elemName is not missing value then
                return "value:" & (elemName as text)
              end if
            end try
            return "value:null"
          end try
        on error errMsg
          return "error: Element not found at path '${sanitizedPath}': " & errMsg
        end try
      end tell
    end tell
  `

  const result = await executeAppleScript({
    script,
    timeout: UI_ELEMENT_TIMEOUT,
  })

  if (result.success && result.output) {
    const output = result.output.toString()

    if (output.startsWith('value:')) {
      const valueStr = output.substring(6)
      return {
        success: true,
        value: valueStr === 'null' ? null : valueStr,
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
    error: result.error || 'Failed to get UI element value',
  }
}

/**
 * Sets the value of the specified UI element.
 *
 * Works with editable elements like text fields.
 *
 * @param input - Input containing app name, element path, and value
 * @returns Result indicating success or failure
 *
 * @example
 * const result = await setUIElementValue({
 *   appName: 'TextEdit',
 *   elementPath: 'window1/textfield1',
 *   value: 'Hello World'
 * })
 *
 * Requirements: 15.5, 15.6
 */
export async function setUIElementValue(
  input: SetUIElementValueInput,
): Promise<SetUIElementValueResult> {
  const { appName, elementPath, value } = input

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
  let sanitizedValue: string
  try {
    sanitizedAppName = sanitizeIdentifier(appName)
    sanitizedPath = sanitizeString(elementPath)
    sanitizedValue = sanitizeString(value)
  } catch (error) {
    return {
      success: false,
      error: `Invalid input: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }

  // Parse element path
  const pathParts = sanitizedPath.split('/')
  const elementRef = buildElementReference(pathParts)

  const script = `
    tell application "System Events"
      tell process "${sanitizedAppName}"
        try
          if not (exists) then
            return "error: Application '${sanitizedAppName}' is not running"
          end if

          set targetElement to ${elementRef}

          try
            set value of targetElement to "${sanitizedValue}"
            return "success: Value set for element at path '${sanitizedPath}'"
          on error errMsg
            return "error: Failed to set value (element may not be editable): " & errMsg
          end try
        on error errMsg
          return "error: Element not found at path '${sanitizedPath}': " & errMsg
        end try
      end tell
    end tell
  `

  const result = await executeAppleScript({
    script,
    timeout: UI_ELEMENT_TIMEOUT,
  })

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
    error: result.error || 'Failed to set UI element value',
  }
}

/**
 * Sets keyboard focus to the specified UI element.
 *
 * @param input - Input containing app name and element path
 * @returns Result indicating success or failure
 *
 * @example
 * const result = await focusUIElement({
 *   appName: 'Safari',
 *   elementPath: 'window1/textfield1'
 * })
 *
 * Requirements: 15.7, 11.1
 */
export async function focusUIElement(
  input: FocusUIElementInput,
): Promise<FocusUIElementResult> {
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

  // Parse element path
  const pathParts = sanitizedPath.split('/')
  const elementRef = buildElementReference(pathParts)

  const script = `
    tell application "System Events"
      tell process "${sanitizedAppName}"
        try
          if not (exists) then
            return "error: Application '${sanitizedAppName}' is not running"
          end if

          set targetElement to ${elementRef}

          -- First bring the app to front
          set frontmost to true

          try
            -- Try to set focus via AXFocused attribute
            set focused of targetElement to true
            return "success: Focused element at path '${sanitizedPath}'"
          on error
            -- Fallback: try AXRaise action
            try
              perform action "AXRaise" of targetElement
              return "success: Raised element at path '${sanitizedPath}'"
            on error errMsg
              return "error: Failed to focus element: " & errMsg
            end try
          end try
        on error errMsg
          return "error: Element not found at path '${sanitizedPath}': " & errMsg
        end try
      end tell
    end tell
  `

  const result = await executeAppleScript({
    script,
    timeout: UI_ELEMENT_TIMEOUT,
  })

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
    error: result.error || 'Failed to focus UI element',
  }
}
