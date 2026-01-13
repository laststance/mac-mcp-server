/**
 * Audio Control Tools
 *
 * Provides tools for controlling system audio volume and mute state.
 *
 * @module tools/audio
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

import { z } from 'zod'

import { executeAppleScript } from '../lib/executor.js'

/**
 * Volume data interface.
 * @returns volume - System volume as percentage (0-100)
 */
export interface VolumeData {
  volume: number
}

/**
 * Mute status interface.
 * @returns muted - True if system audio is muted
 */
export interface MuteData {
  muted: boolean
}

/**
 * Result type for getVolume function.
 */
export interface GetVolumeResult {
  success: boolean
  data?: VolumeData
  error?: string
}

/**
 * Result type for setVolume function.
 */
export interface SetVolumeResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Input type for setVolume function.
 */
export interface SetVolumeInput {
  value: number
}

/**
 * Result type for getMuteStatus function.
 */
export interface GetMuteResult {
  success: boolean
  data?: MuteData
  error?: string
}

/**
 * Result type for setMute function.
 */
export interface SetMuteResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Input type for setMute function.
 */
export interface SetMuteInput {
  muted: boolean
}

// Zod schemas for MCP tool registration
export const GetVolumeSchema = z.object({})
export const SetVolumeSchema = z.object({
  value: z.number().min(0).max(100).describe('Volume percentage (0-100)'),
})
export const GetMuteStatusSchema = z.object({})
export const SetMuteSchema = z.object({
  muted: z.boolean().describe('Mute state'),
})

/**
 * Retrieves the current system volume.
 *
 * @returns Promise with volume percentage (0-100) or error
 *
 * @example
 * const result = await getVolume()
 * if (result.success) {
 *   console.log(`Volume: ${result.data.volume}%`)
 * }
 */
export async function getVolume(): Promise<GetVolumeResult> {
  const script = `output volume of (get volume settings)`

  const result = await executeAppleScript({ script, timeout: 5000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to get volume',
    }
  }

  // Parse the volume value (0-100)
  const volume =
    typeof result.parsed === 'number'
      ? Math.round(result.parsed)
      : parseInt(result.output ?? '0', 10)

  return {
    success: true,
    data: {
      volume: Math.max(0, Math.min(100, volume)),
    },
  }
}

/**
 * Sets the system volume to a specified percentage.
 *
 * @param input - Object containing volume value (0-100)
 * @returns Promise with success message or error
 *
 * @example
 * const result = await setVolume({ value: 50 })
 * if (result.success) {
 *   console.log('Volume set to 50%')
 * }
 */
export async function setVolume(
  input: SetVolumeInput,
): Promise<SetVolumeResult> {
  const { value } = input

  // Validate range (also enforced by Zod schema)
  if (value < 0 || value > 100) {
    return {
      success: false,
      error: `Volume must be between 0 and 100, received ${value}`,
    }
  }

  const script = `set volume output volume ${Math.round(value)}`

  const result = await executeAppleScript({ script, timeout: 5000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to set volume',
    }
  }

  return {
    success: true,
    message: `Volume set to ${Math.round(value)}%`,
  }
}

/**
 * Retrieves the current mute status.
 *
 * @returns Promise with mute status (true = muted) or error
 *
 * @example
 * const result = await getMuteStatus()
 * if (result.success) {
 *   console.log(result.data.muted ? 'Muted' : 'Unmuted')
 * }
 */
export async function getMuteStatus(): Promise<GetMuteResult> {
  const script = `output muted of (get volume settings)`

  const result = await executeAppleScript({ script, timeout: 5000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to get mute status',
    }
  }

  // Parse the mute status (AppleScript returns "true" or "false")
  const muted =
    result.parsed === true || result.output?.toLowerCase() === 'true'

  return {
    success: true,
    data: {
      muted,
    },
  }
}

/**
 * Sets the system mute state.
 *
 * @param input - Object containing muted boolean
 * @returns Promise with success message or error
 *
 * @example
 * // Mute audio
 * await setMute({ muted: true })
 *
 * @example
 * // Unmute audio
 * await setMute({ muted: false })
 */
export async function setMute(input: SetMuteInput): Promise<SetMuteResult> {
  const { muted } = input

  const script = `set volume output muted ${muted}`

  const result = await executeAppleScript({ script, timeout: 5000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to set mute status',
    }
  }

  return {
    success: true,
    message: muted ? 'Audio muted' : 'Audio unmuted',
  }
}
