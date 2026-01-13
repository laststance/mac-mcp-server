/**
 * Notification Display Tools
 *
 * Provides tools for displaying macOS system notifications.
 *
 * @module tools/notification
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { z } from 'zod'

import { executeAppleScript } from '../lib/executor.js'
import { sanitizeString } from '../lib/sanitizer.js'

/**
 * Input interface for sendNotification function.
 * @param title - Notification title (required)
 * @param message - Notification body message (required)
 * @param subtitle - Optional subtitle displayed below title
 * @param sound - Optional flag to play notification sound (default: false)
 */
export interface SendNotificationInput {
  title: string
  message: string
  subtitle?: string
  sound?: boolean
}

/**
 * Result type for sendNotification function.
 */
export interface SendNotificationResult {
  success: boolean
  message?: string
  error?: string
}

// Zod schema for MCP tool registration
export const SendNotificationSchema = z.object({
  title: z.string().describe('Notification title'),
  message: z.string().describe('Notification body message'),
  subtitle: z.string().optional().describe('Optional subtitle'),
  sound: z.boolean().optional().describe('Play notification sound'),
})

/**
 * Displays a macOS notification.
 *
 * Uses AppleScript's `display notification` command to show a system notification.
 * Supports optional subtitle and sound playback.
 *
 * @param input - Notification parameters
 * @returns Promise with success message or error
 *
 * @example
 * // Simple notification
 * await sendNotification({
 *   title: 'Task Complete',
 *   message: 'Build finished successfully',
 * })
 *
 * @example
 * // Full notification with sound
 * await sendNotification({
 *   title: 'Alert',
 *   message: 'Action required',
 *   subtitle: 'Please review',
 *   sound: true,
 * })
 */
export async function sendNotification(
  input: SendNotificationInput,
): Promise<SendNotificationResult> {
  const { title, message, subtitle, sound = false } = input

  // Sanitize inputs for AppleScript interpolation
  const sanitizedTitle = sanitizeString(title)
  const sanitizedMessage = sanitizeString(message)

  // Build the AppleScript command
  let script = `display notification "${sanitizedMessage}" with title "${sanitizedTitle}"`

  // Add optional subtitle
  if (subtitle) {
    const sanitizedSubtitle = sanitizeString(subtitle)
    script += ` subtitle "${sanitizedSubtitle}"`
  }

  // Add optional sound
  if (sound) {
    script += ' sound name "default"'
  }

  const result = await executeAppleScript({ script, timeout: 5000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to send notification',
    }
  }

  return {
    success: true,
    message: 'Notification sent successfully',
  }
}
