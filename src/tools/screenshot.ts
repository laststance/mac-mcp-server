/**
 * Screenshot Tools
 *
 * Tools for capturing screenshots on macOS using the screencapture command.
 * Supports full screen, display, window, and region capture with PNG/JPEG output.
 *
 * @module screenshot
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 11.6
 */

import { execFile } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'

import { z } from 'zod'

import { getPermissionGuidance } from '../lib/permission.js'
import { sanitizePath } from '../lib/sanitizer.js'

const execFileAsync = promisify(execFile)

// ============================================================================
// Constants
// ============================================================================

/**
 * Default timeout for screenshot capture in milliseconds.
 */
const DEFAULT_TIMEOUT = 30000

/**
 * Supported output formats.
 */
type ScreenshotFormat = 'png' | 'jpg'

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Region specification for partial screen capture.
 */
export interface ScreenshotRegion {
  /** X coordinate of top-left corner */
  x: number
  /** Y coordinate of top-left corner */
  y: number
  /** Width of capture region */
  width: number
  /** Height of capture region */
  height: number
}

/**
 * Input parameters for take_screenshot tool.
 */
export interface ScreenshotInput {
  /** Display number to capture (1-based) */
  display?: number
  /** Window ID to capture */
  windowId?: number
  /** Region coordinates for partial capture */
  region?: ScreenshotRegion
  /** Output format (png or jpg) */
  format?: ScreenshotFormat
  /** File path to save screenshot (if not provided, returns base64) */
  filePath?: string
}

/**
 * Screenshot capture result data.
 */
export interface ScreenshotData {
  /** Base64-encoded image data (when filePath not specified) */
  base64?: string
  /** File path where screenshot was saved (when filePath specified) */
  filePath?: string
  /** Output format used */
  format: ScreenshotFormat
}

/**
 * Result of screenshot capture operation.
 */
