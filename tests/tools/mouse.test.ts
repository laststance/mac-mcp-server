/**
 * Mouse Control Tools Tests
 *
 * Tests for mouse tools: click, double_click, move_mouse, drag.
 * Uses TDD approach - tests written before implementation.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 11.7
 */

import { platform } from 'os'

import { describe, it, expect } from 'vitest'

import {
  click,
  doubleClick,
  moveMouse,
  drag,
  ClickSchema,
  DoubleClickSchema,
  MoveMouseSchema,
  DragSchema,
  type ClickResult,
  type DoubleClickResult,
  type MoveMouseResult,
  type DragResult,
} from '../../src/tools/mouse.js'

/**
 * Determines if the current platform is macOS.
 * @returns True if running on macOS (darwin)
 */
const isMacOS = platform() === 'darwin'

/**
 * Skip helper for macOS-only tests.
 */
const itMacOS = isMacOS ? it : it.skip

describe('MouseTools', () => {
  describe('Module Exports', () => {
    it('should export click function', () => {
      expect(typeof click).toBe('function')
    })

    it('should export doubleClick function', () => {
      expect(typeof doubleClick).toBe('function')
    })

    it('should export moveMouse function', () => {
      expect(typeof moveMouse).toBe('function')
    })

    it('should export drag function', () => {
      expect(typeof drag).toBe('function')
    })

    it('should export ClickSchema', () => {
      expect(ClickSchema).toBeDefined()
    })

    it('should export DoubleClickSchema', () => {
      expect(DoubleClickSchema).toBeDefined()
    })

    it('should export MoveMouseSchema', () => {
      expect(MoveMouseSchema).toBeDefined()
    })

    it('should export DragSchema', () => {
      expect(DragSchema).toBeDefined()
    })
  })

  describe('ClickSchema', () => {
    it('should require x and y coordinates', () => {
      const result = ClickSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should accept valid coordinates', () => {
      const result = ClickSchema.safeParse({ x: 100, y: 200 })
      expect(result.success).toBe(true)
    })

    it('should accept optional button parameter', () => {
      const result = ClickSchema.safeParse({
        x: 100,
        y: 200,
        button: 'right',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.button).toBe('right')
      }
    })

    it('should default button to left', () => {
      const result = ClickSchema.safeParse({ x: 100, y: 200 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.button).toBe('left')
      }
    })

    it('should accept all button types', () => {
      const leftResult = ClickSchema.safeParse({
        x: 100,
        y: 200,
        button: 'left',
      })
      const rightResult = ClickSchema.safeParse({
        x: 100,
        y: 200,
        button: 'right',
      })
      const middleResult = ClickSchema.safeParse({
        x: 100,
        y: 200,
        button: 'middle',
      })

      expect(leftResult.success).toBe(true)
      expect(rightResult.success).toBe(true)
      expect(middleResult.success).toBe(true)
    })

    it('should reject invalid button type', () => {
      const result = ClickSchema.safeParse({
        x: 100,
        y: 200,
        button: 'invalid',
      })
      expect(result.success).toBe(false)
    })

    it('should accept optional modifiers parameter', () => {
      const result = ClickSchema.safeParse({
        x: 100,
        y: 200,
        modifiers: ['command', 'shift'],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.modifiers).toEqual(['command', 'shift'])
      }
    })

    it('should accept all valid modifiers', () => {
      const result = ClickSchema.safeParse({
        x: 100,
        y: 200,
        modifiers: ['command', 'shift', 'option', 'control'],
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid modifier', () => {
      const result = ClickSchema.safeParse({
        x: 100,
        y: 200,
        modifiers: ['invalid'],
      })
      expect(result.success).toBe(false)
    })

    it('should accept negative coordinates', () => {
      // Some multi-monitor setups have negative coordinates
      const result = ClickSchema.safeParse({ x: -100, y: 200 })
      expect(result.success).toBe(true)
    })
  })

  describe('DoubleClickSchema', () => {
    it('should require x and y coordinates', () => {
      const result = DoubleClickSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should accept valid coordinates', () => {
      const result = DoubleClickSchema.safeParse({ x: 100, y: 200 })
      expect(result.success).toBe(true)
    })
  })

  describe('MoveMouseSchema', () => {
    it('should require x and y coordinates', () => {
      const result = MoveMouseSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should accept valid coordinates', () => {
      const result = MoveMouseSchema.safeParse({ x: 500, y: 300 })
      expect(result.success).toBe(true)
    })
  })

  describe('DragSchema', () => {
    it('should require all four coordinates', () => {
      const result = DragSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should require startX and startY', () => {
      const result = DragSchema.safeParse({ endX: 300, endY: 400 })
      expect(result.success).toBe(false)
    })

    it('should require endX and endY', () => {
      const result = DragSchema.safeParse({ startX: 100, startY: 200 })
      expect(result.success).toBe(false)
    })

    it('should accept valid coordinates', () => {
      const result = DragSchema.safeParse({
        startX: 100,
        startY: 200,
        endX: 300,
        endY: 400,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('click', () => {
    it('should return success property', async () => {
      const result = await click({ x: 100, y: 100 })
      expect(typeof result.success).toBe('boolean')
    })

    it('should return message or error property', async () => {
      const result = await click({ x: 100, y: 100 })
      expect(result.message !== undefined || result.error !== undefined).toBe(
        true,
      )
    })

    itMacOS('should perform left click at coordinates', async () => {
      const result = await click({ x: 100, y: 100 })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
        expect(result.message).toContain('left')
        expect(result.message).toContain('100')
      }
    })

    itMacOS('should perform right click', async () => {
      const result = await click({ x: 100, y: 100, button: 'right' })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
        expect(result.message).toContain('right')
      }
    })

    itMacOS('should perform middle click', async () => {
      const result = await click({ x: 100, y: 100, button: 'middle' })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
        expect(result.message).toContain('middle')
      }
    })

    itMacOS('should support modifier keys during click', async () => {
      const result = await click({
        x: 100,
        y: 100,
        modifiers: ['command'],
      })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
        expect(result.message).toContain('command')
      }
    })

    itMacOS('should support multiple modifiers during click', async () => {
      const result = await click({
        x: 100,
        y: 100,
        modifiers: ['command', 'shift'],
      })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
      }
    })
  })

  describe('doubleClick', () => {
    it('should return success property', async () => {
      const result = await doubleClick({ x: 100, y: 100 })
      expect(typeof result.success).toBe('boolean')
    })

    itMacOS('should perform double-click at coordinates', async () => {
      const result = await doubleClick({ x: 100, y: 100 })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
        expect(result.message).toContain('Double-clicked')
        expect(result.message).toContain('100')
      }
    })
  })

  describe('moveMouse', () => {
    it('should return success property', async () => {
      const result = await moveMouse({ x: 200, y: 200 })
      expect(typeof result.success).toBe('boolean')
    })

    itMacOS('should move cursor to coordinates', async () => {
      const result = await moveMouse({ x: 200, y: 200 })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
        expect(result.message).toContain('Moved')
        expect(result.message).toContain('200')
      }
    })
  })

  describe('drag', () => {
    it('should return success property', async () => {
      const result = await drag({
        startX: 100,
        startY: 100,
        endX: 200,
        endY: 200,
      })
      expect(typeof result.success).toBe('boolean')
    })

    itMacOS('should perform drag operation', async () => {
      const result = await drag({
        startX: 100,
        startY: 100,
        endX: 200,
        endY: 200,
      })
      if (!result.success && result.error?.includes('Accessibility')) {
        expect(result.error).toContain('Accessibility')
      } else {
        expect(result.success).toBe(true)
        expect(result.message).toContain('Dragged')
        expect(result.message).toContain('100')
        expect(result.message).toContain('200')
      }
    })
  })
})
