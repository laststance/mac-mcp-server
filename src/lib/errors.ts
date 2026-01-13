/**
 * Error Handling Infrastructure
 *
 * Provides structured error responses, input validation helpers, and error formatting
 * for MCP-compliant error handling.
 *
 * @module errors
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import type { ExecuteResult } from './executor.js'
import {
  createErrorResponse as baseCreateErrorResponse,
  type ToolResponse,
} from './server.js'

/**
 * Types of errors that can occur in the MCP server.
 */
export type ErrorType =
  | 'validation'
  | 'applescript'
  | 'permission'
  | 'notFound'
  | 'unknown'

/**
 * Details about an invalid field in validation.
 */
export interface InvalidFieldInfo {
  /** Field name that failed validation */
  field: string
  /** Expected type or format */
  expected: string
  /** Actual type or value received */
  actual: string
}

/**
 * Options for creating validation errors.
 */
export interface ValidationErrorOptions {
  /** List of required field names that are missing */
  missingFields?: string[]
  /** List of fields with invalid types or values */
  invalidFields?: InvalidFieldInfo[]
}

/**
 * Formats an error message with type prefix and details.
 *
 * @param type - The error type category
 * @param details - The error detail message
 * @returns Formatted error message
 *
 * @example
 * formatErrorMessage('validation', 'Missing required field: name')
 * // => 'Validation error: Missing required field: name'
 */
export function formatErrorMessage(type: ErrorType, details: string): string {
  const typeLabels: Record<ErrorType, string> = {
    validation: 'Validation error',
    applescript: 'AppleScript error',
    permission: 'Permission error',
    notFound: 'Not found',
    unknown: 'Unknown error',
  }

  const label = typeLabels[type]
  if (!details || details.trim() === '') {
    return `${label}: An unexpected error occurred`
  }
  return `${label}: ${details}`
}

/**
 * Creates an MCP-compliant error response.
 * Wraps the base createErrorResponse from server.ts for consistent error formatting.
 *
 * @param message - Error message to include in response
 * @returns ToolResponse with isError: true
 */
function createErrorResponse(message: string): ToolResponse {
  return baseCreateErrorResponse(message)
}

/**
 * Creates a validation error response for missing or invalid parameters.
 * Implements Requirement 10.2 (missing parameters) and 10.3 (invalid types).
 *
 * @param options - Validation error details including missing and invalid fields
 * @returns MCP-compliant error response specifying validation issues
 *
 * @example
 * createValidationError({ missingFields: ['name', 'path'] })
 * // => { isError: true, content: [{ type: 'text', text: '...missing required parameters: name, path' }] }
 *
 * @example
 * createValidationError({ invalidFields: [{ field: 'volume', expected: 'number', actual: 'string' }] })
 * // => { isError: true, content: [{ type: 'text', text: '...invalid type for volume: expected number, received string' }] }
 */
export function createValidationError(
  options: ValidationErrorOptions,
): ToolResponse {
  const { missingFields = [], invalidFields = [] } = options
  const messages: string[] = []

  if (missingFields.length > 0) {
    const fieldList = missingFields.join(', ')
    messages.push(`Missing required parameters: ${fieldList}`)
  }

  if (invalidFields.length > 0) {
    for (const { field, expected, actual } of invalidFields) {
      messages.push(
        `Invalid type for '${field}': expected ${expected}, received ${actual}`,
      )
    }
  }

  const details =
    messages.length > 0 ? messages.join('. ') : 'Invalid input parameters'
  return createErrorResponse(formatErrorMessage('validation', details))
}

/**
 * Creates a type error response for a single field with type mismatch.
 * Implements Requirement 10.3.
 *
 * @param field - The field name with the type error
 * @param expected - The expected type
 * @param actual - The actual type received
 * @returns MCP-compliant error response with type details
 *
 * @example
 * createTypeError('windowId', 'number', 'string')
 * // => { isError: true, content: [{ type: 'text', text: '...Invalid type for windowId...' }] }
 */
export function createTypeError(
  field: string,
  expected: string,
  actual: string,
): ToolResponse {
  return createValidationError({
    invalidFields: [{ field, expected, actual }],
  })
}

