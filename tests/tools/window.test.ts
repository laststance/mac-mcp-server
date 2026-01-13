/**
 * Window Management Tools Tests
 *
 * Tests for window tools: list_windows, focus_window, move_window, resize_window, minimize_window.
 * Uses TDD approach - tests written before implementation.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { execSync } from 'child_process'
import { platform } from 'os'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import {
  listWindows,
  focusWindow,
  moveWindow,
  resizeWindow,
  minimizeWindow,
  ListWindowsSchema,
  FocusWindowSchema,
  MoveWindowSchema,
  ResizeWindowSchema,
  MinimizeWindowSchema,
  type WindowInfo,
} from '../../src/tools/window.js'

/**
 * Determines if the current platform is macOS.
 * @returns True if running on macOS (darwin)
 */
const isMacOS = platform() === 'darwin'

/**
 * Skip helper for macOS-only tests.
 */
const itMacOS = isMacOS ? it : it.skip

/**
 * Helper to ensure a Finder window exists and is not minimized for testing.
 * Opens a new Finder window if needed, which also unminimizes any existing windows.
 */
async function ensureFinderWindow(): Promise<void> {
  if (!isMacOS) return

  // Open Finder with home directory - this will also unminimize windows
  execSync('open -a Finder ~', { timeout: 5000 })

  // Wait for window to open/unminimize
  await new Promise((r) => setTimeout(r, 500))

  // Verify we have a window
  const listResult = await listWindows({ appName: 'Finder' })
  if (!listResult.data || listResult.data.length === 0) {
    // Try one more time
    execSync('open -a Finder ~', { timeout: 5000 })
    await new Promise((r) => setTimeout(r, 1000))
  }
}

