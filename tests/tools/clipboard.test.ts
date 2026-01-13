/**
 * Clipboard Tools Tests
 *
 * Tests for clipboard management tools: get_clipboard, set_clipboard.
 * Uses TDD approach - tests written before implementation.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { platform } from 'os'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  getClipboard,
  setClipboard,
  GetClipboardSchema,
  SetClipboardSchema,
  type ClipboardContent,
} from '../../src/tools/clipboard.js'

/**
 * Determines if the current platform is macOS.
 * @returns True if running on macOS (darwin)
 */
const isMacOS = platform() === 'darwin'

/**
 * Skip helper for macOS-only tests.
 */
const itMacOS = isMacOS ? it : it.skip

describe('ClipboardTools', () => {
  // Store original clipboard content to restore after tests
  let originalClipboard: string | null = null

  beforeEach(async () => {
    if (isMacOS) {
      // Save original clipboard content before each test
      const result = await getClipboard()
      if (result.success && result.data?.text) {
        const text = result.data.text
        originalClipboard = text
      }
    }
  })

  afterEach(async () => {
    const savedClipboard = originalClipboard
    if (isMacOS && savedClipboard !== null) {
      // Restore original clipboard content
      originalClipboard = null
      await setClipboard({ text: savedClipboard })
    }
  })

  describe('Module Exports', () => {
    it('should export getClipboard function', () => {
      expect(typeof getClipboard).toBe('function')
    })

    it('should export setClipboard function', () => {
      expect(typeof setClipboard).toBe('function')
    })

    it('should export GetClipboardSchema', () => {
      expect(GetClipboardSchema).toBeDefined()
    })

    it('should export SetClipboardSchema', () => {
      expect(SetClipboardSchema).toBeDefined()
    })
  })

  describe('Zod Schemas', () => {
    it('GetClipboardSchema should accept empty object', () => {
      const result = GetClipboardSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('SetClipboardSchema should accept text string', () => {
      const result = SetClipboardSchema.safeParse({ text: 'Hello' })
      expect(result.success).toBe(true)
    })

    it('SetClipboardSchema should reject missing text', () => {
      const result = SetClipboardSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('SetClipboardSchema should reject non-string text', () => {
      const result = SetClipboardSchema.safeParse({ text: 123 })
      expect(result.success).toBe(false)
    })
  })

  describe('getClipboard (Req 6.1)', () => {
    itMacOS('should return text content when clipboard has text', async () => {
      // First set known text to clipboard
      await setClipboard({ text: 'Test clipboard content' })

      const result = await getClipboard()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.text).toBe('Test clipboard content')
      }
    })

    itMacOS('should return contentType as text for text content', async () => {
      await setClipboard({ text: 'Test' })

      const result = await getClipboard()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.contentType).toBe('text')
      }
    })

    itMacOS(
      'should indicate content type when clipboard contains non-text (Req 6.3)',
      async () => {
        // This test will pass if clipboard has non-text - contentType should not be 'text'
        // We can only test the interface structure since we can't easily set non-text content
        const result = await getClipboard()
        expect(result.success).toBe(true)
        if (result.success && result.data) {
          expect(['text', 'image', 'files', 'other']).toContain(
            result.data.contentType,
          )
        }
      },
    )

    itMacOS('should handle empty clipboard gracefully', async () => {
      // Set and then clear clipboard
      await setClipboard({ text: '' })

      const result = await getClipboard()
      expect(result.success).toBe(true)
      // Empty clipboard should still return success
    })

    itMacOS(
      'should return all fields in ClipboardContent interface',
      async () => {
        await setClipboard({ text: 'Test' })

        const result = await getClipboard()
        expect(result.success).toBe(true)
        if (result.success && result.data) {
          const content: ClipboardContent = result.data
          expect(content).toHaveProperty('contentType')
          // text is optional, may be undefined for non-text content
          if (content.contentType === 'text') {
            expect(content).toHaveProperty('text')
          }
        }
      },
    )
  })

  describe('setClipboard (Req 6.2)', () => {
    itMacOS('should set clipboard to provided text content', async () => {
      const testText = 'Hello, World!'

      const setResult = await setClipboard({ text: testText })
      expect(setResult.success).toBe(true)

      // Verify by reading back
      const getResult = await getClipboard()
      expect(getResult.success).toBe(true)
      if (getResult.success && getResult.data) {
        expect(getResult.data.text).toBe(testText)
      }
    })

    itMacOS(
      'should confirm successful clipboard operation (Req 6.4)',
      async () => {
        const result = await setClipboard({ text: 'Test' })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.message).toBeDefined()
          expect(typeof result.message).toBe('string')
        }
      },
    )

    itMacOS('should handle unicode text', async () => {
      const unicodeText = 'Hello, \u4e16\u754c! \u2764\ufe0f'

      await setClipboard({ text: unicodeText })
      const result = await getClipboard()

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.text).toBe(unicodeText)
      }
    })

    itMacOS('should handle multiline text', async () => {
      const multilineText = 'Line 1\nLine 2\nLine 3'

      await setClipboard({ text: multilineText })
      const result = await getClipboard()

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.text).toBe(multilineText)
      }
    })

    itMacOS('should handle text with special characters', async () => {
      const specialText =
        'Special: "quotes" and \'apostrophes\' and \\backslash'

      await setClipboard({ text: specialText })
      const result = await getClipboard()

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.text).toBe(specialText)
      }
    })

    itMacOS('should handle empty string', async () => {
      const result = await setClipboard({ text: '' })
      expect(result.success).toBe(true)
    })
  })

  describe('Return Type Interface', () => {
    itMacOS(
      'getClipboard should return success result with data or error',
      async () => {
        const result = await getClipboard()
        if (result.success) {
          expect(result.data).toBeDefined()
          expect(result.error).toBeUndefined()
        } else {
          expect(result.error).toBeDefined()
        }
      },
    )

    itMacOS(
      'setClipboard should return success result with message or error',
      async () => {
        const result = await setClipboard({ text: 'Test' })
        if (result.success) {
          expect(result.message).toBeDefined()
          expect(result.error).toBeUndefined()
        } else {
          expect(result.error).toBeDefined()
        }
      },
    )
  })
})
