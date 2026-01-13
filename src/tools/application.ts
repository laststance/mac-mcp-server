/**
 * Application Lifecycle Management Tools
 *
 * Provides tools for managing macOS applications: listing running apps,
 * launching, quitting, and activating applications.
 *
 * @module tools/application
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { z } from 'zod'

import { executeAppleScript } from '../lib/executor.js'
import { sanitizeIdentifier } from '../lib/sanitizer.js'

/**
 * Running application information.
 * @returns
 * - name: Application name (e.g., "Safari", "Finder")
 * - bundleId: Bundle identifier (e.g., "com.apple.Safari")
 * - processId: Unix process ID
 */
export interface RunningApp {
  name: string
  bundleId: string
  processId: number
}

/**
 * Result type for listRunningApps function.
 */
export interface ListRunningAppsResult {
  success: boolean
  data?: RunningApp[]
  error?: string
}

/**
 * Result type for action functions (launch, quit, activate).
 */
export interface AppActionResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Input type for app name parameter.
 */
export interface AppNameInput {
  name: string
}

// Zod schemas for MCP tool registration
export const ListRunningAppsSchema = z.object({})
export const LaunchAppSchema = z.object({
  name: z.string().describe('Application name to launch'),
})
export const QuitAppSchema = z.object({
  name: z.string().describe('Application name to quit'),
})
export const ActivateAppSchema = z.object({
  name: z.string().describe('Application name to bring to foreground'),
})

/**
 * Lists all running applications with their details.
 *
 * Returns running GUI applications (excludes background-only processes)
 * with their names, bundle identifiers, and process IDs.
 *
 * @returns Promise with array of RunningApp data or error
 *
 * @example
 * const result = await listRunningApps()
 * if (result.success) {
 *   result.data.forEach(app => {
 *     console.log(`${app.name} (${app.bundleId}) - PID: ${app.processId}`)
 *   })
 * }
 */
export async function listRunningApps(): Promise<ListRunningAppsResult> {
  // Use a simpler approach - get app info as pipe-delimited strings
  const script = `
    tell application "System Events"
      set appList to ""
      set allProcs to every process whose background only is false

      repeat with proc in allProcs
        try
          set appName to name of proc
          set bundleId to bundle identifier of proc
          if bundleId is missing value then
            set bundleId to ""
          end if
          set procId to unix id of proc

          -- Build pipe-delimited record: name|bundleId|processId
          set appRecord to appName & "|||" & bundleId & "|||" & procId

          if appList is "" then
            set appList to appRecord
          else
            set appList to appList & "~~~" & appRecord
          end if
        end try
      end repeat

      return appList
    end tell
  `

  const result = await executeAppleScript({ script, timeout: 15000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to list running applications',
    }
  }

  const output = result.output ?? ''

  // Handle empty list
  if (output === '') {
    return {
      success: true,
      data: [],
    }
  }

  // Parse the pipe-delimited output
  const apps: RunningApp[] = []
  const records = output.split('~~~')

  for (const record of records) {
    const parts = record.split('|||')
    if (parts.length >= 3) {
      const name = parts[0] ?? ''
      const bundleId = parts[1] ?? ''
      const processId = parseInt(parts[2] ?? '0', 10)

      if (name) {
        apps.push({
          name,
          bundleId,
          processId,
        })
      }
    }
  }

  return {
    success: true,
    data: apps,
  }
}

/**
 * Launches an application by name.
 *
 * Opens the specified application. If the app is already running,
 * it will be activated (brought to foreground).
 *
 * @param input - Object containing the application name
 * @returns Promise with success message or error
 *
 * @example
 * const result = await launchApp({ name: 'Safari' })
 * if (result.success) {
 *   console.log(result.message) // "Application 'Safari' launched successfully"
 * }
 */
export async function launchApp(input: AppNameInput): Promise<AppActionResult> {
  const { name } = input

  // Validate input
  if (!name || name.trim().length === 0) {
    return {
      success: false,
      error: 'Application name cannot be empty',
    }
  }

  let sanitizedName: string
  try {
    sanitizedName = sanitizeIdentifier(name)
  } catch {
    return {
      success: false,
      error: `Invalid application name: ${name}`,
    }
  }

  // Check if app exists before launching
  const checkScript = `
    try
      tell application "Finder"
        set appPath to (path to application "${sanitizedName}") as text
        return "EXISTS"
      end tell
    on error
      return "NOT_FOUND"
    end try
  `

  const checkResult = await executeAppleScript({
    script: checkScript,
    timeout: 10000,
  })

  if (checkResult.success && checkResult.output === 'NOT_FOUND') {
    return {
      success: false,
      error: `Application not found: ${name}`,
    }
  }

  // Launch the application
  const launchScript = `
    try
      tell application "${sanitizedName}" to activate
      return "SUCCESS"
    on error errMsg
      return "ERROR:" & errMsg
    end try
  `

  const result = await executeAppleScript({
    script: launchScript,
    timeout: 15000,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? `Failed to launch application: ${name}`,
    }
  }

  const output = result.output ?? ''

  if (output.startsWith('ERROR:')) {
    return {
      success: false,
      error: `Failed to launch application '${name}': ${output.substring(6)}`,
    }
  }

  return {
    success: true,
    message: `Application '${name}' launched successfully`,
  }
}

