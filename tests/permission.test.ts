/**
 * Permission Manager Tests
 *
 * Tests for detecting and reporting macOS permission status.
 * Includes both unit tests (platform-independent) and integration tests (macOS only).
 *
 * Requirements: 11.1, 11.5, 11.6, 11.7
 */

import { platform } from 'os'

import { describe, it, expect, beforeEach } from 'vitest'

import {
  type PermissionType,
  checkAccessibility,
  checkAutomation,
  checkScreenRecording,
  getPermissionGuidance,
  clearPermissionCache,
} from '../src/lib/permission.js'

/**
 * Determines if the current platform is macOS.
 * @returns True if running on macOS (darwin)
 */
const isMacOS = platform() === 'darwin'

/**
 * Skip helper for macOS-only tests.
 */
const itMacOS = isMacOS ? it : it.skip

describe('PermissionManager', () => {
  beforeEach(() => {
    // Clear cache before each test to ensure isolation
    clearPermissionCache()
  })

  describe('Interface Compliance', () => {
    it('should export checkAccessibility function', () => {
      expect(typeof checkAccessibility).toBe('function')
    })

    it('should export checkAutomation function', () => {
      expect(typeof checkAutomation).toBe('function')
    })

    it('should export checkScreenRecording function', () => {
      expect(typeof checkScreenRecording).toBe('function')
    })

    it('should export getPermissionGuidance function', () => {
      expect(typeof getPermissionGuidance).toBe('function')
    })

    it('should export clearPermissionCache function', () => {
      expect(typeof clearPermissionCache).toBe('function')
    })
  })

  describe('getPermissionGuidance', () => {
    it('should return accessibility guidance with System Settings path', () => {
      const guidance = getPermissionGuidance('accessibility')
      expect(guidance).toContain('Accessibility')
      expect(guidance).toContain('System Settings')
      expect(guidance).toContain('Privacy')
    })

    it('should return automation guidance with System Settings path', () => {
      const guidance = getPermissionGuidance('automation')
      expect(guidance).toContain('Automation')
      expect(guidance).toContain('System Settings')
      expect(guidance).toContain('Privacy')
    })

    it('should return screenRecording guidance with System Settings path', () => {
      const guidance = getPermissionGuidance('screenRecording')
      expect(guidance).toContain('Screen Recording')
      expect(guidance).toContain('System Settings')
      expect(guidance).toContain('Privacy')
    })

    it('should return actionable guidance for each permission type', () => {
      const types: PermissionType[] = [
        'accessibility',
        'automation',
        'screenRecording',
      ]
      for (const type of types) {
        const guidance = getPermissionGuidance(type)
        // Guidance should be actionable (tell user what to do)
        expect(guidance.length).toBeGreaterThan(50)
      }
    })
  })

  describe('PermissionStatus Interface', () => {
    itMacOS(
      'checkAccessibility should return PermissionStatus with correct structure',
      async () => {
        const result = await checkAccessibility()

        // Type check: result should match PermissionStatus
        expect(result).toHaveProperty('granted')
        expect(result).toHaveProperty('type')
        expect(typeof result.granted).toBe('boolean')
        expect(result.type).toBe('accessibility')

        // If not granted, should have guidance
        if (!result.granted) {
          expect(result.guidance).toBeDefined()
          expect(typeof result.guidance).toBe('string')
        }
      },
    )

    itMacOS(
      'checkAutomation should return PermissionStatus with correct structure',
      async () => {
        const result = await checkAutomation('Finder')

        expect(result).toHaveProperty('granted')
        expect(result).toHaveProperty('type')
        expect(typeof result.granted).toBe('boolean')
        expect(result.type).toBe('automation')

        if (!result.granted) {
          expect(result.guidance).toBeDefined()
          expect(result.guidance).toContain('Finder')
        }
      },
    )

    itMacOS(
      'checkScreenRecording should return PermissionStatus with correct structure',
      async () => {
        const result = await checkScreenRecording()

        expect(result).toHaveProperty('granted')
        expect(result).toHaveProperty('type')
        expect(typeof result.granted).toBe('boolean')
        expect(result.type).toBe('screenRecording')

        if (!result.granted) {
          expect(result.guidance).toBeDefined()
        }
      },
    )
  })

  describe('checkAccessibility (macOS Integration)', () => {
    itMacOS('should detect accessibility permission status', async () => {
      const result = await checkAccessibility()

      // Should always return a valid result
      expect(result.type).toBe('accessibility')
      expect(typeof result.granted).toBe('boolean')
    })

    itMacOS('should include guidance when permission is denied', async () => {
      const result = await checkAccessibility()

      if (!result.granted) {
        expect(result.guidance).toBeDefined()
        expect(result.guidance).toContain('Accessibility')
      }
    })
  })

  describe('checkAutomation (macOS Integration)', () => {
    itMacOS('should check automation permission for Finder', async () => {
      // Finder is always available on macOS
      const result = await checkAutomation('Finder')

      expect(result.type).toBe('automation')
      expect(typeof result.granted).toBe('boolean')
    })

    itMacOS(
      'should include app name in guidance when permission denied',
      async () => {
        const result = await checkAutomation('Safari')

        if (!result.granted) {
          expect(result.guidance).toContain('Safari')
        }
      },
    )

    itMacOS('should handle non-existent app gracefully', async () => {
      const result = await checkAutomation('NonExistentApp12345XYZ')

      // Should return an error status, not crash
      expect(result.type).toBe('automation')
      expect(result.granted).toBe(false)
    })
  })

  describe('checkScreenRecording (macOS Integration)', () => {
    itMacOS('should detect screen recording permission status', async () => {
      const result = await checkScreenRecording()

      expect(result.type).toBe('screenRecording')
      expect(typeof result.granted).toBe('boolean')
    })

    itMacOS('should include guidance when permission is denied', async () => {
      const result = await checkScreenRecording()

      if (!result.granted) {
        expect(result.guidance).toBeDefined()
        expect(result.guidance).toContain('Screen Recording')
      }
    })
  })

  describe('Caching Behavior', () => {
    itMacOS('should cache permission check results', async () => {
      // First call
      const result1 = await checkAccessibility()
      // Second call should use cache (very fast)
      const start = Date.now()
      const result2 = await checkAccessibility()
      const duration = Date.now() - start

      expect(result1.granted).toBe(result2.granted)
      // Cached call should be very fast (< 10ms typically)
      expect(duration).toBeLessThan(100)
    })

    itMacOS('should cache automation permissions per app', async () => {
      const resultFinder1 = await checkAutomation('Finder')
      const resultFinder2 = await checkAutomation('Finder')

      expect(resultFinder1.granted).toBe(resultFinder2.granted)
    })

    itMacOS('should separate cache entries for different apps', async () => {
      const resultFinder = await checkAutomation('Finder')
      const resultSafari = await checkAutomation('Safari')

      // Both should have valid results (different cache keys)
      expect(resultFinder.type).toBe('automation')
      expect(resultSafari.type).toBe('automation')
    })

    it('should allow clearing the cache', () => {
      // Just verify the function doesn't throw
      expect(() => clearPermissionCache()).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    itMacOS('should not throw when checking permissions fails', async () => {
      // These should all complete without throwing
      await expect(checkAccessibility()).resolves.toBeDefined()
      await expect(checkAutomation('Finder')).resolves.toBeDefined()
      await expect(checkScreenRecording()).resolves.toBeDefined()
    })

    itMacOS('should return granted: false on errors', async () => {
      // Non-existent app should return denied, not throw
      const result = await checkAutomation('NonExistentApp99999')
      expect(result.granted).toBe(false)
    })
  })
})
