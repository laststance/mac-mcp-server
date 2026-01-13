/**
 * AppleScript Executor
 *
 * Executes AppleScript commands via the osascript binary with timeout protection
 * and structured output parsing.
 *
 * @module executor
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 10.1, 10.4
 */

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Default timeout for AppleScript execution in milliseconds.
 * Scripts exceeding this duration will be terminated.
 */
export const DEFAULT_TIMEOUT = 30000

/**
 * Maximum buffer size for AppleScript output in bytes.
 * 10MB should handle most outputs including large UI element trees.
 */
const MAX_BUFFER = 10 * 1024 * 1024

/**
 * Options for AppleScript execution.
 */
export interface ExecuteOptions {
  /** The AppleScript code to execute */
  script: string
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number
}

/**
 * Result of AppleScript execution.
 */
export interface ExecuteResult {
  /** Whether the execution completed successfully */
  success: boolean
  /** Raw stdout output from osascript */
  output?: string
  /** Parsed output (JSON object/array, number, boolean, or null) */
  parsed?: unknown
  /** Error message if execution failed */
  error?: string
}

/**
 * Type guard interface for exec errors.
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
 * Validates script input.
 *
 * @param script - Script to validate
 * @returns Trimmed script if valid
 * @throws Error response if invalid
 */
function validateScript(script: string): string | ExecuteResult {
  const trimmed = script.trim()
  if (trimmed.length === 0) {
    return {
      success: false,
      error: 'Script cannot be empty',
    }
  }
  return trimmed
}

/**
 * Handles execution errors and returns appropriate result.
 *
 * @param error - Error from execFile
 * @param timeout - Timeout value for error message
 * @returns ExecuteResult with error details
 */
function handleExecutionError(error: unknown, timeout: number): ExecuteResult {
  if (isExecError(error)) {
    // Check for timeout (process killed)
    if (error.killed || error.signal === 'SIGKILL') {
      return {
        success: false,
        error: `Script execution timeout: exceeded ${timeout}ms limit`,
      }
    }

    // AppleScript error - stderr contains the error message
    const errorMessage =
      error.stderr?.trim() || error.message || 'Unknown AppleScript error'

    return {
      success: false,
      error: errorMessage,
    }
  }

  // Unknown error type
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error occurred',
  }
}

/**
 * Parses AppleScript output into structured data when possible.
 *
 * Attempts to parse the output as JSON. If parsing fails, returns the raw string.
 * Handles numbers, booleans, null, and JSON objects/arrays.
 *
 * @param output - Raw output string from osascript
 * @returns Parsed value or the original string if not parseable
 *
 * @example
 * parseAppleScriptOutput('{"key": "value"}') // => { key: 'value' }
 * parseAppleScriptOutput('42') // => 42
 * parseAppleScriptOutput('Hello') // => 'Hello'
 */
export function parseAppleScriptOutput(output: string): unknown {
  const trimmed = output.trim()

  // Handle empty string
  if (trimmed === '') {
    return ''
  }

  // Try to parse as JSON (handles objects, arrays, numbers, booleans, null)
  try {
    return JSON.parse(trimmed)
  } catch {
    // Not valid JSON, return as-is
    return trimmed
  }
}

/**
 * Executes an AppleScript command via osascript.
 *
 * Uses execFile for security (no shell interpretation). Enforces timeout
 * protection and parses output when possible.
 *
 * @param options - Execution options including script and optional timeout
 * @returns Execution result with success status, output, and any errors
 *
 * @example
 * // Simple execution
 * const result = await executeAppleScript({ script: 'return "hello"' })
 * // result: { success: true, output: 'hello', parsed: 'hello' }
 *
 * @example
 * // With timeout
 * const result = await executeAppleScript({
 *   script: 'delay 60',
 *   timeout: 5000
 * })
 * // result: { success: false, error: 'Script execution timeout...' }
 */
export async function executeAppleScript(
  options: ExecuteOptions,
): Promise<ExecuteResult> {
  const { script, timeout = DEFAULT_TIMEOUT } = options

  // Validate script
  const validationResult = validateScript(script)
  if (typeof validationResult !== 'string') {
    return validationResult
  }
  const trimmedScript = validationResult

  try {
    // Execute via osascript using execFile (no shell, more secure)
    const { stdout } = await execFileAsync('osascript', ['-e', trimmedScript], {
      timeout,
      maxBuffer: MAX_BUFFER,
      killSignal: 'SIGKILL', // Ensure process is killed on timeout
    })

    // Remove trailing newline that osascript adds
    const output = stdout.trimEnd()

    return {
      success: true,
      output,
      parsed: parseAppleScriptOutput(output),
    }
  } catch (error: unknown) {
    return handleExecutionError(error, timeout)
  }
}

/**
 * Executes an AppleScript with arguments passed to the script.
 *
 * For scripts that need external arguments, this function allows passing
 * them as separate parameters to osascript.
 *
 * @param script - The AppleScript code to execute
 * @param args - Arguments to pass to the script
 * @param timeout - Optional timeout in milliseconds
 * @returns Execution result
 *
 * @example
 * const result = await executeWithArgs(
 *   'on run argv\n  return item 1 of argv\nend run',
 *   ['hello']
 * )
 */
export async function executeWithArgs(
  script: string,
  args: string[],
  timeout: number = DEFAULT_TIMEOUT,
): Promise<ExecuteResult> {
  // Validate script
  const validationResult = validateScript(script)
  if (typeof validationResult !== 'string') {
    return validationResult
  }
  const trimmedScript = validationResult

  try {
    // Build osascript arguments: -e script, then pass args with --
    const osascriptArgs = ['-e', trimmedScript, '--', ...args]

    const { stdout } = await execFileAsync('osascript', osascriptArgs, {
      timeout,
      maxBuffer: MAX_BUFFER,
      killSignal: 'SIGKILL',
    })

    const output = stdout.trimEnd()

    return {
      success: true,
      output,
      parsed: parseAppleScriptOutput(output),
    }
  } catch (error: unknown) {
    return handleExecutionError(error, timeout)
  }
}