/**
 * Gracefully quits an application.
 *
 * Sends a quit command to the specified application. The app should
 * close gracefully, potentially prompting the user to save unsaved work.
 *
 * @param input - Object containing the application name
 * @returns Promise with success message or error
 *
 * @example
 * const result = await quitApp({ name: 'Safari' })
 * if (result.success) {
 *   console.log(result.message) // "Application 'Safari' quit successfully"
 * }
 */
export async function quitApp(input: AppNameInput): Promise<AppActionResult> {
  const { name } = input

  // Validate input
  if (!name || name.trim().length === 0) {
    return {
      success: false,
      error: 'Application name cannot be empty',
    }
  }

  let sanitizedName: string
  try {
    sanitizedName = sanitizeIdentifier(name)
  } catch {
    return {
      success: false,
      error: `Invalid application name: ${name}`,
    }
  }

  // Check if app is running first
  const checkScript = `
    tell application "System Events"
      set isRunning to (name of processes) contains "${sanitizedName}"
      if isRunning then
        return "RUNNING"
      else
        return "NOT_RUNNING"
      end if
    end tell
  `

  const checkResult = await executeAppleScript({
    script: checkScript,
    timeout: 5000,
  })

  if (checkResult.success && checkResult.output === 'NOT_RUNNING') {
    return {
      success: false,
      error: `Application '${name}' is not running`,
    }
  }

  // Quit the application
  const quitScript = `
    try
      tell application "${sanitizedName}" to quit
      return "SUCCESS"
    on error errMsg
      return "ERROR:" & errMsg
    end try
  `

  const result = await executeAppleScript({
    script: quitScript,
    timeout: 15000,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? `Failed to quit application: ${name}`,
    }
  }

  const output = result.output ?? ''

  if (output.startsWith('ERROR:')) {
    return {
      success: false,
      error: `Failed to quit application '${name}': ${output.substring(6)}`,
    }
  }

  return {
    success: true,
    message: `Application '${name}' quit successfully`,
  }
}

/**
 * Activates (brings to foreground) an application.
 *
 * Brings the specified application to the front, making it the active app.
 * If the app is not running, this will attempt to launch it.
 *
 * @param input - Object containing the application name
 * @returns Promise with success message or error
 *
 * @example
 * const result = await activateApp({ name: 'Finder' })
 * if (result.success) {
 *   console.log(result.message) // "Application 'Finder' activated successfully"
 * }
 */
export async function activateApp(
  input: AppNameInput,
): Promise<AppActionResult> {
  const { name } = input

  // Validate input
  if (!name || name.trim().length === 0) {
    return {
      success: false,
      error: 'Application name cannot be empty',
    }
  }

  let sanitizedName: string
  try {
    sanitizedName = sanitizeIdentifier(name)
  } catch {
    return {
      success: false,
      error: `Invalid application name: ${name}`,
    }
  }

  // Check if app exists
  const checkScript = `
    try
      tell application "Finder"
        set appPath to (path to application "${sanitizedName}") as text
        return "EXISTS"
      end tell
    on error
      return "NOT_FOUND"
    end try
  `

  const checkResult = await executeAppleScript({
    script: checkScript,
    timeout: 10000,
  })

  if (checkResult.success && checkResult.output === 'NOT_FOUND') {
    return {
      success: false,
      error: `Application not found: ${name}`,
    }
  }

  // Activate the application
  const activateScript = `
    try
      tell application "${sanitizedName}" to activate
      return "SUCCESS"
    on error errMsg
      return "ERROR:" & errMsg
    end try
  `

  const result = await executeAppleScript({
    script: activateScript,
    timeout: 10000,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? `Failed to activate application: ${name}`,
    }
  }

  const output = result.output ?? ''

  if (output.startsWith('ERROR:')) {
    return {
      success: false,
      error: `Failed to activate application '${name}': ${output.substring(6)}`,
    }
  }

  return {
    success: true,
    message: `Application '${name}' activated successfully`,
  }
}
