/**
 * Input Sanitizer Tests
 *
 * Tests for sanitizing user inputs before AppleScript interpolation.
 * Prevents injection attacks by escaping special characters.
 *
 * Requirements: 11.2, 11.4
 */

import { describe, it, expect } from 'vitest'

import {
  sanitizeString,
  sanitizePath,
  sanitizeIdentifier,
} from '../src/lib/sanitizer.js'

describe('InputSanitizer', () => {
  describe('sanitizeString', () => {
    it('should return empty string unchanged', () => {
      expect(sanitizeString('')).toBe('')
    })

    it('should return string without special chars unchanged', () => {
      expect(sanitizeString('Hello World')).toBe('Hello World')
    })

    it('should escape backslash characters', () => {
      // Input: Hello\World → Output: Hello\\World
      expect(sanitizeString('Hello\\World')).toBe('Hello\\\\World')
    })

    it('should escape double quote characters', () => {
      // Input: Say "Hello" → Output: Say \"Hello\"
      expect(sanitizeString('Say "Hello"')).toBe('Say \\"Hello\\"')
    })

    it('should escape both backslash and double quote', () => {
      // Input: Path: "C:\test" → Output: Path: \"C:\\test\"
      expect(sanitizeString('Path: "C:\\test"')).toBe('Path: \\"C:\\\\test\\"')
    })

    it('should handle multiple occurrences', () => {
      const input = 'a\\b\\c "x" "y"'
      const expected = 'a\\\\b\\\\c \\"x\\" \\"y\\"'
      expect(sanitizeString(input)).toBe(expected)
    })

    it('should preserve other special characters', () => {
      // Other characters like newlines, tabs should be preserved
      expect(sanitizeString('Hello\nWorld')).toBe('Hello\nWorld')
      expect(sanitizeString('Hello\tWorld')).toBe('Hello\tWorld')
    })
  })

  describe('sanitizePath', () => {
    it('should return valid POSIX path unchanged', () => {
      expect(sanitizePath('/Users/test/file.txt')).toBe('/Users/test/file.txt')
    })

    it('should throw error for path containing null byte', () => {
      expect(() => sanitizePath('/path/with\0null')).toThrow(
        'Path contains invalid characters',
      )
    })

    it('should throw error for empty path', () => {
      expect(() => sanitizePath('')).toThrow('Path cannot be empty')
    })

    it('should normalize redundant separators', () => {
      expect(sanitizePath('//path//to//file')).toBe('/path/to/file')
    })

    it('should handle path with spaces', () => {
      // Spaces are valid in macOS paths
      expect(sanitizePath('/Users/test/My Documents/file.txt')).toBe(
        '/Users/test/My Documents/file.txt',
      )
    })

    it('should handle home directory paths', () => {
      expect(sanitizePath('/Users/username/.config')).toBe(
        '/Users/username/.config',
      )
    })

    it('should handle relative paths', () => {
      expect(sanitizePath('./relative/path')).toBe('./relative/path')
    })

    it('should handle paths with dots', () => {
      expect(sanitizePath('/path/to/../file')).toBe('/path/to/../file')
    })

    it('should throw for whitespace-only path', () => {
      expect(() => sanitizePath('   ')).toThrow('Path cannot be empty')
    })
  })

  describe('sanitizeIdentifier', () => {
    it('should return valid identifier unchanged', () => {
      expect(sanitizeIdentifier('Safari')).toBe('Safari')
    })

    it('should escape special characters in identifier', () => {
      // Identifiers may contain quotes in some contexts
      expect(sanitizeIdentifier('My "App"')).toBe('My \\"App\\"')
    })

    it('should throw error for identifier exceeding 255 characters', () => {
      const longIdentifier = 'a'.repeat(256)
      expect(() => sanitizeIdentifier(longIdentifier)).toThrow(
        'Identifier exceeds maximum length of 255 characters',
      )
    })

    it('should allow identifier at exactly 255 characters', () => {
      const maxIdentifier = 'a'.repeat(255)
      expect(sanitizeIdentifier(maxIdentifier)).toBe(maxIdentifier)
    })

    it('should throw error for empty identifier', () => {
      expect(() => sanitizeIdentifier('')).toThrow('Identifier cannot be empty')
    })

    it('should trim whitespace from identifier', () => {
      expect(sanitizeIdentifier('  Safari  ')).toBe('Safari')
    })

    it('should throw for whitespace-only identifier', () => {
      expect(() => sanitizeIdentifier('   ')).toThrow(
        'Identifier cannot be empty',
      )
    })

    it('should handle identifier with backslash', () => {
      expect(sanitizeIdentifier('App\\Name')).toBe('App\\\\Name')
    })

    it('should handle unicode characters in identifier', () => {
      // macOS app names can contain unicode
      expect(sanitizeIdentifier('日本語アプリ')).toBe('日本語アプリ')
    })
  })
})
