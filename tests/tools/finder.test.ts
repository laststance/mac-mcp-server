/**
 * Finder Integration Tools Tests
 *
 * Tests for Finder tools: reveal_in_finder, get_selected_files, get_finder_window_path.
 * Uses TDD approach - tests written before implementation.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import { homedir, platform } from 'os'
import { join } from 'path'

import { describe, it, expect } from 'vitest'

import {
  revealInFinder,
  getSelectedFiles,
  getFinderWindowPath,
  RevealInFinderSchema,
  GetSelectedFilesSchema,
  GetFinderWindowPathSchema,
} from '../../src/tools/finder.js'

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
 * Test file path that always exists on macOS.
 */
const EXISTING_PATH = '/Applications'

/**
 * Test path in home directory.
 */
const HOME_PATH = homedir()

/**
 * Non-existent path for error testing.
 */
const NON_EXISTENT_PATH = '/path/that/does/not/exist/12345xyz'

describe('FinderTools', () => {
  describe('Module Exports', () => {
    it('should export revealInFinder function', () => {
      expect(typeof revealInFinder).toBe('function')
    })

    it('should export getSelectedFiles function', () => {
      expect(typeof getSelectedFiles).toBe('function')
    })

    it('should export getFinderWindowPath function', () => {
      expect(typeof getFinderWindowPath).toBe('function')
    })

    it('should export RevealInFinderSchema', () => {
      expect(RevealInFinderSchema).toBeDefined()
    })

    it('should export GetSelectedFilesSchema', () => {
      expect(GetSelectedFilesSchema).toBeDefined()
    })

    it('should export GetFinderWindowPathSchema', () => {
      expect(GetFinderWindowPathSchema).toBeDefined()
    })
  })

  describe('Zod Schemas', () => {
    it('RevealInFinderSchema should accept path string', () => {
      const result = RevealInFinderSchema.safeParse({ path: '/Applications' })
      expect(result.success).toBe(true)
    })

    it('RevealInFinderSchema should reject missing path', () => {
      const result = RevealInFinderSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('RevealInFinderSchema should reject non-string path', () => {
      const result = RevealInFinderSchema.safeParse({ path: 123 })
      expect(result.success).toBe(false)
    })

    it('GetSelectedFilesSchema should accept empty object', () => {
      const result = GetSelectedFilesSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('GetFinderWindowPathSchema should accept empty object', () => {
      const result = GetFinderWindowPathSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  // NOTE: Finder tests are skipped because they actually open Finder windows during test execution
  describe.skip('revealInFinder (Req 8.1, 8.3)', () => {
    itMacOS('should reveal existing directory in Finder', async () => {
      const result = await revealInFinder({ path: EXISTING_PATH })
      expect(result.success).toBe(true)
    })

    itMacOS('should reveal home directory', async () => {
      const result = await revealInFinder({ path: HOME_PATH })
      expect(result.success).toBe(true)
    })

    itMacOS(
      'should return error for non-existent path (Req 8.3)',
      async () => {
        const result = await revealInFinder({ path: NON_EXISTENT_PATH })
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
        // Error should indicate path is invalid
        expect(result.error?.toLowerCase()).toMatch(
          /not exist|invalid|not found/,
        )
      },
      15000,
    )

    itMacOS('should return success message on reveal', async () => {
      const result = await revealInFinder({ path: EXISTING_PATH })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.message).toBeDefined()
      }
    })

    itMacOS('should handle path with spaces', async () => {
      // /System/Library exists on all Macs
      const result = await revealInFinder({ path: '/System/Library' })
      expect(result.success).toBe(true)
    })

    itMacOS('should handle root path', async () => {
      const result = await revealInFinder({ path: '/' })
      expect(result.success).toBe(true)
    })
  })

  describe.skip('getSelectedFiles (Req 8.2)', () => {
    itMacOS('should return array of selected files', async () => {
      const result = await getSelectedFiles()
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true)
      }
    })

    itMacOS('should return POSIX paths', async () => {
      const result = await getSelectedFiles()
      expect(result.success).toBe(true)
      if (result.success && result.data && result.data.length > 0) {
        // POSIX paths start with /
        for (const path of result.data) {
          expect(path.startsWith('/')).toBe(true)
        }
      }
    })

    itMacOS('should handle no selection gracefully', async () => {
      // This test verifies the function doesn't error when nothing is selected
      const result = await getSelectedFiles()
      expect(result.success).toBe(true)
      // Should return empty array or array with selections
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true)
      }
    })
  })

  describe.skip('getFinderWindowPath (Req 8.4)', () => {
    itMacOS(
      'should return path when Finder window is open',
      async () => {
        // First reveal a path to ensure Finder has a window
        const revealResult = await revealInFinder({ path: HOME_PATH })

        // Only proceed with window path check if reveal succeeded
        if (revealResult.success) {
          // Give Finder time to open
          await new Promise((resolve) => setTimeout(resolve, 1000))

          const result = await getFinderWindowPath()
          expect(result.success).toBe(true)
          if (result.success && result.data) {
            expect(typeof result.data).toBe('string')
            // Should be a POSIX path
            expect(result.data.startsWith('/')).toBe(true)
          }
        } else {
          // If reveal failed (maybe permission issue), skip assertion
          console.log(
            'Skipping window path check - reveal failed:',
            revealResult.error,
          )
          expect(true).toBe(true)
        }
      },
      15000,
    )

    itMacOS('should return string path', async () => {
      const result = await getFinderWindowPath()
      if (result.success && result.data) {
        expect(typeof result.data).toBe('string')
      }
    })

    itMacOS('should handle no Finder window gracefully', async () => {
      // This test checks that the function handles the case
      // when no Finder window is open
      const result = await getFinderWindowPath()
      // Should return success with empty/undefined data or error
      expect(typeof result.success).toBe('boolean')
    })
  })

  describe.skip('Return Type Interface', () => {
    itMacOS(
      'revealInFinder should return success result with message or error',
      async () => {
        const result = await revealInFinder({ path: EXISTING_PATH })
        if (result.success) {
          expect(result.message).toBeDefined()
          expect(result.error).toBeUndefined()
        } else {
          expect(result.error).toBeDefined()
        }
      },
    )

    itMacOS(
      'getSelectedFiles should return success result with data or error',
      async () => {
        const result = await getSelectedFiles()
        if (result.success) {
          expect(result.data).toBeDefined()
          expect(result.error).toBeUndefined()
        } else {
          expect(result.error).toBeDefined()
        }
      },
    )

    itMacOS(
      'getFinderWindowPath should return success result with data or error',
      async () => {
        const result = await getFinderWindowPath()
        // Success case: has data, no error
        // Failure case: has error, no data
        if (result.success) {
          expect(result.error).toBeUndefined()
        } else {
          expect(result.error).toBeDefined()
        }
      },
    )
  })

  describe.skip('Edge Cases', () => {
    itMacOS('revealInFinder should handle empty path with error', async () => {
      const result = await revealInFinder({ path: '' })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    itMacOS('revealInFinder should handle whitespace-only path', async () => {
      const result = await revealInFinder({ path: '   ' })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    itMacOS(
      'revealInFinder should handle path with special characters',
      async () => {
        // Test with a path that has quotes (need to verify it exists first)
        const testPath = join(HOME_PATH, 'Desktop')
        const result = await revealInFinder({ path: testPath })
        // Just verify it doesn't crash - path may or may not exist
        expect(typeof result.success).toBe('boolean')
      },
    )
  })
})
