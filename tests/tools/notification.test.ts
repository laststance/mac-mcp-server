/**
 * Notification Tools Tests
 *
 * Tests for notification display tool: send_notification.
 * Uses TDD approach - tests written before implementation.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { platform } from 'os'

import { describe, it, expect } from 'vitest'

import {
  sendNotification,
  SendNotificationSchema,
  type SendNotificationInput,
} from '../../src/tools/notification.js'

/**
 * Determines if the current platform is macOS.
 * @returns True if running on macOS (darwin)
 */
const isMacOS = platform() === 'darwin'

/**
 * Skip helper for macOS-only tests.
 */
const itMacOS = isMacOS ? it : it.skip

describe('NotificationTools', () => {
  describe('Module Exports', () => {
    it('should export sendNotification function', () => {
      expect(typeof sendNotification).toBe('function')
    })

    it('should export SendNotificationSchema', () => {
      expect(SendNotificationSchema).toBeDefined()
    })
  })

  describe('Zod Schema', () => {
    it('should accept title and message (required)', () => {
      const result = SendNotificationSchema.safeParse({
        title: 'Test Title',
        message: 'Test Message',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing title', () => {
      const result = SendNotificationSchema.safeParse({
        message: 'Test Message',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing message', () => {
      const result = SendNotificationSchema.safeParse({
        title: 'Test Title',
      })
      expect(result.success).toBe(false)
    })

    it('should accept optional subtitle (Req 7.2)', () => {
      const result = SendNotificationSchema.safeParse({
        title: 'Test Title',
        message: 'Test Message',
        subtitle: 'Test Subtitle',
      })
      expect(result.success).toBe(true)
    })

    it('should accept optional sound parameter (Req 7.3)', () => {
      const result = SendNotificationSchema.safeParse({
        title: 'Test Title',
        message: 'Test Message',
        sound: true,
      })
      expect(result.success).toBe(true)
    })

    it('should accept all optional parameters', () => {
      const result = SendNotificationSchema.safeParse({
        title: 'Test Title',
        message: 'Test Message',
        subtitle: 'Test Subtitle',
        sound: true,
      })
      expect(result.success).toBe(true)
    })

    it('should reject non-string title', () => {
      const result = SendNotificationSchema.safeParse({
        title: 123,
        message: 'Test Message',
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-boolean sound', () => {
      const result = SendNotificationSchema.safeParse({
        title: 'Test Title',
        message: 'Test Message',
        sound: 'yes',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('sendNotification (Req 7.1)', () => {
    itMacOS('should send notification with title and message', async () => {
      const result = await sendNotification({
        title: 'MCP Test',
        message: 'This is a test notification',
      })

      expect(result.success).toBe(true)
    })

    itMacOS('should confirm successful delivery (Req 7.4)', async () => {
      const result = await sendNotification({
        title: 'MCP Test',
        message: 'This is a test notification',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.message).toBeDefined()
        expect(typeof result.message).toBe('string')
      }
    })

    itMacOS('should send notification with subtitle (Req 7.2)', async () => {
      const result = await sendNotification({
        title: 'MCP Test',
        message: 'This is a test notification',
        subtitle: 'Test Subtitle',
      })

      expect(result.success).toBe(true)
    })

    itMacOS('should send notification with sound (Req 7.3)', async () => {
      const result = await sendNotification({
        title: 'MCP Test',
        message: 'This is a test notification',
        sound: true,
      })

      expect(result.success).toBe(true)
    })

    itMacOS(
      'should send notification without sound when disabled',
      async () => {
        const result = await sendNotification({
          title: 'MCP Test',
          message: 'Silent test notification',
          sound: false,
        })

        expect(result.success).toBe(true)
      },
    )

    itMacOS('should handle unicode in title and message', async () => {
      const result = await sendNotification({
        title: 'MCP \u30c6\u30b9\u30c8',
        message:
          '\u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059 \u2764\ufe0f',
      })

      expect(result.success).toBe(true)
    })

    itMacOS('should handle special characters', async () => {
      const result = await sendNotification({
        title: 'Test "Quotes"',
        message: "It's working with 'apostrophes' and \"quotes\"",
      })

      expect(result.success).toBe(true)
    })

    itMacOS('should send notification with all options', async () => {
      const input: SendNotificationInput = {
        title: 'Full Test',
        message: 'Testing all options',
        subtitle: 'Subtitle text',
        sound: true,
      }

      const result = await sendNotification(input)
      expect(result.success).toBe(true)
    })
  })

  describe('Return Type Interface', () => {
    itMacOS(
      'sendNotification should return success result with message or error',
      async () => {
        const result = await sendNotification({
          title: 'Test',
          message: 'Test',
        })

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