/**
 * Creates an error response from a failed AppleScript execution result.
 * Implements Requirement 10.1.
 *
 * @param executeResult - The ExecuteResult from the AppleScript executor
 * @returns MCP-compliant error response with isError: true and descriptive message
 *
 * @example
 * createAppleScriptError({ success: false, error: 'Application not found' })
 * // => { isError: true, content: [{ type: 'text', text: 'AppleScript error: Application not found' }] }
 */
export function createAppleScriptError(
  executeResult: ExecuteResult,
): ToolResponse {
  const errorMessage =
    executeResult.error && executeResult.error.trim() !== ''
      ? executeResult.error
      : 'Script execution failed with an unknown error'

  return createErrorResponse(formatErrorMessage('applescript', errorMessage))
}

/**
 * Creates a not found error response for a missing resource.
 *
 * @param resourceType - Type of resource (e.g., 'application', 'window', 'UI element')
 * @param identifier - The identifier that was not found
 * @returns MCP-compliant error response indicating resource not found
 *
 * @example
 * createNotFoundError('application', 'Safari')
 * // => { isError: true, content: [{ type: 'text', text: 'Not found: application "Safari" not found' }] }
 */
export function createNotFoundError(
  resourceType: string,
  identifier: string,
): ToolResponse {
  const details = `${resourceType} "${identifier}" not found`
  return createErrorResponse(formatErrorMessage('notFound', details))
}

/**
 * Creates an error response for an unknown tool call.
 * Implements Requirement 10.5.
 *
 * @param toolName - The name of the unknown tool that was called
 * @returns MCP-compliant error response indicating tool does not exist
 *
 * @example
 * createUnknownToolError('nonexistent_tool')
 * // => { isError: true, content: [{ type: 'text', text: 'Unknown error: Tool "nonexistent_tool" does not exist' }] }
 */
export function createUnknownToolError(toolName: string): ToolResponse {
  const details = `Tool "${toolName}" does not exist`
  return createErrorResponse(formatErrorMessage('unknown', details))
}

/**
 * Validates that a value is defined (not null or undefined).
 * Throws an error with the field name if validation fails.
 *
 * @param value - The value to validate
 * @param fieldName - The field name for error messages
 * @throws Error if value is null or undefined
 *
 * @example
 * validateRequired(params.name, 'name') // throws if name is undefined
 * validateRequired(0, 'count') // passes - 0 is a valid value
 */
export function validateRequired<T>(
  value: T | undefined | null,
  fieldName: string,
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(`Missing required parameter: ${fieldName}`)
  }
}

/**
 * Validates that a value matches the expected type.
 * Throws an error with type details if validation fails.
 *
 * @param value - The value to validate
 * @param expectedType - The expected type ('string', 'number', 'boolean', 'array', 'object')
 * @param fieldName - The field name for error messages
 * @throws Error if value does not match expected type
 *
 * @example
 * validateType(42, 'number', 'volume') // passes
 * validateType('hello', 'number', 'count') // throws
 */
export function validateType(
  value: unknown,
  expectedType: string,
  fieldName: string,
): void {
  let actualType: string

  if (value === null) {
    actualType = 'null'
  } else if (Array.isArray(value)) {
    actualType = 'array'
  } else {
    actualType = typeof value
  }

  // Normalize expected type for comparison
  const normalizedExpected = expectedType.toLowerCase()

  // Check if types match
  const matches =
    actualType === normalizedExpected ||
    (normalizedExpected === 'array' && Array.isArray(value)) ||
    (normalizedExpected === 'object' &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value))

  if (!matches) {
    throw new Error(
      `Invalid type for '${fieldName}': expected ${expectedType}, received ${actualType}`,
    )
  }
}

/**
 * Validates that a numeric value is within a specified range (inclusive).
 * Throws an error with range details if validation fails.
 *
 * @param value - The numeric value to validate
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @param fieldName - The field name for error messages
 * @throws Error if value is outside the specified range
 *
 * @example
 * validateRange(50, 0, 100, 'volume') // passes
 * validateRange(101, 0, 100, 'volume') // throws
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string,
): void {
  if (value < min || value > max) {
    throw new Error(
      `Value out of range for '${fieldName}': expected ${min} to ${max}, received ${value}`,
    )
  }
}
