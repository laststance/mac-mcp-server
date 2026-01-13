/**
 * Finder Integration Tools
 *
 * Provides tools for interacting with Finder: revealing files,
 * getting selected files, and retrieving window paths.
 *
 * @module tools/finder
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import { z } from 'zod'

import { executeAppleScript } from '../lib/executor.js'
import { sanitizePath, sanitizeString } from '../lib/sanitizer.js'

/**
 * Result type for revealInFinder function.
 */
export interface RevealInFinderResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Result type for getSelectedFiles function.
 */
export interface GetSelectedFilesResult {
  success: boolean
  data?: string[]
  error?: string
}

/**
 * Result type for getFinderWindowPath function.
 */
export interface GetFinderWindowPathResult {
  success: boolean
  data?: string
  error?: string
}

/**
 * Input type for revealInFinder function.
 */
export interface RevealInFinderInput {
  path: string
}

// Zod schemas for MCP tool registration
export const RevealInFinderSchema = z.object({
  path: z.string().describe('File or folder path to reveal in Finder'),
})
export const GetSelectedFilesSchema = z.object({})
export const GetFinderWindowPathSchema = z.object({})

/**
 * Reveals a file or folder in Finder.
 *
 * Opens Finder and selects the specified file or folder.
 * Returns error if the path does not exist.
 *
 * @param input - Object containing the path to reveal
 * @returns Promise with success message or error
 *
 * @example
 * const result = await revealInFinder({ path: '/Applications' })
 * if (result.success) {
 *   console.log(result.message) // "Path revealed in Finder successfully"
 * }
 */
export async function revealInFinder(
  input: RevealInFinderInput,
): Promise<RevealInFinderResult> {
  const { path } = input

  // Validate and sanitize path
  let sanitizedPath: string
  try {
    sanitizedPath = sanitizePath(path)
  } catch (sanitizeError) {
    return {
      success: false,
      error:
        sanitizeError instanceof Error ? sanitizeError.message : 'Invalid path',
    }
  }

  // Check if path is empty after sanitization
  if (!sanitizedPath || sanitizedPath.trim().length === 0) {
    return {
      success: false,
      error: 'Path cannot be empty',
    }
  }

  // Escape the path for AppleScript string interpolation
  const escapedPath = sanitizeString(sanitizedPath)

  // Use a more reliable path existence check via shell
  const checkScript = `
    do shell script "test -e " & quoted form of "${escapedPath}" & " && echo 'EXISTS' || echo 'NOT_EXISTS'"
  `

  const checkResult = await executeAppleScript({
    script: checkScript,
    timeout: 5000,
  })

  if (checkResult.success && checkResult.output === 'NOT_EXISTS') {
    return {
      success: false,
      error: `Path does not exist: ${path}`,
    }
  }

  // Reveal in Finder
  const revealScript = `
    try
      tell application "Finder"
        reveal POSIX file "${escapedPath}"
        activate
      end tell
      return "SUCCESS"
    on error errMsg
      return "ERROR:" & errMsg
    end try
  `

  const result = await executeAppleScript({
    script: revealScript,
    timeout: 10000,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? `Failed to reveal path: ${path}`,
    }
  }

  const output = result.output ?? ''

  if (output.startsWith('ERROR:')) {
    // Check if error is about path not existing
    const errorMsg = output.substring(6).toLowerCase()
    if (
      errorMsg.includes('does not exist') ||
      errorMsg.includes("can't get") ||
      errorMsg.includes("can't handle")
    ) {
      return {
        success: false,
        error: `Path does not exist: ${path}`,
      }
    }
    return {
      success: false,
      error: `Failed to reveal path '${path}': ${output.substring(6)}`,
    }
  }

  return {
    success: true,
    message: `Path '${path}' revealed in Finder successfully`,
  }
}

/**
 * Gets the list of currently selected files in Finder.
 *
 * Returns POSIX paths of all selected files/folders in the
 * frontmost Finder window.
 *
 * @returns Promise with array of file paths or error
 *
 * @example
 * const result = await getSelectedFiles()
 * if (result.success) {
 *   result.data.forEach(path => {
 *     console.log('Selected:', path)
 *   })
 * }
 */
export async function getSelectedFiles(): Promise<GetSelectedFilesResult> {
  // Use a simpler approach: get file paths one at a time
  const script = `
    tell application "Finder"
      try
        set selectedItems to selection
        if (count of selectedItems) = 0 then
          return "[]"
        end if

        set pathList to ""
        repeat with selectedItem in selectedItems
          set itemPath to POSIX path of (selectedItem as alias)
          if pathList is "" then
            set pathList to itemPath
          else
            set pathList to pathList & "|||" & itemPath
          end if
        end repeat

        return pathList
      on error errMsg
        return "ERROR:" & errMsg
      end try
    end tell
  `

  const result = await executeAppleScript({ script, timeout: 10000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to get selected files',
    }
  }

  const output = result.output ?? ''

  if (output.startsWith('ERROR:')) {
    return {
      success: false,
      error: `Failed to get selected files: ${output.substring(6)}`,
    }
  }

  // Handle empty selection case
  if (output === '[]' || output === '') {
    return {
      success: true,
      data: [],
    }
  }

  // Parse the pipe-delimited paths
  const paths = output.split('|||').filter((p) => p.length > 0)
  return {
    success: true,
    data: paths,
  }
}

/**
 * Gets the path of the frontmost Finder window.
 *
 * Returns the POSIX path of the folder displayed in the
 * currently active Finder window.
 *
 * @returns Promise with path string or error
 *
 * @example
 * const result = await getFinderWindowPath()
 * if (result.success) {
 *   console.log('Current Finder path:', result.data)
 * }
 */
export async function getFinderWindowPath(): Promise<GetFinderWindowPathResult> {
  const script = `
    tell application "Finder"
      try
        if (count of Finder windows) = 0 then
          return "NO_WINDOW"
        end if

        set frontWindow to front Finder window
        set windowTarget to target of frontWindow

        -- Get POSIX path
        set windowPath to POSIX path of (windowTarget as alias)
        return windowPath
      on error errMsg
        return "ERROR:" & errMsg
      end try
    end tell
  `

  const result = await executeAppleScript({ script, timeout: 5000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to get Finder window path',
    }
  }

  const output = result.output ?? ''

  if (output === 'NO_WINDOW') {
    return {
      success: true,
      // No Finder window is open, return success with no data
    }
  }

  if (output.startsWith('ERROR:')) {
    return {
      success: false,
      error: `Failed to get Finder window path: ${output.substring(6)}`,
    }
  }

  return {
    success: true,
    data: output,
  }
}
