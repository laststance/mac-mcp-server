/**
 * Input Sanitizer
 *
 * Sanitizes user inputs before AppleScript interpolation to prevent injection attacks.
 * All user inputs MUST pass through these functions before being interpolated into AppleScript.
 *
 * @module sanitizer
 * Requirements: 11.2, 11.4
 */

/**
 * Escapes a string for safe interpolation in AppleScript string literals.
 * Escapes backslash (\) and double quote (") characters.
 *
 * @param input - The string to sanitize
 * @returns Escaped string safe for AppleScript interpolation
 *
 * @example
 * sanitizeString('Say "Hello"') // => 'Say \\"Hello\\"'
 * sanitizeString('Path\\file') // => 'Path\\\\file'
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/\\/g, '\\\\') // Escape backslashes first (order matters)
    .replace(/"/g, '\\"') // Then escape double quotes
}

/**
 * Validates and sanitizes file system paths.
 * Rejects paths containing null bytes and normalizes redundant separators.
 *
 * @param path - The file path to sanitize
 * @returns Sanitized path
 * @throws Error if path is empty or contains invalid characters
 *
 * @example
 * sanitizePath('/Users/test/file.txt') // => '/Users/test/file.txt'
 * sanitizePath('//path//to//file') // => '/path/to/file'
 */
export function sanitizePath(path: string): string {
  // Check for empty or whitespace-only path
  const trimmedPath = path.trim()
  if (trimmedPath.length === 0) {
    throw new Error('Path cannot be empty')
  }

  // Check for null bytes (common injection technique)
  if (path.includes('\0')) {
    throw new Error('Path contains invalid characters')
  }

  // Normalize redundant separators
  // Replace multiple consecutive slashes with single slash, except at start (for root)
  const normalized = trimmedPath.replace(/\/+/g, '/')

  return normalized
}

/**
 * Sanitizes application/process identifiers.
 * Applies string sanitization plus length validation.
 *
 * @param identifier - The identifier to sanitize (app name, window title, etc.)
 * @returns Sanitized identifier
 * @throws Error if identifier is empty or exceeds 255 characters
 *
 * @example
 * sanitizeIdentifier('Safari') // => 'Safari'
 * sanitizeIdentifier('My "App"') // => 'My \\"App\\"'
 */
export function sanitizeIdentifier(identifier: string): string {
  // Trim whitespace
  const trimmed = identifier.trim()

  // Check for empty identifier
  if (trimmed.length === 0) {
    throw new Error('Identifier cannot be empty')
  }

  // Check length limit (reasonable max for app/window names)
  if (trimmed.length > 255) {
    throw new Error('Identifier exceeds maximum length of 255 characters')
  }

  // Apply string sanitization for special characters
  return sanitizeString(trimmed)
}
