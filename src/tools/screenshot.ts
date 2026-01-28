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
 * Using 1600px to provide adequate safety margin for many-image sessions.
 */
const DEFAULT_MAX_DIMENSION = 1600

/**
 * Default maximum file size for screenshots returned as base64.
 * Claude API has ~20MB per request limit, but with many images,
 * keeping each under 1.8MB ensures ~10-20 screenshots per session safely.
 * Using 1.8MB (1,800,000 bytes) as a safe margin below 2MB.
 */
const DEFAULT_MAX_FILE_SIZE = 1_800_000

/**
 * Default JPEG quality for compressed screenshots.
 * 85 provides good visual quality with significant size reduction.
 */
const DEFAULT_JPEG_QUALITY = 85

/**
 * Minimum JPEG quality to maintain reasonable visual quality.
 */
const MIN_JPEG_QUALITY = 50

/**
 * Quality step for iterative compression.
 */
const QUALITY_STEP = 10

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
  /** Maximum dimension (width or height). Default: 1600. Set to 0 to disable resizing. Applies to both file and base64 output. */
  maxDimension?: number
  /** Maximum file size in bytes. Default: 1800000 (1.8MB). Set to 0 to disable compression. Applies to both file and base64 output. */
  maxFileSize?: number
  /** JPEG quality for compression (1-100). Default: 85. */
  quality?: number
  /** Skip resize/compression for file output. Default: false. Set to true to save at full resolution. */
  rawFile?: boolean
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
 * @param maxDimension - Maximum dimension (default: 1600, 0 to disable)
 * @param rawFile - Skip resize/compression for file output (default: false)
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
      'Maximum dimension (width or height). Default: 1600. Set to 0 to disable resizing. Applies to both file and base64 output.',
    ),
  maxFileSize: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Maximum file size in bytes. Default: 1800000 (1.8MB). Set to 0 to disable compression. Applies to both file and base64 output.',
    ),
  quality: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'JPEG quality for compression (1-100). Default: 85. Only used when compression is applied.',
    ),
  rawFile: z
    .boolean()
    .optional()
    .describe(
      'Skip resize/compression for file output. Default: false. Set to true to save at full resolution.',
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

/**
 * Gets file size in bytes.
 *
 * @param filePath - Path to the file
 * @returns File size in bytes
 *
 * @example
 * const size = await getFileSize('/tmp/screenshot.jpg')
 * // => 1234567 (bytes)
 */
async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.promises.stat(filePath)
  return stats.size
}

/**
 * Converts an image to JPEG format with specified quality.
 * Uses macOS sips command (no external dependencies).
 *
 * @param imagePath - Path to the image file (converted in-place, extension changes to .jpg)
 * @param quality - JPEG quality (1-100)
 * @returns Path to the converted JPEG file
 *
 * @example
 * const jpegPath = await convertToJpeg('/tmp/screenshot.png', 85)
 * // => '/tmp/screenshot.jpg'
 */
async function convertToJpeg(
  imagePath: string,
  quality: number,
): Promise<string> {
  // sips -s format jpeg -s formatOptions <quality> <file>
  await execFileAsync('sips', [
    '-s',
    'format',
    'jpeg',
    '-s',
    'formatOptions',
    String(quality),
    imagePath,
  ])

  // sips keeps the same filename but we need to rename to .jpg
  const jpegPath = imagePath.replace(/\.[^.]+$/, '.jpg')
  if (imagePath !== jpegPath) {
    await fs.promises.rename(imagePath, jpegPath)
  }

  return jpegPath
}

/**
 * Compresses an image to fit within maxFileSize using iterative JPEG quality reduction.
 * If minimum quality is reached and size still exceeds limit, reduces dimensions.
 *
 * @param imagePath - Path to the image file
 * @param maxFileSize - Maximum file size in bytes (0 to skip compression)
 * @param initialQuality - Initial JPEG quality (default: 85)
 * @param maxDimension - Maximum dimension for dimension reduction fallback
 * @returns Path to the compressed image (may be different if converted to JPEG)
 *
 * @example
 * // Compress a 3MB PNG to under 1.8MB
 * const result = await compressToTargetSize('/tmp/screenshot.png', 1_800_000, 85, 1920)
 * // => '/tmp/screenshot.jpg' (compressed)
 */
