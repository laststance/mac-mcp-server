/**
 * Error Handling Infrastructure Tests
 *
 * Tests for structured error responses, input validation helpers, and error formatting.
 * Follows TDD RED-GREEN-REFACTOR cycle.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { describe, it, expect } from 'vitest'

import type { ErrorType } from '../src/lib/errors.js'
import {
  createValidationError,
  createTypeError,
  createAppleScriptError,
  createNotFoundError,
  createUnknownToolError,
  validateRequired,
  validateType,
  validateRange,
  formatErrorMessage,
} from '../src/lib/errors.js'
import type { ExecuteResult } from '../src/lib/executor.js'
import type { ToolResponse } from '../src/lib/server.js'

describe('Error Handling Infrastructure', () => {
  describe('Error Types', () => {
    it('should export ErrorType union type with expected values', () => {
      // Type check - ensure ErrorType includes expected values
      const validationError: ErrorType = 'validation'
      const appleScriptError: ErrorType = 'applescript'
      const permissionError: ErrorType = 'permission'
      const notFoundError: ErrorType = 'notFound'
      const unknownError: ErrorType = 'unknown'

      expect(validationError).toBe('validation')
      expect(appleScriptError).toBe('applescript')
      expect(permissionError).toBe('permission')
      expect(notFoundError).toBe('notFound')
      expect(unknownError).toBe('unknown')
    })
  })

  describe('createValidationError - Req 10.2', () => {
    it('should create error response with missing field names', () => {
      const response = createValidationError({
        missingFields: ['name', 'path'],
      })

      expect(response.isError).toBe(true)
      expect(response.content).toHaveLength(1)
      expect(response.content[0]?.type).toBe('text')
      expect(response.content[0]?.text).toContain('name')
      expect(response.content[0]?.text).toContain('path')
      expect(response.content[0]?.text.toLowerCase()).toContain('missing')
    })

    it('should create error response for single missing field', () => {
      const response = createValidationError({
        missingFields: ['appName'],
      })

      expect(response.isError).toBe(true)
      expect(response.content[0]?.text).toContain('appName')
    })

    it('should create error response for invalid fields with expected types', () => {
      const response = createValidationError({
        invalidFields: [
          { field: 'volume', expected: 'number', actual: 'string' },
        ],
      })

      expect(response.isError).toBe(true)
      expect(response.content[0]?.text).toContain('volume')
      expect(response.content[0]?.text).toContain('number')
      expect(response.content[0]?.text).toContain('string')
    })

    it('should combine missing and invalid field errors', () => {
      const response = createValidationError({
        missingFields: ['name'],
        invalidFields: [{ field: 'x', expected: 'number', actual: 'boolean' }],
      })

      expect(response.isError).toBe(true)
      expect(response.content[0]?.text).toContain('name')
      expect(response.content[0]?.text).toContain('x')
    })
  })

  describe('createTypeError - Req 10.3', () => {
    it('should create error with field name and expected/actual types', () => {
      const response = createTypeError('windowId', 'number', 'string')

      expect(response.isError).toBe(true)
      expect(response.content[0]?.text).toContain('windowId')
      expect(response.content[0]?.text).toContain('number')
      expect(response.content[0]?.text).toContain('string')
    })

    it('should include clear error message format', () => {
      const response = createTypeError('value', 'boolean', 'undefined')

      expect(response.isError).toBe(true)
      // Should have format like "Invalid type for 'value': expected boolean, received undefined"
      const text = response.content[0]?.text ?? ''
      expect(text.toLowerCase()).toContain('invalid')
      expect(text).toContain('value')
    })
  })

  describe('createAppleScriptError - Req 10.1', () => {
    it('should create error response from failed ExecuteResult', () => {
      const executeResult: ExecuteResult = {
        success: false,
        error: 'Application not found: NonExistentApp',
      }

      const response = createAppleScriptError(executeResult)

      expect(response.isError).toBe(true)
      expect(response.content[0]?.text).toContain('Application not found')
    })

    it('should handle timeout errors', () => {
      const executeResult: ExecuteResult = {
        success: false,
        error: 'Script execution timeout: exceeded 30000ms limit',
      }

      const response = createAppleScriptError(executeResult)

      expect(response.isError).toBe(true)
      expect(response.content[0]?.text).toContain('timeout')
    })

    it('should provide descriptive message when error is undefined', () => {
      const executeResult: ExecuteResult = {
        success: false,
      }

      const response = createAppleScriptError(executeResult)

      expect(response.isError).toBe(true)
      expect(response.content[0]?.text.length).toBeGreaterThan(10)
    })

    it('should not lose error details from AppleScript stderr', () => {
      const executeResult: ExecuteResult = {
        success: false,
        error:
          'execution error: System Events got an error: osascript is not allowed assistive access.',
      }

      const response = createAppleScriptError(executeResult)

      expect(response.isError).toBe(true)
      expect(response.content[0]?.text).toContain('assistive access')
    })
  })

  describe('createNotFoundError', () => {
    it('should create error for application not found', () => {
      const response = createNotFoundError('application', 'Safari')

      expect(response.isError).toBe(true)
      expect(response.content[0]?.text).toContain('application')
      expect(response.content[0]?.text).toContain('Safari')
      expect(response.content[0]?.text.toLowerCase()).toContain('not found')
    })

    it('should create error for window not found', () => {
      const response = createNotFoundError('window', '12345')

      expect(response.isError).toBe(true)
      expect(response.content[0]?.text).toContain('window')
      expect(response.content[0]?.text).toContain('12345')
    })

    it('should create error for UI element not found', () => {
      const response = createNotFoundError('UI element', 'button[0]/text[1]')

      expect(response.isError).toBe(true)
      expect(response.content[0]?.text).toContain('UI element')
      expect(response.content[0]?.text).toContain('button[0]/text[1]')
    })
  })

  describe('createUnknownToolError - Req 10.5', () => {
    it('should create error indicating tool does not exist', () => {
      const response = createUnknownToolError('nonexistent_tool')

      expect(response.isError).toBe(true)
      expect(response.content[0]?.text).toContain('nonexistent_tool')
      expect(response.content[0]?.text.toLowerCase()).toMatch(
        /unknown|not found|does not exist/,
      )
    })

    it('should be descriptive about what went wrong', () => {
      const response = createUnknownToolError('fake_tool')

      expect(response.isError).toBe(true)
      const text = response.content[0]?.text ?? ''
      // Should mention it's a tool-related error
      expect(text.toLowerCase()).toContain('tool')
    })
  })

  describe('validateRequired', () => {
    it('should not throw for defined value', () => {
      expect(() => {
        validateRequired('test', 'fieldName')
      }).not.toThrow()
    })

    it('should not throw for zero', () => {
      expect(() => {
        validateRequired(0, 'fieldName')
      }).not.toThrow()
    })

    it('should not throw for false', () => {
      expect(() => {
        validateRequired(false, 'fieldName')
      }).not.toThrow()
    })

    it('should not throw for empty string', () => {
      expect(() => {
        validateRequired('', 'fieldName')
      }).not.toThrow()
    })

    it('should throw for undefined', () => {
      expect(() => {
        validateRequired(undefined, 'appName')
      }).toThrow()
    })

    it('should throw for null', () => {
      expect(() => {
        validateRequired(null, 'windowId')
      }).toThrow()
    })

    it('should include field name in error message', () => {
      expect(() => {
        validateRequired(undefined, 'targetPath')
      }).toThrow(/targetPath/)
    })
  })

  describe('validateType', () => {
    it('should not throw for matching string type', () => {
      expect(() => {
        validateType('hello', 'string', 'message')
      }).not.toThrow()
    })

    it('should not throw for matching number type', () => {
      expect(() => {
        validateType(42, 'number', 'count')
      }).not.toThrow()
    })

    it('should not throw for matching boolean type', () => {
      expect(() => {
        validateType(true, 'boolean', 'enabled')
      }).not.toThrow()
    })

    it('should not throw for matching array type', () => {
      expect(() => {
        validateType([1, 2, 3], 'array', 'items')
      }).not.toThrow()
    })

    it('should not throw for matching object type', () => {
      expect(() => {
        validateType({ key: 'value' }, 'object', 'config')
      }).not.toThrow()
    })

    it('should throw for type mismatch', () => {
      expect(() => {
        validateType('not a number', 'number', 'volume')
      }).toThrow()
    })

    it('should include field name in error', () => {
      expect(() => {
        validateType('wrong', 'number', 'x_coordinate')
      }).toThrow(/x_coordinate/)
    })

    it('should include expected type in error', () => {
      expect(() => {
        validateType('wrong', 'number', 'field')
      }).toThrow(/number/)
    })

    it('should include actual type in error', () => {
      expect(() => {
        validateType('wrong', 'number', 'field')
      }).toThrow(/string/)
    })
  })

  describe('validateRange', () => {
    it('should not throw for value within range', () => {
      expect(() => {
        validateRange(50, 0, 100, 'volume')
      }).not.toThrow()
    })

    it('should not throw for value at minimum', () => {
      expect(() => {
        validateRange(0, 0, 100, 'volume')
      }).not.toThrow()
    })

    it('should not throw for value at maximum', () => {
      expect(() => {
        validateRange(100, 0, 100, 'volume')
      }).not.toThrow()
    })

    it('should throw for value below minimum', () => {
      expect(() => {
        validateRange(-1, 0, 100, 'volume')
      }).toThrow()
    })

    it('should throw for value above maximum', () => {
      expect(() => {
        validateRange(101, 0, 100, 'volume')
      }).toThrow()
    })

    it('should include field name in error', () => {
      expect(() => {
        validateRange(150, 0, 100, 'percentage')
      }).toThrow(/percentage/)
    })

    it('should include range information in error', () => {
      expect(() => {
        validateRange(-5, 0, 100, 'value')
      }).toThrow(/0.*100|range/)
    })
  })

  describe('formatErrorMessage', () => {
    it('should format error message with type and details', () => {
      const message = formatErrorMessage('validation', 'Missing required field')

      expect(message.toLowerCase()).toContain('validation')
      expect(message).toContain('Missing required field')
    })

    it('should handle empty details gracefully', () => {
      const message = formatErrorMessage('unknown', '')

      expect(message.length).toBeGreaterThan(0)
      expect(message.toLowerCase()).toContain('unknown')
    })
  })

  describe('ToolResponse Format Compliance', () => {
    it('should return responses with content array', () => {
      const response = createValidationError({ missingFields: ['test'] })

      expect(Array.isArray(response.content)).toBe(true)
      expect(response.content.length).toBeGreaterThan(0)
    })

    it('should have text type content blocks', () => {
      const response = createAppleScriptError({
        success: false,
        error: 'Test error',
      })

      expect(response.content[0]?.type).toBe('text')
    })

    it('should set isError to true for all error responses', () => {
      const responses: ToolResponse[] = [
        createValidationError({ missingFields: ['a'] }),
        createTypeError('b', 'string', 'number'),
        createAppleScriptError({ success: false, error: 'err' }),
        createNotFoundError('app', 'Test'),
        createUnknownToolError('tool'),
      ]

      responses.forEach((response) => {
        expect(response.isError).toBe(true)
      })
    })
  })

  describe('Server Stability - Req 10.4', () => {
    it('should not throw when creating error from undefined', () => {
      expect(() => {
        // Test handling of missing error property (no error field)
        createAppleScriptError({ success: false } as ExecuteResult)
      }).not.toThrow()
    })

    it('should handle empty error string gracefully', () => {
      const response = createAppleScriptError({ success: false, error: '' })

      expect(response.isError).toBe(true)
      expect(response.content[0]?.text.length).toBeGreaterThan(0)
    })

    it('should handle very long error messages', () => {
      const longError = 'A'.repeat(10000)
      const response = createAppleScriptError({
        success: false,
        error: longError,
      })

      expect(response.isError).toBe(true)
      // Should include error but may truncate
      expect(response.content[0]?.text.length).toBeGreaterThan(0)
    })
  })
})
