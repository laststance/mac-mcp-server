/**
 * Clipboard Management Tools
 *
 * Provides tools for reading and writing system clipboard content.
 *
 * @module tools/clipboard
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { z } from 'zod'

import { executeAppleScript } from '../lib/executor.js'
import { sanitizeString } from '../lib/sanitizer.js'

/**
 * Clipboard content interface.
 * @returns
 * - text: Clipboard text content (undefined for non-text)
 * - contentType: Type of content on clipboard ('text' | 'image' | 'files' | 'other')
 */
export interface ClipboardContent {
  text?: string
  contentType: 'text' | 'image' | 'files' | 'other'
}

/**
 * Result type for getClipboard function.
 */
export interface GetClipboardResult {
  success: boolean
  data?: ClipboardContent
  error?: string
}

/**
 * Result type for setClipboard function.
 */
export interface SetClipboardResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Input type for setClipboard function.
 */
export interface SetClipboardInput {
  text: string
}

// Zod schemas for MCP tool registration
export const GetClipboardSchema = z.object({})
export const SetClipboardSchema = z.object({
  text: z.string().describe('Text content to set on clipboard'),
})

/**
 * Retrieves the current clipboard content.
 *
 * Returns text content if the clipboard contains text, otherwise
 * indicates the content type (image, files, or other).
 *
 * @returns Promise with ClipboardContent data or error
 *
 * @example
 * const result = await getClipboard()
 * if (result.success && result.data?.text) {
 *   console.log('Clipboard text:', result.data.text)
 * }
 */
export async function getClipboard(): Promise<GetClipboardResult> {
  // First check what type of content is on the clipboard
  const typeCheckScript = `
    try
      set clipInfo to the clipboard info
      set hasText to false
      set hasImage to false
      set hasFiles to false

      repeat with itemInfo in clipInfo
        set itemClass to class of itemInfo
        if itemClass is equal to string or itemClass is equal to Unicode text or itemClass is equal to text then
          set hasText to true
        else if itemClass is equal to TIFF picture or itemClass is equal to JPEG picture or itemClass is equal to picture then
          set hasImage to true
        else if itemClass is equal to file URL or itemClass is equal to alias then
          set hasFiles to true
        end if
      end repeat

      if hasText then
        return "text"
      else if hasImage then
        return "image"
      else if hasFiles then
        return "files"
      else
        return "other"
      end if
    on error
      return "text"
    end try
  `

  const typeResult = await executeAppleScript({
    script: typeCheckScript,
    timeout: 5000,
  })
  const contentType =
    typeResult.success && typeResult.output
      ? (typeResult.output as 'text' | 'image' | 'files' | 'other')
      : 'text'

  // If text content, get the text
  if (contentType === 'text') {
    const textScript = `
      try
        set clipText to the clipboard as text
        return clipText
      on error
        return ""
      end try
    `

    const textResult = await executeAppleScript({
      script: textScript,
      timeout: 5000,
    })

    if (!textResult.success) {
      return {
        success: false,
        error: textResult.error ?? 'Failed to read clipboard',
      }
    }

    return {
      success: true,
      data: {
        text: textResult.output ?? '',
        contentType: 'text',
      },
    }
  }

  // Non-text content
  return {
    success: true,
    data: {
      contentType,
    },
  }
}

/**
 * Sets the system clipboard to the provided text content.
 *
 * @param input - Object containing the text to set
 * @returns Promise with success message or error
 *
 * @example
 * const result = await setClipboard({ text: 'Hello, World!' })
 * if (result.success) {
 *   console.log(result.message) // "Clipboard content set successfully"
 * }
 */
export async function setClipboard(
  input: SetClipboardInput,
): Promise<SetClipboardResult> {
  const { text } = input

  // Sanitize the text for AppleScript interpolation
  const sanitizedText = sanitizeString(text)

  // Set clipboard using AppleScript
  const script = `set the clipboard to "${sanitizedText}"`

  const result = await executeAppleScript({ script, timeout: 5000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to set clipboard content',
    }
  }

  return {
    success: true,
    message: 'Clipboard content set successfully',
  }
}
