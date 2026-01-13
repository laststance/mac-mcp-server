/**
 * Screenshot Tools Tests
 *
 * Tests for screenshot capture functionality including screen capture,
 * window capture, region capture, and output format options.
 *
 * @module screenshot.test
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 11.6
 */

import * as childProcess from 'child_process'
import * as fs from 'fs'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TakeScreenshotSchema, takeScreenshot } from './screenshot.js'

// Mock child_process.execFile
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

// Mock fs.promises
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs')
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
      unlink: vi.fn(),
      access: vi.fn(),
    },
  }
})

describe('Screenshot Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('TakeScreenshotSchema', () => {
    it('should accept empty object for full screen capture', () => {
      const result = TakeScreenshotSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should accept display parameter', () => {
      const result = TakeScreenshotSchema.safeParse({ display: 1 })
      expect(result.success).toBe(true)
    })

    it('should accept windowId parameter', () => {
      const result = TakeScreenshotSchema.safeParse({ windowId: 12345 })
      expect(result.success).toBe(true)
    })

    it('should accept region parameters', () => {
      const result = TakeScreenshotSchema.safeParse({
        region: { x: 100, y: 200, width: 800, height: 600 },
      })
      expect(result.success).toBe(true)
    })

    it('should accept format parameter (png)', () => {
      const result = TakeScreenshotSchema.safeParse({ format: 'png' })
      expect(result.success).toBe(true)
    })

    it('should accept format parameter (jpg)', () => {
      const result = TakeScreenshotSchema.safeParse({ format: 'jpg' })
      expect(result.success).toBe(true)
    })

    it('should accept filePath parameter', () => {
      const result = TakeScreenshotSchema.safeParse({
        filePath: '/tmp/screenshot.png',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid format', () => {
      const result = TakeScreenshotSchema.safeParse({ format: 'gif' })
      expect(result.success).toBe(false)
    })

    it('should reject negative region values', () => {
      const result = TakeScreenshotSchema.safeParse({
        region: { x: -10, y: 200, width: 800, height: 600 },
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-positive width/height', () => {
      const result = TakeScreenshotSchema.safeParse({
        region: { x: 0, y: 0, width: 0, height: 600 },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('takeScreenshot', () => {
    const mockExecFile = childProcess.execFile as unknown as ReturnType<
      typeof vi.fn
    >
    const mockReadFile = fs.promises.readFile as unknown as ReturnType<
      typeof vi.fn
    >
    const mockUnlink = fs.promises.unlink as unknown as ReturnType<typeof vi.fn>
    const mockAccess = fs.promises.access as unknown as ReturnType<typeof vi.fn>

    /**
     * Helper to setup successful screencapture execution
     *
     * @param imageData - Image data to return
     */
    function setupSuccessfulCapture(
      imageData: Buffer = Buffer.from('fake-image-data'),
    ): void {
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          _options: childProcess.ExecFileOptions,
          callback?: (
            error: Error | null,
            stdout: string,
            stderr: string,
          ) => void,
        ) => {
          if (callback) {
            callback(null, '', '')
          }
          return {} as childProcess.ChildProcess
        },
      )
      mockReadFile.mockResolvedValue(imageData)
      mockUnlink.mockResolvedValue(undefined)
    }

    /**
     * Helper to setup capture failure
     *
     * @param errorMessage - Error message to return
     */
    function setupCaptureFailed(errorMessage: string): void {
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          _options: childProcess.ExecFileOptions,
          callback?: (
            error: Error | null,
            stdout: string,
            stderr: string,
          ) => void,
        ) => {
          if (callback) {
            const error = new Error(errorMessage) as Error & {
              code?: number
              stderr?: string
            }
            error.code = 1
            error.stderr = errorMessage
            callback(error, '', errorMessage)
          }
          return {} as childProcess.ChildProcess
        },
      )
    }

    /**
     * Helper to get args from mock calls
     *
     * @returns Arguments passed to screencapture
     */
    function getScreencaptureArgs(): string[] {
      const calls = mockExecFile.mock.calls
      if (calls.length === 0) return []
      const [, args] = calls[0] as [string, string[]]
      return args
    }

    // =========================================================================
    // Task 9.1: Screen Capture Functionality
    // Requirements: 14.1, 14.2, 14.3, 14.4, 14.8, 11.6
    // =========================================================================

    describe('Full Screen Capture (Req 14.1)', () => {
      it('should capture entire primary screen when no parameters specified', async () => {
        const fakeImageData = Buffer.from('PNG-IMAGE-DATA')
        setupSuccessfulCapture(fakeImageData)

        const result = await takeScreenshot({})

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data?.base64).toBeDefined()
        expect(result.data?.format).toBe('png')
        // Verify screencapture was called
        expect(mockExecFile).toHaveBeenCalled()
        const args = getScreencaptureArgs()
        expect(args).toContain('-x') // Silent mode (no sound)
      })

      it('should return base64-encoded image data by default', async () => {
        const imageData = Buffer.from('test-png-data')
        setupSuccessfulCapture(imageData)

        const result = await takeScreenshot({})

        expect(result.success).toBe(true)
        expect(result.data?.base64).toBe(imageData.toString('base64'))
      })
    })

    describe('Display Capture (Req 14.2)', () => {
      it('should capture specified display when display parameter provided', async () => {
        setupSuccessfulCapture()

        const result = await takeScreenshot({ display: 2 })

        expect(result.success).toBe(true)
        expect(mockExecFile).toHaveBeenCalled()
        const args = getScreencaptureArgs()
        expect(args).toContain('-D')
        expect(args).toContain('2')
      })

      it('should handle display number 1 (primary)', async () => {
        setupSuccessfulCapture()

        const result = await takeScreenshot({ display: 1 })

        expect(result.success).toBe(true)
        const args = getScreencaptureArgs()
        expect(args).toContain('-D')
        expect(args).toContain('1')
      })
    })

    describe('Window Capture (Req 14.3, 14.8)', () => {
      it('should capture only specified window when windowId provided', async () => {
        setupSuccessfulCapture()

        const result = await takeScreenshot({ windowId: 12345 })

        expect(result.success).toBe(true)
        expect(mockExecFile).toHaveBeenCalled()
        const args = getScreencaptureArgs()
        expect(args).toContain('-l')
        expect(args).toContain('12345')
      })

      it('should return error when specified window does not exist (Req 14.8)', async () => {
        setupCaptureFailed('window not found')

        const result = await takeScreenshot({ windowId: 99999 })

        expect(result.success).toBe(false)
        expect(result.error).toContain('window')
      })
    })

    describe('Region Capture (Req 14.4)', () => {
      it('should capture rectangular region when coordinates provided', async () => {
        setupSuccessfulCapture()

        const result = await takeScreenshot({
          region: { x: 100, y: 200, width: 800, height: 600 },
        })

        expect(result.success).toBe(true)
        expect(mockExecFile).toHaveBeenCalled()
        const args = getScreencaptureArgs()
        expect(args).toContain('-R')
        // Region format: x,y,width,height
        expect(
          args.some((arg: string) => arg.includes('100,200,800,600')),
        ).toBe(true)
      })
    })

    describe('Screen Recording Permission (Req 11.6)', () => {
      it('should return error explaining how to grant permission when denied', async () => {
        setupCaptureFailed('screen recording permission denied')

        const result = await takeScreenshot({})

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
        // Should include guidance about Screen Recording permission
        expect(
          result.error?.toLowerCase().includes('screen recording') ||
            result.error?.toLowerCase().includes('permission'),
        ).toBe(true)
      })
    })

    // =========================================================================
    // Task 9.2: Screenshot Output Options
    // Requirements: 14.5, 14.6, 14.7
    // =========================================================================

    describe('Base64 Output (Req 14.5)', () => {
      it('should return screenshot as base64-encoded data by default', async () => {
        const imageData = Buffer.from('PNG-FILE-CONTENT')
        setupSuccessfulCapture(imageData)

        const result = await takeScreenshot({})

        expect(result.success).toBe(true)
        expect(result.data?.base64).toBe(imageData.toString('base64'))
        expect(result.data?.filePath).toBeUndefined()
      })
    })

    describe('Format Options (Req 14.6)', () => {
      it('should support PNG output format', async () => {
        setupSuccessfulCapture()

        const result = await takeScreenshot({ format: 'png' })

        expect(result.success).toBe(true)
        expect(result.data?.format).toBe('png')
        const args = getScreencaptureArgs()
        expect(args).toContain('-t')
        expect(args).toContain('png')
      })

      it('should support JPEG output format', async () => {
        setupSuccessfulCapture()

        const result = await takeScreenshot({ format: 'jpg' })

        expect(result.success).toBe(true)
        expect(result.data?.format).toBe('jpg')
        const args = getScreencaptureArgs()
        expect(args).toContain('-t')
        expect(args).toContain('jpg')
      })

      it('should default to PNG format when not specified', async () => {
        setupSuccessfulCapture()

        const result = await takeScreenshot({})

        expect(result.success).toBe(true)
        expect(result.data?.format).toBe('png')
      })
    })

    describe('File Path Output (Req 14.7)', () => {
      it('should save screenshot to specified file path when requested', async () => {
        const filePath = '/tmp/test-screenshot.png'
        mockExecFile.mockImplementation(
          (
            _cmd: string,
            _args: string[],
            _options: childProcess.ExecFileOptions,
            callback?: (
              error: Error | null,
              stdout: string,
              stderr: string,
            ) => void,
          ) => {
            if (callback) {
              callback(null, '', '')
            }
            return {} as childProcess.ChildProcess
          },
        )
        mockAccess.mockResolvedValue(undefined)

        const result = await takeScreenshot({ filePath })

        expect(result.success).toBe(true)
        expect(result.data?.filePath).toBe(filePath)
        expect(result.data?.base64).toBeUndefined()
        // Verify screencapture was called with the file path
        const args = getScreencaptureArgs()
        expect(args[args.length - 1]).toBe(filePath)
      })

      it('should use correct format extension for file path', async () => {
        const filePath = '/tmp/screenshot.jpg'
        mockExecFile.mockImplementation(
          (
            _cmd: string,
            _args: string[],
            _options: childProcess.ExecFileOptions,
            callback?: (
              error: Error | null,
              stdout: string,
              stderr: string,
            ) => void,
          ) => {
            if (callback) {
              callback(null, '', '')
            }
            return {} as childProcess.ChildProcess
          },
        )
        mockAccess.mockResolvedValue(undefined)

        const result = await takeScreenshot({ filePath, format: 'jpg' })

        expect(result.success).toBe(true)
        const args = getScreencaptureArgs()
        expect(args).toContain('-t')
        expect(args).toContain('jpg')
      })

      it('should return error if file save fails', async () => {
        const filePath = '/nonexistent/path/screenshot.png'
        setupCaptureFailed('failed to save screenshot')

        const result = await takeScreenshot({ filePath })

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })
    })

    describe('Combined Parameters', () => {
      it('should support display + format combination', async () => {
        setupSuccessfulCapture()

        const result = await takeScreenshot({ display: 2, format: 'jpg' })

        expect(result.success).toBe(true)
        const args = getScreencaptureArgs()
        expect(args).toContain('-D')
        expect(args).toContain('2')
        expect(args).toContain('-t')
        expect(args).toContain('jpg')
      })

      it('should support region + filePath combination', async () => {
        const filePath = '/tmp/region.png'
        mockExecFile.mockImplementation(
          (
            _cmd: string,
            _args: string[],
            _options: childProcess.ExecFileOptions,
            callback?: (
              error: Error | null,
              stdout: string,
              stderr: string,
            ) => void,
          ) => {
            if (callback) {
              callback(null, '', '')
            }
            return {} as childProcess.ChildProcess
          },
        )
        mockAccess.mockResolvedValue(undefined)

        const result = await takeScreenshot({
          region: { x: 0, y: 0, width: 1920, height: 1080 },
          filePath,
        })

        expect(result.success).toBe(true)
        const args = getScreencaptureArgs()
        expect(args).toContain('-R')
        expect(args[args.length - 1]).toBe(filePath)
      })
    })

    describe('Error Handling', () => {
      it('should handle screencapture command not found', async () => {
        mockExecFile.mockImplementation(
          (
            _cmd: string,
            _args: string[],
            _options: childProcess.ExecFileOptions,
            callback?: (
              error: Error | null,
              stdout: string,
              stderr: string,
            ) => void,
          ) => {
            if (callback) {
              const error = new Error('ENOENT') as Error & { code?: string }
              error.code = 'ENOENT'
              callback(error, '', '')
            }
            return {} as childProcess.ChildProcess
          },
        )

        const result = await takeScreenshot({})

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })

      it('should handle timeout during capture', async () => {
        mockExecFile.mockImplementation(
          (
            _cmd: string,
            _args: string[],
            _options: childProcess.ExecFileOptions,
            callback?: (
              error: Error | null,
              stdout: string,
              stderr: string,
            ) => void,
          ) => {
            if (callback) {
              const error = new Error('TIMEOUT') as Error & { killed?: boolean }
              error.killed = true
              callback(error, '', '')
            }
            return {} as childProcess.ChildProcess
          },
        )

        const result = await takeScreenshot({})

        expect(result.success).toBe(false)
        expect(result.error).toContain('timeout')
      })

      it('should clean up temp file on error during base64 conversion', async () => {
        mockExecFile.mockImplementation(
          (
            _cmd: string,
            _args: string[],
            _options: childProcess.ExecFileOptions,
            callback?: (
              error: Error | null,
              stdout: string,
              stderr: string,
            ) => void,
          ) => {
            if (callback) {
              callback(null, '', '')
            }
            return {} as childProcess.ChildProcess
          },
        )
        mockReadFile.mockRejectedValue(new Error('Read failed'))
        mockUnlink.mockResolvedValue(undefined)

        const result = await takeScreenshot({})

        expect(result.success).toBe(false)
        // Should attempt to clean up temp file
        expect(mockUnlink).toHaveBeenCalled()
      })
    })
  })
})
