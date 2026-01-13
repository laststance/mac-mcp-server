/**
 * Application Lifecycle Tools Tests
 *
 * Tests for application management tools: list_running_apps, launch_app, quit_app, activate_app.
 * Uses TDD approach - tests written before implementation.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { platform } from 'os'

import { describe, it, expect } from 'vitest'

import {
  listRunningApps,
  launchApp,
  quitApp,
  activateApp,
  ListRunningAppsSchema,
  LaunchAppSchema,
  QuitAppSchema,
  ActivateAppSchema,
  type RunningApp,
} from '../../src/tools/application.js'

/**
 * Determines if the current platform is macOS.
 * @returns True if running on macOS (darwin)
 */
const isMacOS = platform() === 'darwin'

/**
 * Skip helper for macOS-only tests.
 */
const itMacOS = isMacOS ? it : it.skip

describe('ApplicationTools', () => {
  describe('Module Exports', () => {
    it('should export listRunningApps function', () => {
      expect(typeof listRunningApps).toBe('function')
    })

    it('should export launchApp function', () => {
      expect(typeof launchApp).toBe('function')
    })

    it('should export quitApp function', () => {
      expect(typeof quitApp).toBe('function')
    })

    it('should export activateApp function', () => {
      expect(typeof activateApp).toBe('function')
    })

    it('should export ListRunningAppsSchema', () => {
      expect(ListRunningAppsSchema).toBeDefined()
    })

    it('should export LaunchAppSchema', () => {
      expect(LaunchAppSchema).toBeDefined()
    })

    it('should export QuitAppSchema', () => {
      expect(QuitAppSchema).toBeDefined()
    })

    it('should export ActivateAppSchema', () => {
      expect(ActivateAppSchema).toBeDefined()
    })
  })

  describe('Zod Schemas', () => {
    it('ListRunningAppsSchema should accept empty object', () => {
      const result = ListRunningAppsSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('LaunchAppSchema should accept name string', () => {
      const result = LaunchAppSchema.safeParse({ name: 'Safari' })
      expect(result.success).toBe(true)
    })

    it('LaunchAppSchema should reject missing name', () => {
      const result = LaunchAppSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('LaunchAppSchema should reject non-string name', () => {
      const result = LaunchAppSchema.safeParse({ name: 123 })
      expect(result.success).toBe(false)
    })

    it('QuitAppSchema should accept name string', () => {
      const result = QuitAppSchema.safeParse({ name: 'Safari' })
      expect(result.success).toBe(true)
    })

    it('QuitAppSchema should reject missing name', () => {
      const result = QuitAppSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('ActivateAppSchema should accept name string', () => {
      const result = ActivateAppSchema.safeParse({ name: 'Finder' })
      expect(result.success).toBe(true)
    })

    it('ActivateAppSchema should reject missing name', () => {
      const result = ActivateAppSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('listRunningApps (Req 3.1)', () => {
    itMacOS(
      'should return array of running applications with all required properties',
      async () => {
        const result = await listRunningApps()

        // Basic assertions
        expect(result.success).toBe(true)
        expect(Array.isArray(result.data)).toBe(true)

        if (result.success && result.data) {
          // Should include Finder (always running)
          const finder = result.data.find((app) => app.name === 'Finder')
          expect(finder).toBeDefined()

          // Check all apps have required properties
          if (result.data.length > 0) {
            for (const app of result.data) {
              // name property
              expect(app.name).toBeDefined()
              expect(typeof app.name).toBe('string')

              // bundleId property
              expect(app.bundleId).toBeDefined()
              expect(typeof app.bundleId).toBe('string')

              // processId property
              expect(app.processId).toBeDefined()
              expect(typeof app.processId).toBe('number')
            }

            // RunningApp interface check
            const firstApp: RunningApp = result.data[0] as RunningApp
            expect(firstApp).toHaveProperty('name')
            expect(firstApp).toHaveProperty('bundleId')
            expect(firstApp).toHaveProperty('processId')
          }
        }
      },
      30000,
    )
  })

  describe('launchApp (Req 3.2, 3.3)', () => {
    itMacOS('should launch Finder (safe test - always available)', async () => {
      const result = await launchApp({ name: 'Finder' })
      expect(result.success).toBe(true)
    })

    itMacOS(
      'should return error for non-existent application (Req 3.3)',
      async () => {
        const result = await launchApp({
          name: 'NonExistentApp12345XYZ',
        })
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
        // Error should include the app name that was not found
        expect(result.error).toContain('NonExistentApp12345XYZ')
      },
    )

    itMacOS('should handle already running app gracefully', async () => {
      // Launch Finder twice - second should still succeed
      await launchApp({ name: 'Finder' })
      const result = await launchApp({ name: 'Finder' })
      expect(result.success).toBe(true)
    })

    itMacOS('should return success message on launch', async () => {
      const result = await launchApp({ name: 'Finder' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.message).toBeDefined()
      }
    })
  })

  describe('quitApp (Req 3.4)', () => {
    itMacOS('should gracefully quit Finder (will auto-restart)', async () => {
      // Finder automatically restarts, so this is safe to test
      const result = await quitApp({ name: 'Finder' })
      // Should succeed (Finder will restart automatically)
      expect(result.success).toBe(true)
    })

    itMacOS('should handle non-running app gracefully', async () => {
      // Try to quit an app that doesn't exist/isn't running
      const result = await quitApp({ name: 'NonExistentApp12345' })
      // Should return error for non-existent app
      expect(result.success).toBe(false)
    })

    itMacOS('should return success message on quit', async () => {
      const result = await quitApp({ name: 'Finder' })
      if (result.success) {
        expect(result.message).toBeDefined()
      }
    })
  })

  describe('activateApp (Req 3.5)', () => {
    itMacOS(
      'should activate Finder (bring to foreground)',
      async () => {
        // First ensure Finder is running after potential quit in previous tests
        await launchApp({ name: 'Finder' })
        await new Promise((resolve) => setTimeout(resolve, 500))

        const result = await activateApp({ name: 'Finder' })
        expect(result.success).toBe(true)
      },
      10000,
    )

    itMacOS('should return error for non-existent app', async () => {
      const result = await activateApp({ name: 'NonExistentApp12345' })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    itMacOS('should return success message on activation', async () => {
      const result = await activateApp({ name: 'Finder' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.message).toBeDefined()
      }
    })
  })

  describe('Return Type Interface', () => {
    itMacOS(
      'listRunningApps should return success result with data or error',
      async () => {
        const result = await listRunningApps()
        if (result.success) {
          expect(result.data).toBeDefined()
          expect(result.error).toBeUndefined()
        } else {
          expect(result.error).toBeDefined()
        }
      },
    )

    itMacOS(
      'launchApp should return success result with message or error',
      async () => {
        const result = await launchApp({ name: 'Finder' })
        if (result.success) {
          expect(result.message).toBeDefined()
          expect(result.error).toBeUndefined()
        } else {
          expect(result.error).toBeDefined()
        }
      },
    )

    itMacOS(
      'quitApp should return success result with message or error',
      async () => {
        const result = await quitApp({ name: 'Finder' })
        if (result.success) {
          expect(result.message).toBeDefined()
          expect(result.error).toBeUndefined()
        } else {
          expect(result.error).toBeDefined()
        }
      },
    )

    itMacOS(
      'activateApp should return success result with message or error',
      async () => {
        const result = await activateApp({ name: 'Finder' })
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
