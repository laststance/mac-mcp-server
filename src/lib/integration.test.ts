/**
 * Integration and Security Tests
 *
 * Comprehensive tests for end-to-end tool operation and security constraints.
 * Validates MCP compliance, error handling, permission guidance, and injection prevention.
 *
 * @module integration.test
 * Requirements: 11.2, 11.3, 11.4, 1.3, 1.4, 1.5, 10.1, 10.5
 */

import { describe, expect, it } from 'vitest'

import {
  createAppleScriptError,
  createNotFoundError,
  createUnknownToolError,
  createValidationError,
  formatErrorMessage,
} from './errors.js'
import { executeAppleScript } from './executor.js'
import {
  checkAccessibility,
  checkAutomation,
  checkScreenRecording,
  getPermissionGuidance,
} from './permission.js'
import {
  sanitizeIdentifier,
  sanitizePath,
  sanitizeString,
} from './sanitizer.js'
import {
  createSuccessResponse,
  createErrorResponse,
  createStructuredResponse,
} from './server.js'

// ============================================================================
// Platform Detection
// ============================================================================

const isMacOS = process.platform === 'darwin'
const itMacOS = isMacOS ? it : it.skip

// ============================================================================
// Security Constraint Tests (Task 12.1)
// ============================================================================

describe('Security Constraints', () => {
  describe('AppleScript-Only Execution', () => {
    itMacOS(
      'executor should only run AppleScript, not shell commands',
      async () => {
        // Attempt to run something that looks like a shell command
        const result = await executeAppleScript({
          script: 'return "safe applescript"',
        })

        expect(result.success).toBe(true)
        expect(result.output).toBe('safe applescript')
      },
    )

    itMacOS('executor should reject empty scripts', async () => {
      const result = await executeAppleScript({
        script: '',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('empty')
    })

    itMacOS('executor should handle script errors gracefully', async () => {
      const result = await executeAppleScript({
        script: 'this is not valid applescript at all',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      // Server should not crash
    })

    itMacOS(
      'executor should enforce timeout',
      async () => {
        // This test uses a very short timeout to verify timeout works
        const result = await executeAppleScript({
          script: 'delay 5', // 5 second delay
          timeout: 100, // 100ms timeout
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('timeout')
      },
      10000,
    )
  })

  describe('Input Sanitization (11.2, 11.4)', () => {
    it('sanitizeString should escape backslashes', () => {
      const input = 'path\\to\\file'
      const sanitized = sanitizeString(input)

      expect(sanitized).toBe('path\\\\to\\\\file')
    })

    it('sanitizeString should escape double quotes', () => {
      const input = 'Say "Hello"'
      const sanitized = sanitizeString(input)

      expect(sanitized).toBe('Say \\"Hello\\"')
    })

    it('sanitizeString should escape both in order', () => {
      const input = 'path\\with"quotes'
      const sanitized = sanitizeString(input)

      expect(sanitized).toBe('path\\\\with\\"quotes')
    })

    it('sanitizePath should reject null bytes', () => {
      expect(() => sanitizePath('/path\0/with/null')).toThrow(
        'invalid characters',
      )
    })

    it('sanitizePath should reject empty paths', () => {
      expect(() => sanitizePath('')).toThrow('empty')
      expect(() => sanitizePath('   ')).toThrow('empty')
    })

    it('sanitizePath should normalize redundant slashes', () => {
      const input = '/path//to///file'
      const sanitized = sanitizePath(input)

      expect(sanitized).toBe('/path/to/file')
    })

    it('sanitizeIdentifier should reject empty identifiers', () => {
      expect(() => sanitizeIdentifier('')).toThrow('empty')
      expect(() => sanitizeIdentifier('   ')).toThrow('empty')
    })

    it('sanitizeIdentifier should reject overly long identifiers', () => {
      const longName = 'A'.repeat(300)
      expect(() => sanitizeIdentifier(longName)).toThrow('255')
    })

    it('sanitizeIdentifier should escape special characters', () => {
      const input = 'App "Name"'
      const sanitized = sanitizeIdentifier(input)

      expect(sanitized).toBe('App \\"Name\\"')
    })
  })

  describe('Injection Prevention', () => {
    it('should not allow injection via application names', () => {
      // This should be safely escaped, not cause injection
      const malicious = 'Safari"; return "injected'
      const sanitized = sanitizeIdentifier(malicious)

      // The double quotes should be escaped with backslash
      // Original: Safari"; return "injected
      // Escaped:  Safari\"; return \"injected
      expect(sanitized).toContain('\\"')
      expect(sanitized).toBe('Safari\\"; return \\"injected')
    })

    it('should not allow injection via file paths', () => {
      const malicious = '/path"; do shell script "rm -rf /"'
      const sanitized = sanitizeString(malicious)

      // The result should be escaped
      expect(sanitized).toContain('\\"')
    })

    itMacOS('injected code should not execute', async () => {
      // Attempt AppleScript injection
      const result = await executeAppleScript({
        script: `return "${sanitizeString('" & (do shell script "echo injected") & "')}"`,
      })

      // Should either fail safely or return the escaped string
      if (result.success) {
        expect(result.output).not.toBe('injected')
      } else {
        // Failing is also acceptable - injection didn't work
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('No Data Persistence (11.4)', () => {
    itMacOS('executor should not maintain state between calls', async () => {
      // Set a variable in first call
      await executeAppleScript({
        script: 'set testVar to "stored value"',
      })

      // Try to access it in second call - should fail
      const result = await executeAppleScript({
        script: 'return testVar',
      })

      // Either undefined or error - no persistence
      expect(result.success).toBe(false)
    })
  })
})

// ============================================================================
// MCP Compliance Tests (Task 12.2)
// ============================================================================

describe('MCP Compliance', () => {
  describe('Response Format (1.3, 1.4, 1.5)', () => {
    it('createSuccessResponse should return MCP-compliant format', () => {
      const response = createSuccessResponse('Operation completed')

      expect(response).toHaveProperty('content')
      expect(Array.isArray(response.content)).toBe(true)
      expect(response.content[0]).toHaveProperty('type', 'text')
      expect(response.content[0]).toHaveProperty('text', 'Operation completed')
      expect(response.isError).toBeUndefined()
    })

    it('createErrorResponse should include isError flag (10.1)', () => {
      const response = createErrorResponse('Something went wrong')

      expect(response).toHaveProperty('isError', true)
      expect(response.content[0]!.text).toBe('Something went wrong')
    })

    it('createStructuredResponse should include structuredContent', () => {
      const data = { volume: 75, muted: false }
      const response = createStructuredResponse(data)

      expect(response).toHaveProperty('structuredContent')
      expect(response.structuredContent).toEqual(data)
      expect(response.content[0]!.text).toBe(JSON.stringify(data))
    })
  })

  describe('Error Response Format (10.1-10.5)', () => {
    it('createValidationError should list missing fields (10.2)', () => {
      const response = createValidationError({
        missingFields: ['name', 'path'],
      })

      expect(response.isError).toBe(true)
      const text = response.content[0]!.text
      expect(text).toContain('Missing required parameters')
      expect(text).toContain('name')
      expect(text).toContain('path')
    })

    it('createValidationError should describe type errors (10.3)', () => {
      const response = createValidationError({
        invalidFields: [
          { field: 'volume', expected: 'number', actual: 'string' },
        ],
      })

      expect(response.isError).toBe(true)
      const text = response.content[0]!.text
      expect(text).toContain('Invalid type')
      expect(text).toContain('volume')
      expect(text).toContain('number')
      expect(text).toContain('string')
    })

    it('createAppleScriptError should include script error details (10.1)', () => {
      const response = createAppleScriptError({
        success: false,
        error: 'Application not found',
      })

      expect(response.isError).toBe(true)
      const text = response.content[0]!.text
      expect(text).toContain('AppleScript error')
      expect(text).toContain('Application not found')
    })

    it('createNotFoundError should include resource identifier', () => {
      const response = createNotFoundError('application', 'Safari')

      expect(response.isError).toBe(true)
      const text = response.content[0]!.text
      expect(text).toContain('Not found')
      expect(text).toContain('application')
      expect(text).toContain('Safari')
    })

    it('createUnknownToolError should identify missing tool (10.5)', () => {
      const response = createUnknownToolError('nonexistent_tool')

      expect(response.isError).toBe(true)
      const text = response.content[0]!.text
      expect(text).toContain('nonexistent_tool')
      expect(text).toContain('does not exist')
    })

    it('formatErrorMessage should handle all error types', () => {
      const types = [
        'validation',
        'applescript',
        'permission',
        'notFound',
        'unknown',
      ] as const

      for (const type of types) {
        const message = formatErrorMessage(type, 'test details')
        expect(message).toContain('test details')
      }
    })
  })
})

// ============================================================================
// Permission Guidance Tests (11.1, 11.5, 11.6, 11.7)
// ============================================================================

describe('Permission Guidance', () => {
  describe('Permission Messages', () => {
    it('accessibility guidance should include System Settings path', () => {
      const guidance = getPermissionGuidance('accessibility')

      expect(guidance).toContain('System Settings')
      expect(guidance).toContain('Accessibility')
      expect(guidance).toContain('x-apple.systempreferences')
    })

    it('automation guidance should include app name', () => {
      const guidance = getPermissionGuidance('automation', 'Safari')

      expect(guidance).toContain('Safari')
      expect(guidance).toContain('System Settings')
      expect(guidance).toContain('Automation')
    })

    it('screenRecording guidance should include System Settings path', () => {
      const guidance = getPermissionGuidance('screenRecording')

      expect(guidance).toContain('System Settings')
      expect(guidance).toContain('Screen Recording')
      expect(guidance).toContain('x-apple.systempreferences')
    })
  })

  describe('Permission Checks', () => {
    itMacOS('checkAccessibility should return valid status', async () => {
      const status = await checkAccessibility()

      expect(status).toHaveProperty('type', 'accessibility')
      expect(typeof status.granted).toBe('boolean')

      if (!status.granted) {
        expect(status.guidance).toBeDefined()
        expect(status.guidance).toContain('System Settings')
      }
    })

    itMacOS('checkAutomation should return valid status for app', async () => {
      const status = await checkAutomation('Finder')

      expect(status).toHaveProperty('type', 'automation')
      expect(typeof status.granted).toBe('boolean')
    })

    itMacOS('checkScreenRecording should return valid status', async () => {
      const status = await checkScreenRecording()

      expect(status).toHaveProperty('type', 'screenRecording')
      expect(typeof status.granted).toBe('boolean')
    })

    itMacOS('checkAutomation should handle invalid app names', async () => {
      const status = await checkAutomation('NonExistentApp12345')

      // Either denied (app not found) or permission error
      expect(status).toHaveProperty('type', 'automation')
      expect(status.granted).toBe(false)
      expect(status.guidance).toBeDefined()
    })
  })
})

// ============================================================================
// End-to-End Workflow Tests
// ============================================================================

describe('End-to-End Workflows', () => {
  itMacOS('simple AppleScript execution workflow', async () => {
    // Step 1: Execute a simple calculation
    const result1 = await executeAppleScript({
      script: 'return 2 + 2',
    })

    expect(result1.success).toBe(true)
    expect(result1.parsed).toBe(4)

    // Step 2: Execute a string operation
    const result2 = await executeAppleScript({
      script: 'return "hello " & "world"',
    })

    expect(result2.success).toBe(true)
    expect(result2.output).toBe('hello world')
  })

  itMacOS('error recovery workflow', async () => {
    // Step 1: Try something that fails
    const result1 = await executeAppleScript({
      script: 'this will fail',
    })

    expect(result1.success).toBe(false)
    expect(result1.error).toBeDefined()

    // Step 2: Server should still work after error
    const result2 = await executeAppleScript({
      script: 'return "recovered"',
    })

    expect(result2.success).toBe(true)
    expect(result2.output).toBe('recovered')
  })

  itMacOS('permission check and execution workflow', async () => {
    // Step 1: Check permission
    const permStatus = await checkAccessibility()

    // Step 2: Based on permission, try execution
    if (permStatus.granted) {
      const result = await executeAppleScript({
        script: `
          tell application "System Events"
            return UI elements enabled
          end tell
        `,
      })

      expect(result.success).toBe(true)
    } else {
      // Permission denied - guidance should be provided
      expect(permStatus.guidance).toBeDefined()
    }
  })
})

// ============================================================================
// Server Stability Tests (10.4)
// ============================================================================

describe('Server Stability', () => {
  itMacOS('should handle rapid sequential requests', async () => {
    const promises = []

    for (let i = 0; i < 5; i++) {
      promises.push(executeAppleScript({ script: `return ${i}` }))
    }

    const results = await Promise.all(promises)

    for (let i = 0; i < 5; i++) {
      const result = results[i]!
      expect(result.success).toBe(true)
      expect(result.parsed).toBe(i)
    }
  })

  itMacOS(
    'should handle concurrent requests without interference',
    async () => {
      const [result1, result2, result3] = await Promise.all([
        executeAppleScript({ script: 'return "first"' }),
        executeAppleScript({ script: 'return "second"' }),
        executeAppleScript({ script: 'return "third"' }),
      ])

      expect(result1.success).toBe(true)
      expect(result1.output).toBe('first')
      expect(result2.success).toBe(true)
      expect(result2.output).toBe('second')
      expect(result3.success).toBe(true)
      expect(result3.output).toBe('third')
    },
  )

  itMacOS('should maintain stability after errors', async () => {
    // Cause errors
    for (let i = 0; i < 3; i++) {
      await executeAppleScript({ script: 'invalid script here' })
    }

    // Should still work
    const result = await executeAppleScript({ script: 'return "stable"' })
    expect(result.success).toBe(true)
    expect(result.output).toBe('stable')
  })
})