describe('WindowTools', () => {
  describe('Module Exports', () => {
    it('should export listWindows function', () => {
      expect(typeof listWindows).toBe('function')
    })

    it('should export focusWindow function', () => {
      expect(typeof focusWindow).toBe('function')
    })

    it('should export moveWindow function', () => {
      expect(typeof moveWindow).toBe('function')
    })

    it('should export resizeWindow function', () => {
      expect(typeof resizeWindow).toBe('function')
    })

    it('should export minimizeWindow function', () => {
      expect(typeof minimizeWindow).toBe('function')
    })

    it('should export ListWindowsSchema', () => {
      expect(ListWindowsSchema).toBeDefined()
    })

    it('should export FocusWindowSchema', () => {
      expect(FocusWindowSchema).toBeDefined()
    })

    it('should export MoveWindowSchema', () => {
      expect(MoveWindowSchema).toBeDefined()
    })

    it('should export ResizeWindowSchema', () => {
      expect(ResizeWindowSchema).toBeDefined()
    })

    it('should export MinimizeWindowSchema', () => {
      expect(MinimizeWindowSchema).toBeDefined()
    })
  })

  describe('Zod Schemas', () => {
    describe('ListWindowsSchema', () => {
      it('should accept empty object', () => {
        const result = ListWindowsSchema.safeParse({})
        expect(result.success).toBe(true)
      })

      it('should accept optional appName string', () => {
        const result = ListWindowsSchema.safeParse({ appName: 'Finder' })
        expect(result.success).toBe(true)
      })

      it('should reject non-string appName', () => {
        const result = ListWindowsSchema.safeParse({ appName: 123 })
        expect(result.success).toBe(false)
      })
    })

    describe('FocusWindowSchema', () => {
      it('should accept appName with windowIndex', () => {
        const result = FocusWindowSchema.safeParse({
          appName: 'Finder',
          windowIndex: 1,
        })
        expect(result.success).toBe(true)
      })

      it('should accept appName with windowTitle', () => {
        const result = FocusWindowSchema.safeParse({
          appName: 'Finder',
          windowTitle: 'Documents',
        })
        expect(result.success).toBe(true)
      })

      it('should accept appName alone (defaults to first window)', () => {
        const result = FocusWindowSchema.safeParse({ appName: 'Finder' })
        expect(result.success).toBe(true)
      })

      it('should reject missing appName', () => {
        const result = FocusWindowSchema.safeParse({ windowIndex: 1 })
        expect(result.success).toBe(false)
      })

      it('should reject non-positive windowIndex', () => {
        const result = FocusWindowSchema.safeParse({
          appName: 'Finder',
          windowIndex: 0,
        })
        expect(result.success).toBe(false)
      })

      it('should reject negative windowIndex', () => {
        const result = FocusWindowSchema.safeParse({
          appName: 'Finder',
          windowIndex: -1,
        })
        expect(result.success).toBe(false)
      })
    })

    describe('MoveWindowSchema', () => {
      it('should accept appName with x and y coordinates', () => {
        const result = MoveWindowSchema.safeParse({
          appName: 'Finder',
          x: 100,
          y: 200,
        })
        expect(result.success).toBe(true)
      })

      it('should accept with windowIndex', () => {
        const result = MoveWindowSchema.safeParse({
          appName: 'Finder',
          windowIndex: 1,
          x: 100,
          y: 200,
        })
        expect(result.success).toBe(true)
      })

      it('should accept with windowTitle', () => {
        const result = MoveWindowSchema.safeParse({
          appName: 'Finder',
          windowTitle: 'Documents',
          x: 100,
          y: 200,
        })
        expect(result.success).toBe(true)
      })

      it('should reject missing x coordinate', () => {
        const result = MoveWindowSchema.safeParse({
          appName: 'Finder',
          y: 200,
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing y coordinate', () => {
        const result = MoveWindowSchema.safeParse({
          appName: 'Finder',
          x: 100,
        })
        expect(result.success).toBe(false)
      })

      it('should accept zero coordinates', () => {
        const result = MoveWindowSchema.safeParse({
          appName: 'Finder',
          x: 0,
          y: 0,
        })
        expect(result.success).toBe(true)
      })

      it('should accept negative coordinates', () => {
        const result = MoveWindowSchema.safeParse({
          appName: 'Finder',
          x: -100,
          y: -50,
        })
        expect(result.success).toBe(true)
      })
    })

    describe('ResizeWindowSchema', () => {
      it('should accept appName with width and height', () => {
        const result = ResizeWindowSchema.safeParse({
          appName: 'Finder',
          width: 800,
          height: 600,
        })
        expect(result.success).toBe(true)
      })

      it('should accept with windowIndex', () => {
        const result = ResizeWindowSchema.safeParse({
          appName: 'Finder',
          windowIndex: 1,
          width: 800,
          height: 600,
        })
        expect(result.success).toBe(true)
      })

      it('should reject missing width', () => {
        const result = ResizeWindowSchema.safeParse({
          appName: 'Finder',
          height: 600,
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing height', () => {
        const result = ResizeWindowSchema.safeParse({
          appName: 'Finder',
          width: 800,
        })
        expect(result.success).toBe(false)
      })

      it('should reject non-positive width', () => {
        const result = ResizeWindowSchema.safeParse({
          appName: 'Finder',
          width: 0,
          height: 600,
        })
        expect(result.success).toBe(false)
      })

      it('should reject non-positive height', () => {
        const result = ResizeWindowSchema.safeParse({
          appName: 'Finder',
          width: 800,
          height: 0,
        })
        expect(result.success).toBe(false)
      })

      it('should reject negative dimensions', () => {
        const result = ResizeWindowSchema.safeParse({
          appName: 'Finder',
          width: -100,
          height: -50,
        })
        expect(result.success).toBe(false)
      })
    })

    describe('MinimizeWindowSchema', () => {
      it('should accept appName alone', () => {
        const result = MinimizeWindowSchema.safeParse({ appName: 'Finder' })
        expect(result.success).toBe(true)
      })

      it('should accept with windowIndex', () => {
        const result = MinimizeWindowSchema.safeParse({
          appName: 'Finder',
          windowIndex: 1,
        })
        expect(result.success).toBe(true)
      })

      it('should accept with windowTitle', () => {
        const result = MinimizeWindowSchema.safeParse({
          appName: 'Finder',
          windowTitle: 'Documents',
        })
        expect(result.success).toBe(true)
      })

      it('should reject missing appName', () => {
        const result = MinimizeWindowSchema.safeParse({})
        expect(result.success).toBe(false)
      })
    })
  })

  describe('listWindows (Req 4.1, 4.2)', () => {
    itMacOS(
      'should return array of windows with required properties (Req 4.1)',
      async () => {
        const result = await listWindows({})

        expect(result.success).toBe(true)
        expect(Array.isArray(result.data)).toBe(true)

        if (result.success && result.data && result.data.length > 0) {
          const window: WindowInfo = result.data[0] as WindowInfo

          // Check required properties exist
          expect(window).toHaveProperty('title')
          expect(window).toHaveProperty('appName')
          expect(window).toHaveProperty('index')
          expect(window).toHaveProperty('position')
          expect(window).toHaveProperty('size')

          // Check types
          expect(typeof window.title).toBe('string')
          expect(typeof window.appName).toBe('string')
          expect(typeof window.index).toBe('number')

          // Check nested objects
          expect(window.position).toHaveProperty('x')
          expect(window.position).toHaveProperty('y')
          expect(typeof window.position.x).toBe('number')
          expect(typeof window.position.y).toBe('number')

          expect(window.size).toHaveProperty('width')
          expect(window.size).toHaveProperty('height')
          expect(typeof window.size.width).toBe('number')
          expect(typeof window.size.height).toBe('number')
        }
      },
      30000,
    )

    itMacOS(
      'should filter windows by application name (Req 4.2)',
      async () => {
        // Filter for Finder windows
        const finderResult = await listWindows({ appName: 'Finder' })

        expect(finderResult.success).toBe(true)

        if (finderResult.success && finderResult.data) {
          // All returned windows should be from Finder
          for (const window of finderResult.data) {
            expect(window.appName).toBe('Finder')
          }
        }
      },
      30000,
    )

    itMacOS(
      'should return empty array when no windows match filter',
      async () => {
        const result = await listWindows({
          appName: 'NonExistentApp12345XYZ',
        })

        expect(result.success).toBe(true)
        expect(result.data).toEqual([])
      },
      15000,
    )

    itMacOS(
      'should return windows with 1-based indexing',
      async () => {
        const result = await listWindows({})

        if (result.success && result.data && result.data.length > 0) {
          // Find any app with windows
          const firstWindow = result.data[0]
          // Index should be 1-based (minimum 1)
          expect(firstWindow?.index).toBeGreaterThanOrEqual(1)
        }
      },
      15000,
    )
  })

  describe('focusWindow (Req 4.3)', () => {
    itMacOS(
      'should bring Finder window to front',
      async () => {
        await ensureFinderWindow()

        const result = await focusWindow({ appName: 'Finder' })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.message).toBeDefined()
        }
      },
      15000,
    )

    itMacOS(
      'should return error for non-existent application',
      async () => {
        const result = await focusWindow({
          appName: 'NonExistentApp12345XYZ',
        })

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
        expect(result.error).toContain('NonExistentApp12345XYZ')
      },
      15000,
    )

    itMacOS(
      'should focus specific window by index',
      async () => {
        await ensureFinderWindow()

        const result = await focusWindow({
          appName: 'Finder',
          windowIndex: 1,
        })

        expect(result.success).toBe(true)
      },
      15000,
    )

    itMacOS(
      'should return error for invalid window index',
      async () => {
        await ensureFinderWindow()

        const result = await focusWindow({
          appName: 'Finder',
          windowIndex: 999,
        })

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      },
      15000,
    )
  })

  describe('moveWindow (Req 4.4)', () => {
    let originalPosition: { x: number; y: number } | null = null

    beforeAll(async () => {
      if (isMacOS) {
        await ensureFinderWindow()
        // Store original position of Finder window
        const windows = await listWindows({ appName: 'Finder' })
        if (windows.success && windows.data && windows.data.length > 0) {
          originalPosition = windows.data[0]?.position ?? null
        }
      }
    })

    afterAll(async () => {
      if (isMacOS && originalPosition) {
        // Restore original position
        await moveWindow({
          appName: 'Finder',
          x: originalPosition.x,
          y: originalPosition.y,
        })
      }
    })

    itMacOS(
      'should move Finder window to specified coordinates',
      async () => {
        const newX = 100
        const newY = 100

        const result = await moveWindow({
          appName: 'Finder',
          x: newX,
          y: newY,
        })

        expect(result.success).toBe(true)

        // Verify position changed
        const windows = await listWindows({ appName: 'Finder' })
        if (windows.success && windows.data && windows.data.length > 0) {
          const pos = windows.data[0]?.position
          // Allow small tolerance for window manager adjustments
          expect(pos?.x).toBeCloseTo(newX, -1)
          expect(pos?.y).toBeCloseTo(newY, -1)
        }
      },
      30000,
    )

    itMacOS(
      'should return error for non-existent application',
      async () => {
        const result = await moveWindow({
          appName: 'NonExistentApp12345XYZ',
          x: 100,
          y: 100,
        })

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      },
      15000,
    )

    itMacOS(
      'should move window by index',
      async () => {
        const result = await moveWindow({
          appName: 'Finder',
          windowIndex: 1,
          x: 200,
          y: 200,
        })

        expect(result.success).toBe(true)
      },
      15000,
    )
  })

  describe('resizeWindow (Req 4.5)', () => {
    let originalSize: { width: number; height: number } | null = null

    beforeAll(async () => {
      if (isMacOS) {
        await ensureFinderWindow()
        // Store original size of Finder window
        const windows = await listWindows({ appName: 'Finder' })
        if (windows.success && windows.data && windows.data.length > 0) {
          originalSize = windows.data[0]?.size ?? null
        }
      }
    })

    afterAll(async () => {
      if (isMacOS && originalSize) {
        // Restore original size
        await resizeWindow({
          appName: 'Finder',
          width: originalSize.width,
          height: originalSize.height,
        })
      }
    })

    itMacOS(
      'should resize Finder window to specified dimensions',
      async () => {
        const newWidth = 800
        const newHeight = 600

        const result = await resizeWindow({
          appName: 'Finder',
          width: newWidth,
          height: newHeight,
        })

        expect(result.success).toBe(true)

        // Verify size changed
        const windows = await listWindows({ appName: 'Finder' })
        if (windows.success && windows.data && windows.data.length > 0) {
          const size = windows.data[0]?.size
          // Allow tolerance for window constraints
          expect(size?.width).toBeCloseTo(newWidth, -1)
          expect(size?.height).toBeCloseTo(newHeight, -1)
        }
      },
      30000,
    )

    itMacOS(
      'should return error for non-existent application',
      async () => {
        const result = await resizeWindow({
          appName: 'NonExistentApp12345XYZ',
          width: 800,
          height: 600,
        })

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      },
      15000,
    )

    itMacOS(
      'should resize window by index',
      async () => {
        const result = await resizeWindow({
          appName: 'Finder',
          windowIndex: 1,
          width: 900,
          height: 700,
        })

        expect(result.success).toBe(true)
      },
      15000,
    )
  })

  describe('minimizeWindow (Req 4.6)', () => {
    itMacOS(
      'should minimize Finder window',
      async () => {
        await ensureFinderWindow()

        const result = await minimizeWindow({ appName: 'Finder' })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.message).toBeDefined()
        }

        // Unminimize the window to restore state
        await focusWindow({ appName: 'Finder' })
      },
      15000,
    )

    itMacOS(
      'should return error for non-existent application',
      async () => {
        const result = await minimizeWindow({
          appName: 'NonExistentApp12345XYZ',
        })

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      },
      15000,
    )

    itMacOS(
      'should minimize specific window by index',
      async () => {
        await ensureFinderWindow()

        const result = await minimizeWindow({
          appName: 'Finder',
          windowIndex: 1,
        })

        expect(result.success).toBe(true)

        // Restore the window
        await focusWindow({ appName: 'Finder' })
      },
      15000,
    )

    itMacOS(
      'should return error for invalid window index',
      async () => {
        await ensureFinderWindow()

        const result = await minimizeWindow({
          appName: 'Finder',
          windowIndex: 999,
        })

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      },
      15000,
    )
  })
})