export interface ScreenshotResult {
  /** Whether the capture succeeded */
  success: boolean
  /** Screenshot data on success */
  data?: ScreenshotData
  /** Error message on failure */
  error?: string
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for region parameter.
 */
const RegionSchema = z.object({
  x: z.number().int().nonnegative().describe('X coordinate of top-left corner'),
  y: z.number().int().nonnegative().describe('Y coordinate of top-left corner'),
  width: z.number().int().positive().describe('Width of capture region'),
  height: z.number().int().positive().describe('Height of capture region'),
})

/**
 * Schema for take_screenshot tool.
 *
 * @param display - Display number to capture (1-based)
 * @param windowId - Window ID to capture
 * @param region - Region coordinates for partial capture
 * @param format - Output format (png or jpg, defaults to png)
 * @param filePath - File path to save screenshot
 */
export const TakeScreenshotSchema = z.object({
  display: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Display number to capture (1-based)'),
  windowId: z.number().int().optional().describe('Window ID to capture'),
  region: RegionSchema.optional().describe(
    'Region coordinates for partial capture',
  ),
  format: z
    .enum(['png', 'jpg'])
    .optional()
    .default('png')
    .describe('Output format (png or jpg)'),
  filePath: z
    .string()
    .optional()
    .describe('File path to save screenshot (returns base64 if not specified)'),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Type guard for exec errors.
 */
interface ExecError extends Error {
  code?: number | string
  signal?: string
  killed?: boolean
  stdout?: string
  stderr?: string
}

/**
 * Type guard for exec errors.
 *
 * @param error - Error to check
 * @returns True if error has exec-specific properties
 */
function isExecError(error: unknown): error is ExecError {
  return (
    error instanceof Error &&
    ('code' in error || 'signal' in error || 'killed' in error)
  )
}

/**
 * Generates a temporary file path for screenshot capture.
 *
 * @param format - Screenshot format
 * @returns Temporary file path
 */
function getTempFilePath(format: ScreenshotFormat): string {
  const tempDir = os.tmpdir()
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return path.join(tempDir, `screenshot_${timestamp}_${random}.${format}`)
}

/**
 * Builds screencapture command arguments.
 *
 * @param input - Screenshot input parameters
 * @param outputPath - Output file path
 * @returns Array of command arguments
 */
function buildScreencaptureArgs(
  input: ScreenshotInput,
  outputPath: string,
): string[] {
  const args: string[] = ['-x'] // Silent mode (no sound)
  const format = input.format ?? 'png'

  // Add format option
  args.push('-t', format)

  // Add capture mode options
  if (input.display !== undefined) {
    // Capture specific display
    args.push('-D', String(input.display))
  } else if (input.windowId !== undefined) {
    // Capture specific window
    args.push('-l', String(input.windowId))
  } else if (input.region !== undefined) {
    // Capture specific region
    const { x, y, width, height } = input.region
    args.push('-R', `${x},${y},${width},${height}`)
  }
  // No additional flags = capture entire primary screen

  // Output file path (must be last)
  args.push(outputPath)

  return args
}

/**
 * Parses screencapture errors to provide user-friendly messages.
 *
 * @param error - Error from screencapture execution
 * @param input - Original input parameters
 * @returns User-friendly error message
 */
function parseScreencaptureError(
  error: unknown,
  input: ScreenshotInput,
): string {
  if (isExecError(error)) {
    // Check for timeout
    if (error.killed) {
      return 'Screenshot capture timeout: operation exceeded time limit'
    }

    const errorMessage =
      error.stderr?.toLowerCase() ?? error.message?.toLowerCase() ?? ''

    // Check for permission errors
    if (
      errorMessage.includes('screen recording') ||
      errorMessage.includes('permission') ||
      errorMessage.includes('not permitted') ||
      errorMessage.includes('-1009')
    ) {
      return getPermissionGuidance('screenRecording')
    }

    // Check for window not found
    if (input.windowId !== undefined && errorMessage.includes('window')) {
      return `Window not found: window ID ${input.windowId} does not exist`
    }

    // Check for command not found
    if (error.code === 'ENOENT') {
      return 'screencapture command not found. This tool requires macOS.'
    }

    // Return original error message
    return error.message || 'Screenshot capture failed'
  }

  return error instanceof Error ? error.message : 'Unknown error occurred'
}

/**
 * Cleans up temporary file, ignoring errors.
 *
 * @param filePath - File path to delete
 */
async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath)
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Captures a screenshot on macOS.
 *
 * Uses the native screencapture command for reliable capture.
 * Supports full screen, display, window, and region capture.
 *
 * @param input - Capture options
 * @returns
 * - On success: { success: true, data: { base64?, filePath?, format } }
 * - On failure: { success: false, error: string }
 *
 * @example
 * // Capture full screen
 * await takeScreenshot({})
 *
 * @example
 * // Capture specific display
 * await takeScreenshot({ display: 2 })
 *
 * @example
 * // Capture window by ID
 * await takeScreenshot({ windowId: 12345 })
 *
 * @example
 * // Capture region and save to file
 * await takeScreenshot({
 *   region: { x: 100, y: 100, width: 800, height: 600 },
 *   filePath: '/tmp/screenshot.png'
 * })
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 11.6
 */
export async function takeScreenshot(
  input: ScreenshotInput,
): Promise<ScreenshotResult> {
  const format: ScreenshotFormat = input.format ?? 'png'
  const outputToFile = input.filePath !== undefined
  let outputPath: string

  // Determine output path
  if (outputToFile) {
    try {
      outputPath = sanitizePath(input.filePath!)
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Invalid file path',
      }
    }
  } else {
    // Use temp file for base64 output
    outputPath = getTempFilePath(format)
  }

  // Build screencapture arguments
  const args = buildScreencaptureArgs(input, outputPath)

  try {
    // Execute screencapture command
    await execFileAsync('screencapture', args, {
      timeout: DEFAULT_TIMEOUT,
      killSignal: 'SIGKILL',
    })

    // Handle output
    if (outputToFile) {
      // Verify file was created
      try {
        await fs.promises.access(outputPath)
        return {
          success: true,
          data: {
            filePath: outputPath,
            format,
          },
        }
      } catch {
        return {
          success: false,
          error: `Failed to save screenshot to ${outputPath}`,
        }
      }
    } else {
      // Read temp file and convert to base64
      try {
        const imageData = await fs.promises.readFile(outputPath)
        const base64 = imageData.toString('base64')

        // Clean up temp file
        await cleanupTempFile(outputPath)

        return {
          success: true,
          data: {
            base64,
            format,
          },
        }
      } catch {
        // Clean up temp file on error
        await cleanupTempFile(outputPath)
        return {
          success: false,
          error: 'Failed to read screenshot data',
        }
      }
    }
  } catch (error) {
    // Clean up temp file if it exists
    if (!outputToFile) {
      await cleanupTempFile(outputPath)
    }

    return {
      success: false,
      error: parseScreencaptureError(error, input),
    }
  }
}