async function compressToTargetSize(
  imagePath: string,
  maxFileSize: number,
  initialQuality: number,
  maxDimension: number,
): Promise<string> {
  // Skip if compression is disabled
  if (maxFileSize <= 0) {
    return imagePath
  }

  // Check current file size
  let currentSize = await getFileSize(imagePath)
  if (currentSize <= maxFileSize) {
    return imagePath
  }

  // Convert to JPEG and iteratively reduce quality
  let currentPath = imagePath
  let quality = initialQuality

  while (currentSize > maxFileSize && quality >= MIN_JPEG_QUALITY) {
    currentPath = await convertToJpeg(currentPath, quality)
    currentSize = await getFileSize(currentPath)

    if (currentSize <= maxFileSize) {
      break
    }

    quality -= QUALITY_STEP
  }

  // If still too large, reduce dimensions and retry
  if (currentSize > maxFileSize && maxDimension > 0) {
    const dimensions = await getImageDimensions(currentPath)
    const reducedDimension = Math.floor(
      Math.max(dimensions.width, dimensions.height) * 0.75,
    )

    if (reducedDimension >= 640) {
      // Don't go below 640px
      await resizeImage(currentPath, reducedDimension)

      // One more compression attempt at minimum quality
      currentPath = await convertToJpeg(currentPath, MIN_JPEG_QUALITY)
    }
  }

  return currentPath
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
 * By default, all screenshots (both file and base64 output) are:
 * 1. Resized to fit within maxDimension (default: 1600px) for API compatibility
 * 2. Compressed to fit within maxFileSize (default: 1.8MB) using JPEG quality reduction
 *
 * @param input - Capture options
 * @param input.maxDimension - Max dimension (default: 1600, 0 to disable)
 * @param input.maxFileSize - Max file size in bytes (default: 1800000, 0 to disable)
 * @param input.quality - JPEG quality for compression (default: 85)
 * @param input.rawFile - Skip resize/compression for file output (default: false)
 * @returns
 * - On success: { success: true, data: { base64?, filePath?, format } }
 * - On failure: { success: false, error: string }
 *
 * @example
 * // Capture full screen (auto-resized and compressed)
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
 * // Capture region and save to file (auto-resized for API compatibility)
 * await takeScreenshot({
 *   region: { x: 100, y: 100, width: 800, height: 600 },
 *   filePath: '/tmp/screenshot.png'
 * })
 *
 * @example
 * // Save to file at full resolution (no resize/compression)
 * await takeScreenshot({ filePath: '/tmp/full.png', rawFile: true })
 *
 * @example
 * // Capture at full resolution for base64 (no resize/compression)
 * await takeScreenshot({ maxDimension: 0, maxFileSize: 0 })
 *
 * @example
 * // Custom compression: max 1MB, quality 70
 * await takeScreenshot({ maxFileSize: 1_000_000, quality: 70 })
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 11.6
 */
export async function takeScreenshot(
  input: ScreenshotInput,
): Promise<ScreenshotResult> {
  const format: ScreenshotFormat = input.format ?? 'png'
  const outputToFile = input.filePath !== undefined
  const maxDimension = input.maxDimension ?? DEFAULT_MAX_DIMENSION
  const maxFileSize = input.maxFileSize ?? DEFAULT_MAX_FILE_SIZE
  const quality = input.quality ?? DEFAULT_JPEG_QUALITY
  const rawFile = input.rawFile ?? false
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

        // Apply resize/compression unless rawFile is true
        if (!rawFile) {
          // Step 1: Resize image if needed to comply with API dimension limits
          // (Anthropic API: max 2000px when >20 images in request)
          await resizeImageIfNeeded(outputPath, maxDimension)

          // Step 2: Compress to target file size if needed
          // Converts to JPEG and iteratively reduces quality to meet size limit
          const compressedPath = await compressToTargetSize(
            outputPath,
            maxFileSize,
            quality,
            maxDimension,
          )

          // Determine final format (may have changed to jpg during compression)
          const finalFormat: ScreenshotFormat = compressedPath.endsWith('.jpg')
            ? 'jpg'
            : format

          // If compression changed the file path (PNG -> JPG), update the output
          if (compressedPath !== outputPath) {
            // Remove original file if different from compressed
            await cleanupTempFile(outputPath)
          }

          return {
            success: true,
            data: {
              filePath: compressedPath,
              format: finalFormat,
            },
          }
        }

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
        // Step 1: Resize image if needed to comply with API dimension limits
        // (Anthropic API: max 2000px when >20 images in request)
        await resizeImageIfNeeded(outputPath, maxDimension)

        // Step 2: Compress to target file size if needed
        // Converts to JPEG and iteratively reduces quality to meet size limit
        const compressedPath = await compressToTargetSize(
          outputPath,
          maxFileSize,
          quality,
          maxDimension,
        )

        // Determine final format (may have changed to jpg during compression)
        const finalFormat: ScreenshotFormat = compressedPath.endsWith('.jpg')
          ? 'jpg'
          : format

        const imageData = await fs.promises.readFile(compressedPath)
        const base64 = imageData.toString('base64')

        // Clean up temp files (original and compressed may be different)
        await cleanupTempFile(compressedPath)
        if (compressedPath !== outputPath) {
          await cleanupTempFile(outputPath)
        }

        return {
          success: true,
          data: {
            base64,
            format: finalFormat,
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
