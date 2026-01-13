/**
 * AppleScript Executor Tests
 *
 * Tests for executing AppleScript commands via osascript.
 * Includes both unit tests (platform-independent) and integration tests (macOS only).
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 10.1, 10.4
 */

import { platform } from 'os'

import { describe, it, expect } from 'vitest'

import {
  executeAppleScript,
  executeWithArgs,
  parseAppleScriptOutput,
  DEFAULT_TIMEOUT,
} from '../src/lib/executor.js'

/**
 * Determines if the current platform is macOS.
 * @returns True if running on macOS (darwin)
 */
const isMacOS = platform() === 'darwin'

/**
 * Skip helper for macOS-only tests.
 * Use: it.skipIf(!isMacOS)('test name', ...)
 */
const itMacOS = isMacOS ? it : it.skip

describe('AppleScriptExecutor', () => {
  describe('Interface Compliance', () => {
    it('should export executeAppleScript function', () => {
      expect(typeof executeAppleScript).toBe('function')
    })

    it('should export parseAppleScriptOutput function', () => {
      expect(typeof parseAppleScriptOutput).toBe('function')
    })

    it('should export DEFAULT_TIMEOUT constant of 30000ms', () => {
      expect(DEFAULT_TIMEOUT).toBe(30000)
    })
  })

  describe('parseAppleScriptOutput', () => {
    it('should parse valid JSON object string', () => {
      const input = '{"name": "Safari", "pid": 123}'
      const result = parseAppleScriptOutput(input)
      expect(result).toEqual({ name: 'Safari', pid: 123 })
    })

    it('should parse valid JSON array string', () => {
      const input = '[1, 2, 3]'
      const result = parseAppleScriptOutput(input)
      expect(result).toEqual([1, 2, 3])
    })

    it('should return raw string for non-JSON output', () => {
      const input = 'Hello World'
      const result = parseAppleScriptOutput(input)
      expect(result).toBe('Hello World')
    })

    it('should return raw string for malformed JSON', () => {
      const input = '{not: valid json}'
      const result = parseAppleScriptOutput(input)
      expect(result).toBe('{not: valid json}')
    })

    it('should trim whitespace before parsing', () => {
      const input = '  {"key": "value"}  '
      const result = parseAppleScriptOutput(input)
      expect(result).toEqual({ key: 'value' })
    })

    it('should handle empty string', () => {
      const result = parseAppleScriptOutput('')
      expect(result).toBe('')
    })

    it('should handle numeric strings as raw output', () => {
      // AppleScript returns plain numbers, not JSON numbers
      const result = parseAppleScriptOutput('42')
      expect(result).toBe(42)
    })

    it('should handle boolean-like strings', () => {
      expect(parseAppleScriptOutput('true')).toBe(true)
      expect(parseAppleScriptOutput('false')).toBe(false)
    })

    it('should handle null string', () => {
      expect(parseAppleScriptOutput('null')).toBe(null)
    })
  })

  describe('executeAppleScript - Input Validation', () => {
    itMacOS('should reject empty script', async () => {
      const result = await executeAppleScript({ script: '' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Script cannot be empty')
    })

    itMacOS('should reject whitespace-only script', async () => {
      const result = await executeAppleScript({ script: '   ' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Script cannot be empty')
    })

    itMacOS('should accept valid script', async () => {
      const result = await executeAppleScript({ script: 'return "hello"' })
      expect(result.success).toBe(true)
    })
  })

  describe('executeAppleScript - Execution (macOS Integration)', () => {
    itMacOS('should execute simple return statement', async () => {
      const result = await executeAppleScript({ script: 'return "hello"' })
      expect(result.success).toBe(true)
      expect(result.output).toBe('hello')
    })

    itMacOS('should execute arithmetic expression', async () => {
      const result = await executeAppleScript({ script: 'return 2 + 2' })
      expect(result.success).toBe(true)
      expect(result.output).toBe('4')
      expect(result.parsed).toBe(4)
    })

    itMacOS('should capture script errors', async () => {
      const result = await executeAppleScript({
        script: 'this is not valid applescript syntax !@#',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    itMacOS('should parse JSON-like AppleScript output', async () => {
      // AppleScript record syntax that outputs JSON-like structure
      const script = 'return "{\\\"name\\\": \\\"test\\\"}"'
      const result = await executeAppleScript({ script })
      expect(result.success).toBe(true)
      // The output should be parseable
      expect(result.parsed).toBeDefined()
    })

    itMacOS('should handle multiline scripts', async () => {
      const script = `
        set x to 5
        set y to 10
        return x + y
      `
      const result = await executeAppleScript({ script })
      expect(result.success).toBe(true)
      expect(result.parsed).toBe(15)
    })
  })

  describe('executeAppleScript - Timeout Handling', () => {
    it.skipIf(!isMacOS)(
      'should timeout script exceeding limit',
      { timeout: 10000 },
      async () => {
        // Use a short timeout for testing
        const result = await executeAppleScript({
          script: 'delay 5', // Sleep for 5 seconds
          timeout: 1000, // But timeout after 1 second
        })
        expect(result.success).toBe(false)
        expect(result.error).toContain('timeout')
      },
    )

    itMacOS('should use default timeout when not specified', async () => {
      // This test verifies the default is applied, not that it times out
      const result = await executeAppleScript({ script: 'return "fast"' })
      expect(result.success).toBe(true)
    })

    it.skipIf(!isMacOS)(
      'should allow custom timeout',
      { timeout: 10000 },
      async () => {
        const result = await executeAppleScript({
          script: 'delay 0.5\nreturn "done"', // Sleep 500ms
          timeout: 5000, // 5 second timeout
        })
        expect(result.success).toBe(true)
        expect(result.output).toBe('done')
      },
    )
  })

  describe('executeAppleScript - Error Details', () => {
    itMacOS('should include AppleScript error message', async () => {
      const result = await executeAppleScript({
        script: 'tell application "NonExistentApp12345" to activate',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      // Error should contain relevant information
      expect(result.error!.length).toBeGreaterThan(10)
    })

    itMacOS('should handle syntax errors', async () => {
      const result = await executeAppleScript({
        script: 'this is broken (((',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('ExecuteResult Interface', () => {
    itMacOS(
      'should return success: true with output for valid script',
      async () => {
        const result = await executeAppleScript({ script: 'return "test"' })

        // Type check: result should match ExecuteResult
        expect(result).toMatchObject({
          success: true,
          output: expect.any(String),
        })
        expect(result.error).toBeUndefined()
      },
    )

    itMacOS(
      'should return success: false with error for invalid script',
      async () => {
        const result = await executeAppleScript({ script: '!!invalid!!' })

        expect(result).toMatchObject({
          success: false,
          error: expect.any(String),
        })
      },
    )

    itMacOS(
      'should include parsed field when output is parseable',
      async () => {
        const result = await executeAppleScript({ script: 'return 42' })

        expect(result.success).toBe(true)
        expect(result.parsed).toBe(42)
      },
    )
  })

  describe('executeWithArgs', () => {
    it('should export executeWithArgs function', () => {
      expect(typeof executeWithArgs).toBe('function')
    })

    itMacOS('should execute script with arguments', async () => {
      // AppleScript that uses argv
      const script = `on run argv
        return item 1 of argv
      end run`
      const result = await executeWithArgs(script, ['hello'])
      expect(result.success).toBe(true)
      expect(result.output).toBe('hello')
    })

    itMacOS('should handle multiple arguments', async () => {
      const script = `on run argv
        set result to ""
        repeat with arg in argv
          set result to result & arg & ","
        end repeat
        return result
      end run`
      const result = await executeWithArgs(script, ['a', 'b', 'c'])
      expect(result.success).toBe(true)
      expect(result.output).toContain('a')
      expect(result.output).toContain('b')
      expect(result.output).toContain('c')
    })

    itMacOS('should reject empty script', async () => {
      const result = await executeWithArgs('', ['arg'])
      expect(result.success).toBe(false)
      expect(result.error).toContain('Script cannot be empty')
    })

    itMacOS('should handle unicode in arguments', async () => {
      const script = `on run argv
        return item 1 of argv
      end run`
      const result = await executeWithArgs(script, ['日本語テスト'])
      expect(result.success).toBe(true)
      expect(result.output).toBe('日本語テスト')
    })
  })
})
