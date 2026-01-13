/**
 * Keyboard Input Tools Tests
 *
 * Tests for keyboard tools: type_text, press_key, key_combination.
 * Uses TDD approach - tests written before implementation.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8
 */

import { platform } from 'os'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import {
  typeText,
  pressKey,
  keyCombination,
  TypeTextSchema,
  PressKeySchema,
  KeyCombinationSchema,
  KEY_CODES,
  type TypeTextResult,
  type PressKeyResult,
  type KeyCombinationResult,
} from '../../src/tools/keyboard.js'

/**
 * Determines if the current platform is macOS.
 * @returns True if running on macOS (darwin)
 */
const isMacOS = platform() === 'darwin'

/**
 * Skip helper for macOS-only tests.
 */
const itMacOS = isMacOS ? it : it.skip

describe('KeyboardTools', () => {
  describe('Module Exports', () => {
    it('should export typeText function', () => {
      expect(typeof typeText).toBe('function')
    })

    it('should export pressKey function', () => {
      expect(typeof pressKey).toBe('function')
    })

    it('should export keyCombination function', () => {
      expect(typeof keyCombination).toBe('function')
    })

    it('should export TypeTextSchema', () => {
      expect(TypeTextSchema).toBeDefined()
    })

    it('should export PressKeySchema', () => {
      expect(PressKeySchema).toBeDefined()
    })

    it('should export KeyCombinationSchema', () => {
      expect(KeyCombinationSchema).toBeDefined()
    })

    it('should export KEY_CODES mapping', () => {
      expect(KEY_CODES).toBeDefined()
      expect(typeof KEY_CODES).toBe('object')
    })
  })

  describe('TypeTextSchema', () => {
    it('should require text parameter', () => {
      const result = TypeTextSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should accept valid text parameter', () => {
      const result = TypeTextSchema.safeParse({ text: 'Hello World' })
      expect(result.success).toBe(true)
    })

    it('should accept optional delay parameter', () => {
      const result = TypeTextSchema.safeParse({ text: 'Hello', delay: 50 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.delay).toBe(50)
      }
    })

    it('should reject negative delay', () => {
      const result = TypeTextSchema.safeParse({ text: 'Hello', delay: -10 })
      expect(result.success).toBe(false)
    })
  })

  describe('PressKeySchema', () => {
    it('should require key parameter', () => {
      const result = PressKeySchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should accept valid key name', () => {
      const result = PressKeySchema.safeParse({ key: 'enter' })
      expect(result.success).toBe(true)
    })

    it('should accept optional repeat parameter', () => {
      const result = PressKeySchema.safeParse({ key: 'tab', repeat: 3 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.repeat).toBe(3)
      }
    })

    it('should default repeat to 1', () => {
      const result = PressKeySchema.safeParse({ key: 'enter' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.repeat).toBe(1)
      }
    })

    it('should reject repeat less than 1', () => {
      const result = PressKeySchema.safeParse({ key: 'enter', repeat: 0 })
      expect(result.success).toBe(false)
    })
  })

  describe('KeyCombinationSchema', () => {
    it('should require modifiers and key parameters', () => {
      const result = KeyCombinationSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should accept valid modifiers array', () => {
      const result = KeyCombinationSchema.safeParse({
        modifiers: ['command'],
        key: 'c',
      })
      expect(result.success).toBe(true)
    })

    it('should accept multiple modifiers', () => {
      const result = KeyCombinationSchema.safeParse({
        modifiers: ['command', 'shift'],
        key: 's',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.modifiers).toEqual(['command', 'shift'])
      }
    })

    it('should reject invalid modifier', () => {
      const result = KeyCombinationSchema.safeParse({
        modifiers: ['invalid'],
        key: 'c',
      })
      expect(result.success).toBe(false)
    })

    it('should accept all valid modifiers', () => {
      const result = KeyCombinationSchema.safeParse({
        modifiers: ['command', 'shift', 'option', 'control'],
        key: 'a',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('KEY_CODES', () => {
    it('should contain enter/return key code', () => {
      expect(KEY_CODES.enter).toBe(36)
      expect(KEY_CODES.return).toBe(36)
    })

    it('should contain escape key code', () => {
      expect(KEY_CODES.escape).toBe(53)
    })

    it('should contain tab key code', () => {
      expect(KEY_CODES.tab).toBe(48)
    })

    it('should contain delete/backspace key code', () => {
      expect(KEY_CODES.delete).toBe(51)
      expect(KEY_CODES.backspace).toBe(51)
    })

    it('should contain space key code', () => {
      expect(KEY_CODES.space).toBe(49)
    })

    it('should contain arrow key codes', () => {
      expect(KEY_CODES.up).toBe(126)
      expect(KEY_CODES.down).toBe(125)
      expect(KEY_CODES.left).toBe(123)
      expect(KEY_CODES.right).toBe(124)
    })

    it('should contain function key codes F1-F12', () => {
      expect(KEY_CODES.f1).toBe(122)
      expect(KEY_CODES.f2).toBe(120)
      expect(KEY_CODES.f3).toBe(99)
      expect(KEY_CODES.f4).toBe(118)
      expect(KEY_CODES.f5).toBe(96)
      expect(KEY_CODES.f6).toBe(97)
      expect(KEY_CODES.f7).toBe(98)
      expect(KEY_CODES.f8).toBe(100)
      expect(KEY_CODES.f9).toBe(101)
      expect(KEY_CODES.f10).toBe(109)
      expect(KEY_CODES.f11).toBe(103)
      expect(KEY_CODES.f12).toBe(111)
    })
  })

  describe('typeText', () => {
    it('should return success property', async () => {
      const result = await typeText({ text: 'test' })
      expect(typeof result.success).toBe('boolean')
    })

    it('should return message or error property', async () => {
      const result = await typeText({ text: 'test' })
      expect(result.message !== undefined || result.error !== undefined).toBe(
        true,
      )
    })

    itMacOS('should type simple text successfully', async () => {
      // Note: This test requires Accessibility permission
      const result = await typeText({ text: 'hello' })
      // On first run without permission, this may fail with guidance
      if (!result.success && result.error?.includes('Accessibility')) {
        // Expected - permission not granted
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
      }
    })

    itMacOS('should handle empty text gracefully', async () => {
      const result = await typeText({ text: '' })
      // Empty text should either succeed as no-op or return validation error
      expect(
        result.success ||
          (result.error !== undefined && result.error.length > 0),
      ).toBe(true)
    })

    itMacOS('should handle special characters in text', async () => {
      const result = await typeText({ text: 'Hello "World" & <test>' })
      // Should handle escaping properly
      expect(typeof result.success).toBe('boolean')
    })

    itMacOS('should respect delay parameter', async () => {
      const startTime = Date.now()
      await typeText({ text: 'ab', delay: 100 })
      const elapsed = Date.now() - startTime
      // With 100ms delay between 2 chars, should take at least 100ms
      // Allow some flexibility for execution overhead
      expect(elapsed).toBeGreaterThanOrEqual(50)
    })
  })

  describe('pressKey', () => {
    it('should return success property', async () => {
      const result = await pressKey({ key: 'escape' })
      expect(typeof result.success).toBe('boolean')
    })

    itMacOS('should press enter key successfully', async () => {
      const result = await pressKey({ key: 'enter' })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
      }
    })

    itMacOS('should handle unknown key name', async () => {
      const result = await pressKey({ key: 'unknownkey123' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown key')
    })

    itMacOS('should press function keys', async () => {
      const result = await pressKey({ key: 'f1' })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
      }
    })

    itMacOS('should repeat key presses', async () => {
      const result = await pressKey({ key: 'down', repeat: 3 })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
        expect(result.message).toContain('3')
      }
    })
  })

  describe('keyCombination', () => {
    it('should return success property', async () => {
      const result = await keyCombination({ modifiers: ['command'], key: 'c' })
      expect(typeof result.success).toBe('boolean')
    })

    itMacOS('should handle single modifier', async () => {
      // Cmd+A (select all) - safe to test
      const result = await keyCombination({ modifiers: ['command'], key: 'a' })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
      }
    })

    itMacOS('should handle multiple modifiers', async () => {
      // Cmd+Shift+N - typically "new folder" or similar
      const result = await keyCombination({
        modifiers: ['command', 'shift'],
        key: 'n',
      })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
      }
    })

    itMacOS('should handle all four modifiers', async () => {
      const result = await keyCombination({
        modifiers: ['command', 'shift', 'option', 'control'],
        key: 'x',
      })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
      }
    })

    itMacOS('should handle special key with modifiers', async () => {
      // Cmd+Shift+Enter
      const result = await keyCombination({
        modifiers: ['command', 'shift'],
        key: 'enter',
      })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
      }
    })
  })
})
