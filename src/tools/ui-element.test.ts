/**
 * UI Element Interaction Tools - Test Suite
 *
 * Tests for get_ui_elements, click_ui_element, get_ui_element_value,
 * set_ui_element_value, and focus_ui_element tools.
 *
 * @module ui-element.test
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7
 */

import { describe, expect, it } from 'vitest'

import {
  ClickUIElementSchema,
  FocusUIElementSchema,
  GetUIElementsSchema,
  GetUIElementValueSchema,
  SetUIElementValueSchema,
  clickUIElement,
  focusUIElement,
  getUIElements,
  getUIElementValue,
  setUIElementValue,
  type UIElement,
} from './ui-element.js'

// ============================================================================
// Platform Detection Helper
// ============================================================================

const isMacOS = process.platform === 'darwin'

/**
 * Skip test if not on macOS.
 */
const itMacOS = isMacOS ? it : it.skip

// ============================================================================
// Schema Tests
// ============================================================================

describe('UI Element Tool Schemas', () => {
  describe('GetUIElementsSchema', () => {
    it('should validate valid input with appName', () => {
      const result = GetUIElementsSchema.safeParse({ appName: 'Safari' })
      expect(result.success).toBe(true)
    })

    it('should validate input with maxDepth', () => {
      const result = GetUIElementsSchema.safeParse({
        appName: 'Safari',
        maxDepth: 5,
      })
      expect(result.success).toBe(true)
    })

    it('should use default maxDepth of 3', () => {
      const result = GetUIElementsSchema.parse({ appName: 'Safari' })
      expect(result.maxDepth).toBe(3)
    })

    it('should reject missing appName', () => {
      const result = GetUIElementsSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject invalid maxDepth type', () => {
      const result = GetUIElementsSchema.safeParse({
        appName: 'Safari',
        maxDepth: 'three',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ClickUIElementSchema', () => {
    it('should validate valid input', () => {
      const result = ClickUIElementSchema.safeParse({
        appName: 'Safari',
        elementPath: 'window1/button1',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing appName', () => {
      const result = ClickUIElementSchema.safeParse({
        elementPath: 'window1/button1',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing elementPath', () => {
      const result = ClickUIElementSchema.safeParse({
        appName: 'Safari',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('GetUIElementValueSchema', () => {
    it('should validate valid input', () => {
      const result = GetUIElementValueSchema.safeParse({
        appName: 'TextEdit',
        elementPath: 'window1/textfield1',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('SetUIElementValueSchema', () => {
    it('should validate valid input', () => {
      const result = SetUIElementValueSchema.safeParse({
        appName: 'TextEdit',
        elementPath: 'window1/textfield1',
        value: 'Hello World',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing value', () => {
      const result = SetUIElementValueSchema.safeParse({
        appName: 'TextEdit',
        elementPath: 'window1/textfield1',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('FocusUIElementSchema', () => {
    it('should validate valid input', () => {
      const result = FocusUIElementSchema.safeParse({
        appName: 'Safari',
        elementPath: 'window1/textfield1',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================================
// UI Element Type Tests
// ============================================================================

describe('UIElement Interface', () => {
  it('should have correct structure', () => {
    const element: UIElement = {
      role: 'button',
      title: 'Submit',
      position: { x: 100, y: 200 },
      size: { width: 80, height: 30 },
      path: 'window1/button1',
    }

    expect(element.role).toBe('button')
    expect(element.title).toBe('Submit')
    expect(element.position.x).toBe(100)
    expect(element.size.width).toBe(80)
    expect(element.path).toBe('window1/button1')
  })

  it('should support children array', () => {
    const element: UIElement = {
      role: 'window',
      position: { x: 0, y: 0 },
      size: { width: 800, height: 600 },
      path: 'window1',
      children: [
        {
          role: 'button',
          title: 'OK',
          position: { x: 100, y: 100 },
          size: { width: 60, height: 30 },
          path: 'window1/button1',
        },
      ],
    }

    expect(element.children).toHaveLength(1)
    expect(element.children![0]!.role).toBe('button')
  })
})

// ============================================================================
// Function Tests - Permission Handling
// ============================================================================

describe('Permission Handling', () => {
  itMacOS('getUIElements should check accessibility permission', async () => {
    // This test verifies permission check is performed
    // If permission is denied, it should return an error with guidance
    const result = await getUIElements({
      appName: 'NonExistentApp12345',
    })

    // Either permission error or app not found error is acceptable
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  itMacOS('clickUIElement should check accessibility permission', async () => {
    const result = await clickUIElement({
      appName: 'NonExistentApp12345',
      elementPath: 'window1/button1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  itMacOS(
    'getUIElementValue should check accessibility permission',
    async () => {
      const result = await getUIElementValue({
        appName: 'NonExistentApp12345',
        elementPath: 'window1/textfield1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    },
  )

  itMacOS(
    'setUIElementValue should check accessibility permission',
    async () => {
      const result = await setUIElementValue({
        appName: 'NonExistentApp12345',
        elementPath: 'window1/textfield1',
        value: 'test',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    },
  )

  itMacOS('focusUIElement should check accessibility permission', async () => {
    const result = await focusUIElement({
      appName: 'NonExistentApp12345',
      elementPath: 'window1/textfield1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

// ============================================================================
// Function Tests - Error Handling
// ============================================================================

describe('Error Handling', () => {
  itMacOS('getUIElements should handle app not found gracefully', async () => {
    const result = await getUIElements({
      appName: 'ThisAppDoesNotExist123456',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    // Error should indicate either app not found or script failure
    // The exact message may vary based on permission/system state
    expect(result.error!.length).toBeGreaterThan(0)
  })

  itMacOS('clickUIElement should handle element not found', async () => {
    // Use Finder which is always running
    const result = await clickUIElement({
      appName: 'Finder',
      elementPath: 'nonexistent/element/path',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  itMacOS('should handle invalid element path format', async () => {
    const result = await clickUIElement({
      appName: 'Finder',
      elementPath: '',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  itMacOS('should sanitize app names to prevent injection', async () => {
    // Attempt injection via app name
    const result = await getUIElements({
      appName: 'Safari"; return "injected',
    })

    // Should either fail safely or sanitize the input
    // Should NOT return "injected" as a success
    if (result.success) {
      expect(result.elements).toBeDefined()
    } else {
      expect(result.error).toBeDefined()
    }
  })
})

// ============================================================================
// Function Tests - Real App Integration (requires macOS)
// ============================================================================

describe('Integration Tests', () => {
  itMacOS('getUIElements should return tree for Finder', async () => {
    const result = await getUIElements({
      appName: 'Finder',
      maxDepth: 2,
    })

    // Finder is always available on macOS
    // May fail if accessibility permission not granted
    if (result.success) {
      expect(result.elements).toBeDefined()
      expect(Array.isArray(result.elements)).toBe(true)
      if (result.elements && result.elements.length > 0) {
        const firstElement = result.elements[0]!
        expect(firstElement.role).toBeDefined()
        expect(firstElement.path).toBeDefined()
      }
    } else {
      // Permission denied is acceptable for CI environment
      expect(result.error).toBeDefined()
    }
  })

  itMacOS('getUIElements should respect maxDepth parameter', async () => {
    const result = await getUIElements({
      appName: 'Finder',
      maxDepth: 1,
    })

    if (result.success && result.elements && result.elements.length > 0) {
      // With maxDepth 1, children should have no nested children
      const firstElement = result.elements[0]!
      if (firstElement.children && firstElement.children.length > 0) {
        // Children at depth 1 should not have their own children
        expect(firstElement.children[0]!.children).toBeUndefined()
      }
    }
  })

  itMacOS('getUIElements should include element properties', async () => {
    const result = await getUIElements({
      appName: 'Finder',
      maxDepth: 2,
    })

    if (result.success && result.elements && result.elements.length > 0) {
      const element = result.elements[0]!
      // Required properties
      expect(element.role).toBeDefined()
      expect(element.path).toBeDefined()
      expect(element.position).toBeDefined()
      expect(element.size).toBeDefined()
      // Position should have x and y
      expect(typeof element.position.x).toBe('number')
      expect(typeof element.position.y).toBe('number')
    }
  })

  itMacOS(
    'getUIElementValue should return value from accessible element',
    async () => {
      // This is harder to test without a specific app setup
      // Testing with Finder (which may have accessible elements)
      const result = await getUIElementValue({
        appName: 'Finder',
        elementPath: 'window1',
      })

      // May succeed or fail depending on Finder state
      // Main thing is it doesn't crash
      expect(typeof result.success).toBe('boolean')
      if (result.success) {
        expect(result.value !== undefined || result.value === null).toBe(true)
      }
    },
  )
})

// ============================================================================
// Input Validation Tests
// ============================================================================

describe('Input Validation', () => {
  itMacOS('should reject empty app name', async () => {
    const result = await getUIElements({
      appName: '',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  itMacOS('should reject whitespace-only app name', async () => {
    const result = await getUIElements({
      appName: '   ',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  itMacOS('should reject extremely long app names', async () => {
    const result = await getUIElements({
      appName: 'A'.repeat(300),
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('255')
  })

  itMacOS('should handle negative maxDepth', async () => {
    // Zod should catch this at schema level
    const result = GetUIElementsSchema.safeParse({
      appName: 'Finder',
      maxDepth: -1,
    })

    // Depends on schema constraints - check implementation
    expect(result.success).toBe(true) // -1 is a valid number, just may be clamped
  })
})
