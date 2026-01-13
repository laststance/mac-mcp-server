/**
 * System Information Tools Tests
 *
 * Tests for system information retrieval tools: get_system_info, get_battery_status, get_display_info.
 * Uses TDD approach - tests written before implementation.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { platform } from 'os'

import { describe, it, expect } from 'vitest'

import {
  getSystemInfo,
  getBatteryStatus,
  getDisplayInfo,
  GetSystemInfoSchema,
  GetBatteryStatusSchema,
  GetDisplayInfoSchema,
  type SystemInfo,
  type BatteryStatus,
  type DisplayInfo,
} from '../../src/tools/system.js'

/**
 * Determines if the current platform is macOS.
 * @returns True if running on macOS (darwin)
 */
const isMacOS = platform() === 'darwin'

/**
 * Skip helper for macOS-only tests.
 */
const itMacOS = isMacOS ? it : it.skip

describe('SystemTools', () => {
  describe('Module Exports', () => {
    it('should export getSystemInfo function', () => {
      expect(typeof getSystemInfo).toBe('function')
    })

    it('should export getBatteryStatus function', () => {
      expect(typeof getBatteryStatus).toBe('function')
    })

    it('should export getDisplayInfo function', () => {
      expect(typeof getDisplayInfo).toBe('function')
    })

    it('should export GetSystemInfoSchema', () => {
      expect(GetSystemInfoSchema).toBeDefined()
    })

    it('should export GetBatteryStatusSchema', () => {
      expect(GetBatteryStatusSchema).toBeDefined()
    })

    it('should export GetDisplayInfoSchema', () => {
      expect(GetDisplayInfoSchema).toBeDefined()
    })
  })

  describe('Zod Schemas', () => {
    it('GetSystemInfoSchema should accept empty object', () => {
      const result = GetSystemInfoSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('GetBatteryStatusSchema should accept empty object', () => {
      const result = GetBatteryStatusSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('GetDisplayInfoSchema should accept empty object', () => {
      const result = GetDisplayInfoSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('getSystemInfo (Req 5.1)', () => {
    itMacOS('should return macOS version', async () => {
      const result = await getSystemInfo()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.macOSVersion).toBeDefined()
        expect(typeof result.data.macOSVersion).toBe('string')
        // macOS version should match pattern like "15.0" or "14.2.1"
        expect(result.data.macOSVersion).toMatch(/^\d+\.\d+(\.\d+)?/)
      }
    })

    itMacOS('should return hardware model', async () => {
      const result = await getSystemInfo()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.hardwareModel).toBeDefined()
        expect(typeof result.data.hardwareModel).toBe('string')
        expect(result.data.hardwareModel.length).toBeGreaterThan(0)
      }
    })

    itMacOS('should return processor info', async () => {
      const result = await getSystemInfo()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.processorInfo).toBeDefined()
        expect(typeof result.data.processorInfo).toBe('string')
        expect(result.data.processorInfo.length).toBeGreaterThan(0)
      }
    })

    itMacOS('should return total memory', async () => {
      const result = await getSystemInfo()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.totalMemory).toBeDefined()
        expect(typeof result.data.totalMemory).toBe('string')
        // Memory should be in format like "8 GB" or "16 GB"
        expect(result.data.totalMemory).toMatch(/\d+\s*GB/)
      }
    })

    itMacOS('should return all fields in SystemInfo interface', async () => {
      const result = await getSystemInfo()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        const info: SystemInfo = result.data
        expect(info).toHaveProperty('macOSVersion')
        expect(info).toHaveProperty('hardwareModel')
        expect(info).toHaveProperty('processorInfo')
        expect(info).toHaveProperty('totalMemory')
      }
    })
  })

  describe('getBatteryStatus (Req 5.2, 5.3)', () => {
    itMacOS('should return battery percentage as number 0-100', async () => {
      const result = await getBatteryStatus()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        if (!result.data.isDesktop) {
          expect(typeof result.data.percentage).toBe('number')
          expect(result.data.percentage).toBeGreaterThanOrEqual(0)
          expect(result.data.percentage).toBeLessThanOrEqual(100)
        }
      }
    })

    itMacOS('should return charging status as boolean', async () => {
      const result = await getBatteryStatus()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        if (!result.data.isDesktop) {
          expect(typeof result.data.isCharging).toBe('boolean')
        }
      }
    })

    itMacOS('should indicate desktop Mac with isDesktop flag', async () => {
      const result = await getBatteryStatus()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(typeof result.data.isDesktop).toBe('boolean')
        // If desktop, percentage should be -1 or similar indicator
        if (result.data.isDesktop) {
          expect(result.data.percentage).toBe(-1)
          expect(result.data.isCharging).toBe(false)
        }
      }
    })

    itMacOS('should return all fields in BatteryStatus interface', async () => {
      const result = await getBatteryStatus()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        const status: BatteryStatus = result.data
        expect(status).toHaveProperty('percentage')
        expect(status).toHaveProperty('isCharging')
        expect(status).toHaveProperty('isDesktop')
      }
    })
  })

  describe('getDisplayInfo (Req 5.4)', () => {
    itMacOS('should return array of displays', async () => {
      const result = await getDisplayInfo()
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(Array.isArray(result.data)).toBe(true)
        expect(result.data.length).toBeGreaterThan(0)
      }
    })

    itMacOS('should include display name', async () => {
      const result = await getDisplayInfo()
      expect(result.success).toBe(true)
      if (result.success && result.data && result.data.length > 0) {
        const display = result.data[0]!
        expect(display.name).toBeDefined()
        expect(typeof display.name).toBe('string')
      }
    })

    itMacOS('should include resolution with width and height', async () => {
      const result = await getDisplayInfo()
      expect(result.success).toBe(true)
      if (result.success && result.data && result.data.length > 0) {
        const display = result.data[0]!
        expect(display.resolution).toBeDefined()
        expect(typeof display.resolution.width).toBe('number')
        expect(typeof display.resolution.height).toBe('number')
        expect(display.resolution.width).toBeGreaterThan(0)
        expect(display.resolution.height).toBeGreaterThan(0)
      }
    })

    itMacOS('should indicate main display', async () => {
      const result = await getDisplayInfo()
      expect(result.success).toBe(true)
      if (result.success && result.data && result.data.length > 0) {
        // At least one display should be marked as main
        const hasMainDisplay = result.data.some(
          (d: DisplayInfo) => d.isMain === true,
        )
        expect(hasMainDisplay).toBe(true)
      }
    })

    itMacOS('should return all fields in DisplayInfo interface', async () => {
      const result = await getDisplayInfo()
      expect(result.success).toBe(true)
      if (result.success && result.data && result.data.length > 0) {
        const display: DisplayInfo = result.data[0]!
        expect(display).toHaveProperty('name')
        expect(display).toHaveProperty('resolution')
        expect(display.resolution).toHaveProperty('width')
        expect(display.resolution).toHaveProperty('height')
        expect(display).toHaveProperty('isMain')
      }
    })
  })

  describe('Return Type Interface', () => {
    itMacOS(
      'getSystemInfo should return success result with data or error',
      async () => {
        const result = await getSystemInfo()
        if (result.success) {
          expect(result.data).toBeDefined()
          expect(result.error).toBeUndefined()
        } else {
          expect(result.error).toBeDefined()
        }
      },
    )

    itMacOS(
      'getBatteryStatus should return success result with data or error',
      async () => {
        const result = await getBatteryStatus()
        if (result.success) {
          expect(result.data).toBeDefined()
          expect(result.error).toBeUndefined()
        } else {
          expect(result.error).toBeDefined()
        }
      },
    )

    itMacOS(
      'getDisplayInfo should return success result with data or error',
      async () => {
        const result = await getDisplayInfo()
        if (result.success) {
          expect(result.data).toBeDefined()
          expect(result.error).toBeUndefined()
        } else {
          expect(result.error).toBeDefined()
        }
      },
    )
  })
})
