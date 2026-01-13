/**
 * Scroll and Navigation Tools Tests
 *
 * Tests for scroll tools: scroll, scroll_to_element.
 * Uses TDD approach - tests written before implementation.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */

import { platform } from 'os'

import { describe, it, expect } from 'vitest'

import {
  scroll,
  scrollToElement,
  ScrollSchema,
  ScrollToElementSchema,
} from '../../src/tools/scroll.js'

/**
 * Determines if the current platform is macOS.
 * @returns True if running on macOS (darwin)
 */
const isMacOS = platform() === 'darwin'

/**
 * Skip helper for macOS-only tests.
 */
const itMacOS = isMacOS ? it : it.skip

describe('ScrollTools', () => {
  describe('Module Exports', () => {
    it('should export scroll function', () => {
      expect(typeof scroll).toBe('function')
    })

    it('should export scrollToElement function', () => {
      expect(typeof scrollToElement).toBe('function')
    })

    it('should export ScrollSchema', () => {
      expect(ScrollSchema).toBeDefined()
    })

    it('should export ScrollToElementSchema', () => {
      expect(ScrollToElementSchema).toBeDefined()
    })
  })

  describe('ScrollSchema', () => {
    it('should require direction parameter', () => {
      const result = ScrollSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should accept valid direction', () => {
      const result = ScrollSchema.safeParse({ direction: 'down' })
      expect(result.success).toBe(true)
    })

    it('should accept all direction values', () => {
      const directions = ['up', 'down', 'left', 'right']
      for (const direction of directions) {
        const result = ScrollSchema.safeParse({ direction })
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid direction', () => {
      const result = ScrollSchema.safeParse({ direction: 'invalid' })
      expect(result.success).toBe(false)
    })

    it('should accept optional amount parameter', () => {
      const result = ScrollSchema.safeParse({ direction: 'down', amount: 200 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.amount).toBe(200)
      }
    })

    it('should default amount to 100', () => {
      const result = ScrollSchema.safeParse({ direction: 'down' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.amount).toBe(100)
      }
    })

    it('should accept optional x coordinate', () => {
      const result = ScrollSchema.safeParse({
        direction: 'down',
        x: 500,
      })
      expect(result.success).toBe(true)
    })

    it('should accept optional y coordinate', () => {
      const result = ScrollSchema.safeParse({
        direction: 'down',
        y: 300,
      })
      expect(result.success).toBe(true)
    })

    it('should accept both x and y coordinates', () => {
      const result = ScrollSchema.safeParse({
        direction: 'down',
        x: 500,
        y: 300,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.x).toBe(500)
        expect(result.data.y).toBe(300)
      }
    })

    it('should reject negative amount', () => {
      const result = ScrollSchema.safeParse({ direction: 'down', amount: -10 })
      expect(result.success).toBe(false)
    })
  })

  describe('ScrollToElementSchema', () => {
    it('should require appName and elementPath parameters', () => {
      const result = ScrollToElementSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should require appName', () => {
      const result = ScrollToElementSchema.safeParse({
        elementPath: 'window1/button1',
      })
      expect(result.success).toBe(false)
    })

    it('should require elementPath', () => {
      const result = ScrollToElementSchema.safeParse({
        appName: 'Safari',
      })
      expect(result.success).toBe(false)
    })

    it('should accept valid input', () => {
      const result = ScrollToElementSchema.safeParse({
        appName: 'Safari',
        elementPath: 'window1/scrollArea1/button1',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('scroll', () => {
    it('should return success property', async () => {
      const result = await scroll({ direction: 'down' })
      expect(typeof result.success).toBe('boolean')
    })

    it('should return message or error property', async () => {
      const result = await scroll({ direction: 'down' })
      expect(result.message !== undefined || result.error !== undefined).toBe(
        true,
      )
    })

    itMacOS('should scroll down', async () => {
      const result = await scroll({ direction: 'down' })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
        expect(result.message).toContain('Scrolled')
        expect(result.message).toContain('down')
      }
    })

    itMacOS('should scroll up', async () => {
      const result = await scroll({ direction: 'up' })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
        expect(result.message).toContain('up')
      }
    })

    itMacOS('should scroll left', async () => {
      const result = await scroll({ direction: 'left' })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
        expect(result.message).toContain('left')
      }
    })

    itMacOS('should scroll right', async () => {
      const result = await scroll({ direction: 'right' })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
        expect(result.message).toContain('right')
      }
    })

    itMacOS('should scroll with specified amount', async () => {
      const result = await scroll({ direction: 'down', amount: 200 })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
        expect(result.message).toContain('200')
      }
    })

    itMacOS('should scroll at specified coordinates', async () => {
      const result = await scroll({
        direction: 'down',
        x: 500,
        y: 300,
      })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
        expect(result.message).toContain('500')
        expect(result.message).toContain('300')
      }
    })
  })

  describe('scrollToElement', () => {
    it('should return success property', async () => {
      const result = await scrollToElement({
        appName: 'Finder',
        elementPath: 'window1/scrollArea1/button1',
      })
      expect(typeof result.success).toBe('boolean')
    })

    itMacOS('should attempt to scroll to element', async () => {
      // This will likely fail because the element doesn't exist,
      // but it should return an error, not crash
      const result = await scrollToElement({
        appName: 'Finder',
        elementPath: 'window1/nonexistent',
      })

      // Either succeeds or returns proper error (not Accessibility)
      if (!result.success && result.error?.includes('Accessibility')) {
        // Permission issue
        expect(result.error).toContain('Accessibility')
      } else if (!result.success) {
        // Element not found - expected
        // Various error messages are acceptable as long as an error is returned
        expect(result.error).toBeDefined()
        expect(result.error!.length).toBeGreaterThan(0)
      }
      // If success, that's also acceptable (element might exist in some Finder states)
    })

    itMacOS('should require valid app name', async () => {
      const result = await scrollToElement({
        appName: 'NonExistentApp12345',
        elementPath: 'window1/button1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
