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
 * Default maximum dimension for screenshots returned as base64.
 * Anthropic API limits images to 2000px when >20 images in a request.
 * Using 1920px as a safe margin.
 */
const DEFAULT_MAX_DIMENSION = 1920

/**
 * Supported output formats.
 */
type ScreenshotFormat = 'png' | 'jpg'

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Image dimensions returned by sips.
 */
interface ImageDimensions {
  width: number
  height: number
}

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
  /** Maximum dimension (width or height) for base64 output. Default: 1920. Set to 0 to disable resizing. */
  maxDimension?: number
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
 * @param maxDimension - Maximum dimension for base64 output (default: 1920, 0 to disable)
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
  maxDimension: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Maximum dimension (width or height) for base64 output. Default: 1920. Set to 0 to disable resizing.',
    ),
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

/**
 * Gets image dimensions using macOS sips command.
 *
 * @param imagePath - Path to the image file
 * @returns Image dimensions (width and height)
 * @throws Error if sips command fails or output cannot be parsed
 *
 * @example
 * const dims = await getImageDimensions('/tmp/screenshot.png')
 * // => { width: 2880, height: 1800 }
 */
async function getImageDimensions(imagePath: string): Promise<ImageDimensions> {
  const { stdout } = await execFileAsync('sips', [
    '-g',
    'pixelWidth',
    '-g',
    'pixelHeight',
    imagePath,
  ])

  // Parse sips output:
  // /path/to/image.png
  //   pixelWidth: 2880
  //   pixelHeight: 1800
  const widthMatch = /pixelWidth:\s*(\d+)/i.exec(stdout)
  const heightMatch = /pixelHeight:\s*(\d+)/i.exec(stdout)

  const width = widthMatch?.[1]
  const height = heightMatch?.[1]

  if (!width || !height) {
    throw new Error('Failed to parse image dimensions from sips output')
  }

  return {
    width: parseInt(width, 10),
    height: parseInt(height, 10),
  }
}

/**
 * Resizes an image to fit within maxDimension, maintaining aspect ratio.
 * Uses macOS sips command (no external dependencies).
 *
 * @param imagePath - Path to the image file (modified in-place)
 * @param maxDimension - Maximum width or height in pixels
 * @returns void
 *
 * @example
 * // Resize 2880x1800 image to fit within 1920px
 * await resizeImage('/tmp/screenshot.png', 1920)
 * // Result: 1920x1200 (aspect ratio preserved)
 */
async function resizeImage(
  imagePath: string,
  maxDimension: number,
): Promise<void> {
  // sips -Z <maxDimension> resizes to fit within maxDimension, preserving aspect ratio
  await execFileAsync('sips', ['-Z', String(maxDimension), imagePath])
}

/**
 * Resizes image if it exceeds maxDimension.
 * Only processes images where width or height > maxDimension.
 *
 * @param imagePath - Path to the image file
 * @param maxDimension - Maximum allowed dimension (0 to skip resizing)
 * @returns void
 *
 * @example
 * // 2880x1800 image with maxDimension=1920 -> resized to 1920x1200
 * await resizeImageIfNeeded('/tmp/screenshot.png', 1920)
 *
 * @example
 * // 800x600 image with maxDimension=1920 -> no change (already small)
 * await resizeImageIfNeeded('/tmp/small.png', 1920)
 */
async function resizeImageIfNeeded(
  imagePath: string,
  maxDimension: number,
): Promise<void> {
  // Skip if resizing is disabled
  if (maxDimension <= 0) {
    return
  }

  const dimensions = await getImageDimensions(imagePath)

  // Only resize if either dimension exceeds the limit
  if (dimensions.width > maxDimension || dimensions.height > maxDimension) {
    await resizeImage(imagePath, maxDimension)
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
 * For base64 output, images are automatically resized to fit within maxDimension
 * (default: 1920px) to comply with Anthropic API limits (max 2000px when >20 images).
 *
 * @param input - Capture options
 * @param input.maxDimension - Max dimension for base64 output (default: 1920, 0 to disable)
 * @returns
 * - On success: { success: true, data: { base64?, filePath?, format } }
 * - On failure: { success: false, error: string }
 *
 * @example
 * // Capture full screen (auto-resized to max 1920px for base64)
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
 * // Capture region and save to file (no resize for file output)
 * await takeScreenshot({
 *   region: { x: 100, y: 100, width: 800, height: 600 },
 *   filePath: '/tmp/screenshot.png'
 * })
 *
 * @example
 * // Capture at full resolution (disable resize)
 * await takeScreenshot({ maxDimension: 0 })
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 11.6
 */
export async function takeScreenshot(
  input: ScreenshotInput,
): Promise<ScreenshotResult> {
  const format: ScreenshotFormat = input.format ?? 'png'
  const outputToFile = input.filePath !== undefined
  const maxDimension = input.maxDimension ?? DEFAULT_MAX_DIMENSION
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
        // Resize image if needed to comply with API limits
        // (Anthropic API: max 2000px when >20 images in request)
        await resizeImageIfNeeded(outputPath, maxDimension)

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
