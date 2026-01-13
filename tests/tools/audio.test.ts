/**
 * Audio Control Tools Tests
 *
 * Tests for audio control tools: get_volume, set_volume, get_mute_status, set_mute.
 * Uses TDD approach - tests written before implementation.
 *
 * NOTE: Integration tests that actually change volume/mute are skipped by default
 * to avoid playing sounds during test runs. Set AUDIO_TEST=1 to enable.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

import { platform } from 'os'

import { describe, it, expect } from 'vitest'

import {
  getVolume,
  setVolume,
  getMuteStatus,
  setMute,
  GetVolumeSchema,
  SetVolumeSchema,
  GetMuteStatusSchema,
  SetMuteSchema,
} from '../../src/tools/audio.js'

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
 * Skip helper for audio tests that actually change volume/mute.
 * These are skipped by default to avoid playing sounds.
 * Set AUDIO_TEST=1 environment variable to enable.
 */
const itAudioIntegration = process.env['AUDIO_TEST'] === '1' ? itMacOS : it.skip

describe('AudioTools', () => {
  describe('Module Exports', () => {
    it('should export getVolume function', () => {
      expect(typeof getVolume).toBe('function')
    })

    it('should export setVolume function', () => {
      expect(typeof setVolume).toBe('function')
    })

    it('should export getMuteStatus function', () => {
      expect(typeof getMuteStatus).toBe('function')
    })

    it('should export setMute function', () => {
      expect(typeof setMute).toBe('function')
    })

    it('should export GetVolumeSchema', () => {
      expect(GetVolumeSchema).toBeDefined()
    })

    it('should export SetVolumeSchema', () => {
      expect(SetVolumeSchema).toBeDefined()
    })

    it('should export GetMuteStatusSchema', () => {
      expect(GetMuteStatusSchema).toBeDefined()
    })

    it('should export SetMuteSchema', () => {
      expect(SetMuteSchema).toBeDefined()
    })
  })

  describe('Zod Schemas', () => {
    it('GetVolumeSchema should accept empty object', () => {
      const result = GetVolumeSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('GetMuteStatusSchema should accept empty object', () => {
      const result = GetMuteStatusSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('SetVolumeSchema should accept value between 0-100', () => {
      expect(SetVolumeSchema.safeParse({ value: 0 }).success).toBe(true)
      expect(SetVolumeSchema.safeParse({ value: 50 }).success).toBe(true)
      expect(SetVolumeSchema.safeParse({ value: 100 }).success).toBe(true)
    })

    it('SetVolumeSchema should reject value below 0 (Req 9.3)', () => {
      const result = SetVolumeSchema.safeParse({ value: -1 })
      expect(result.success).toBe(false)
    })

    it('SetVolumeSchema should reject value above 100 (Req 9.3)', () => {
      const result = SetVolumeSchema.safeParse({ value: 101 })
      expect(result.success).toBe(false)
    })

    it('SetVolumeSchema should reject missing value', () => {
      const result = SetVolumeSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('SetMuteSchema should accept boolean muted', () => {
      expect(SetMuteSchema.safeParse({ muted: true }).success).toBe(true)
      expect(SetMuteSchema.safeParse({ muted: false }).success).toBe(true)
    })

    it('SetMuteSchema should reject non-boolean muted', () => {
      const result = SetMuteSchema.safeParse({ muted: 'yes' })
      expect(result.success).toBe(false)
    })

    it('SetMuteSchema should reject missing muted', () => {
      const result = SetMuteSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('getVolume (Req 9.1)', () => {
    itMacOS('should return volume as percentage 0-100', async () => {
      const result = await getVolume()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(typeof result.data.volume).toBe('number')
        expect(result.data.volume).toBeGreaterThanOrEqual(0)
        expect(result.data.volume).toBeLessThanOrEqual(100)
      }
    })

    itMacOS('should return integer volume value', async () => {
      const result = await getVolume()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(Number.isInteger(result.data.volume)).toBe(true)
      }
    })
  })

  describe('setVolume (Req 9.2)', () => {
    itAudioIntegration(
      'should set volume to specified percentage',
      async () => {
        const testVolume = 42

        const setResult = await setVolume({ value: testVolume })
        expect(setResult.success).toBe(true)

        // Verify by reading back
        const getResult = await getVolume()
        expect(getResult.success).toBe(true)
        if (getResult.success && getResult.data) {
          // Volume might be slightly different due to system rounding
          expect(getResult.data.volume).toBeGreaterThanOrEqual(testVolume - 2)
          expect(getResult.data.volume).toBeLessThanOrEqual(testVolume + 2)
        }
      },
    )

    itAudioIntegration('should set volume to 0', async () => {
      const result = await setVolume({ value: 0 })
      expect(result.success).toBe(true)

      const getResult = await getVolume()
      if (getResult.success && getResult.data) {
        expect(getResult.data.volume).toBeLessThanOrEqual(2)
      }
    })

    itAudioIntegration('should set volume to 100', async () => {
      const result = await setVolume({ value: 100 })
      expect(result.success).toBe(true)

      const getResult = await getVolume()
      if (getResult.success && getResult.data) {
        expect(getResult.data.volume).toBeGreaterThanOrEqual(98)
      }
    })

    itAudioIntegration('should confirm successful operation', async () => {
      const result = await setVolume({ value: 50 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.message).toBeDefined()
      }
    })
  })

  describe('getMuteStatus (Req 9.4)', () => {
    itMacOS('should return mute status as boolean', async () => {
      const result = await getMuteStatus()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(typeof result.data.muted).toBe('boolean')
      }
    })
  })

  describe('setMute (Req 9.5, 9.6)', () => {
    itAudioIntegration(
      'should mute system audio when set to true (Req 9.5)',
      async () => {
        const result = await setMute({ muted: true })
        expect(result.success).toBe(true)

        const status = await getMuteStatus()
        if (status.success && status.data) {
          expect(status.data.muted).toBe(true)
        }
      },
    )

    itAudioIntegration(
      'should unmute system audio when set to false (Req 9.6)',
      async () => {
        // First mute
        await setMute({ muted: true })

        // Then unmute
        const result = await setMute({ muted: false })
        expect(result.success).toBe(true)

        const status = await getMuteStatus()
        if (status.success && status.data) {
          expect(status.data.muted).toBe(false)
        }
      },
    )

    itAudioIntegration('should confirm successful mute operation', async () => {
      const result = await setMute({ muted: true })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.message).toBeDefined()
      }
    })

    itAudioIntegration(
      'should confirm successful unmute operation',
      async () => {
        const result = await setMute({ muted: false })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.message).toBeDefined()
        }
      },
    )
  })

  describe('Return Type Interface', () => {
    itMacOS(
      'getVolume should return success result with data or error',
      async () => {
        const result = await getVolume()
        if (result.success) {
          expect(result.data).toBeDefined()
          expect(result.error).toBeUndefined()
        } else {
          expect(result.error).toBeDefined()
        }
      },
    )

    itAudioIntegration(
      'setVolume should return success result with message or error',
      async () => {
        const result = await setVolume({ value: 50 })
        if (result.success) {
          expect(result.message).toBeDefined()
          expect(result.error).toBeUndefined()
        } else {
          expect(result.error).toBeDefined()
        }
      },
    )

    itMacOS(
      'getMuteStatus should return success result with data or error',
      async () => {
        const result = await getMuteStatus()
        if (result.success) {
          expect(result.data).toBeDefined()
          expect(result.error).toBeUndefined()
        } else {
          expect(result.error).toBeDefined()
        }
      },
    )

    itAudioIntegration(
      'setMute should return success result with message or error',
      async () => {
        const result = await setMute({ muted: false })
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
