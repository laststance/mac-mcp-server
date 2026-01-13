/**
 * Permission Manager
 *
 * Detects macOS permission status and generates user-friendly guidance.
 * Handles Accessibility, Automation, and Screen Recording permissions.
 *
 * @module permission
 * Requirements: 11.1, 11.5, 11.6, 11.7
 */

import { executeAppleScript } from './executor.js'
import { sanitizeIdentifier } from './sanitizer.js'

/**
 * Types of macOS permissions that can be checked.
 */
export type PermissionType = 'accessibility' | 'automation' | 'screenRecording'

/**
 * Result of a permission check operation.
 */
export interface PermissionStatus {
  /** Whether the permission is currently granted */
  granted: boolean
  /** Type of permission that was checked */
  type: PermissionType
  /** Guidance on how to grant the permission (present when denied) */
  guidance?: string
}

/**
 * Cache entry for permission status with timestamp.
 */
interface CacheEntry {
  status: PermissionStatus
  timestamp: number
}

/**
 * Cache for permission status to avoid repeated checks.
 * Key format: 'accessibility', 'automation:AppName', 'screenRecording'
 */
const permissionCache: Map<string, CacheEntry> = new Map()

/**
 * Cache time-to-live in milliseconds.
 * Permissions rarely change during a session, so 5 seconds is reasonable.
 */
const CACHE_TTL = 5000

/**
 * System Settings URL paths for each permission type (macOS Ventura+).
 */
const SETTINGS_PATHS: Record<PermissionType, string> = {
  accessibility:
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  automation:
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
  screenRecording:
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
}

/**
 * Clears the permission cache.
 * Call this when you want to force a fresh permission check.
 *
 * @example
 * clearPermissionCache();
 * const result = await checkAccessibility(); // Fresh check
 */
export function clearPermissionCache(): void {
  permissionCache.clear()
}

/**
 * Checks if a cached entry is still valid based on TTL.
 *
 * @param cacheKey - The cache key to check
 * @returns The cached status if valid, undefined otherwise
 */
function getCachedStatus(cacheKey: string): PermissionStatus | undefined {
  const entry = permissionCache.get(cacheKey)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.status
  }
  // Cache expired or doesn't exist, remove stale entry
  if (entry) {
    permissionCache.delete(cacheKey)
  }
  return undefined
}

/**
 * Caches a permission status result.
 *
 * @param cacheKey - The cache key
 * @param status - The permission status to cache
 */
function cacheStatus(cacheKey: string, status: PermissionStatus): void {
  permissionCache.set(cacheKey, {
    status,
    timestamp: Date.now(),
  })
}

/**
 * Returns actionable guidance for granting a specific permission.
 *
 * @param type - The type of permission
 * @param appName - Optional app name for automation permission
 * @returns User-friendly guidance message with System Settings path
 *
 * @example
 * getPermissionGuidance('accessibility')
 * // => "Accessibility permission is required. Grant access in System Settings > Privacy & Security > Accessibility..."
 */
export function getPermissionGuidance(
  type: PermissionType,
  appName?: string,
): string {
  const basePath = 'System Settings > Privacy & Security'

  switch (type) {
    case 'accessibility':
      return (
        `Accessibility permission is required to control UI elements and simulate input. ` +
        `Please grant access in ${basePath} > Accessibility. ` +
        `Add this application to the list of allowed apps. ` +
        `You may need to restart the application after granting permission. ` +
        `Settings URL: ${SETTINGS_PATHS.accessibility}`
      )

    case 'automation':
      return (
        `Automation permission is required to control ${appName || 'the target application'}. ` +
        `Please grant access in ${basePath} > Automation. ` +
        `Enable the checkbox for ${appName || 'the target application'} under this app. ` +
        `If prompted, click "OK" to allow automation access. ` +
        `Settings URL: ${SETTINGS_PATHS.automation}`
      )

    case 'screenRecording':
      return (
        `Screen Recording permission is required to capture screenshots and window content. ` +
        `Please grant access in ${basePath} > Screen Recording. ` +
        `Add this application to the list of allowed apps. ` +
        `You may need to restart the application after granting permission. ` +
        `Settings URL: ${SETTINGS_PATHS.screenRecording}`
      )
  }
}

/**
 * Checks if Accessibility permission is granted.
 *
 * Uses System Events to detect if UI elements access is enabled.
 * Results are cached to avoid repeated system calls.
 *
 * @returns Promise resolving to PermissionStatus
 *
 * @example
 * const result = await checkAccessibility();
 * if (!result.granted) {
 *   console.log(result.guidance); // Instructions for granting access
 * }
 */
export async function checkAccessibility(): Promise<PermissionStatus> {
  const cacheKey = 'accessibility'
  const cached = getCachedStatus(cacheKey)
  if (cached) {
    return cached
  }

  // Check if we can access System Events UI elements
  const script = `
    tell application "System Events"
      return UI elements enabled
    end tell
  `

  const result = await executeAppleScript({ script, timeout: 5000 })

  let status: PermissionStatus

  if (result.success && result.parsed === true) {
    status = {
      granted: true,
      type: 'accessibility',
    }
  } else {
    // Permission denied or error
    status = {
      granted: false,
      type: 'accessibility',
      guidance: getPermissionGuidance('accessibility'),
    }
  }

  cacheStatus(cacheKey, status)
  return status
}

/**
 * Checks if Automation permission is granted for a specific application.
 *
 * Attempts to access the target application via System Events to detect
 * if automation permission is granted.
 *
 * @param appName - The name of the application to check automation permission for
 * @returns Promise resolving to PermissionStatus
 *
 * @example
 * const result = await checkAutomation('Safari');
 * if (!result.granted) {
 *   console.log(result.guidance); // Includes "Safari" in the message
 * }
 */
export async function checkAutomation(
  appName: string,
): Promise<PermissionStatus> {
  // Sanitize the app name to prevent injection
  let sanitizedAppName: string
  try {
    sanitizedAppName = sanitizeIdentifier(appName)
  } catch {
    // Invalid app name
    return {
      granted: false,
      type: 'automation',
      guidance: `Invalid application name: "${appName}". ${getPermissionGuidance('automation', appName)}`,
    }
  }

  const cacheKey = `automation:${sanitizedAppName}`
  const cached = getCachedStatus(cacheKey)
  if (cached) {
    return cached
  }

  // Try to get the app's name via System Events - this requires automation permission
  const script = `
    tell application "System Events"
      tell process "${sanitizedAppName}"
        return name
      end tell
    end tell
  `

  const result = await executeAppleScript({ script, timeout: 5000 })

  let status: PermissionStatus

  if (result.success) {
    status = {
      granted: true,
      type: 'automation',
    }
  } else {
    // Check for specific permission denial errors
    const errorLower = result.error?.toLowerCase() || ''
    const isPermissionError =
      errorLower.includes('not allowed') ||
      errorLower.includes('-1743') ||
      errorLower.includes('assistive access') ||
      errorLower.includes('not permitted')

    const isAppNotFound =
      errorLower.includes("can't get process") ||
      errorLower.includes("process doesn't exist") ||
      errorLower.includes('not running')

    if (isAppNotFound) {
      // App not found - still return as denied but with different guidance
      status = {
        granted: false,
        type: 'automation',
        guidance: `Application "${appName}" is not running or does not exist. ${getPermissionGuidance('automation', appName)}`,
      }
    } else if (isPermissionError) {
      status = {
        granted: false,
        type: 'automation',
        guidance: getPermissionGuidance('automation', appName),
      }
    } else {
      // Other error - treat as denied
      status = {
        granted: false,
        type: 'automation',
        guidance: `Error checking automation permission for ${appName}: ${result.error}. ${getPermissionGuidance('automation', appName)}`,
      }
    }
  }

  cacheStatus(cacheKey, status)
  return status
}

/**
 * Checks if Screen Recording permission is granted.
 *
 * Attempts to capture window information which requires Screen Recording
 * permission on macOS Catalina and later.
 *
 * @returns Promise resolving to PermissionStatus
 *
 * @example
 * const result = await checkScreenRecording();
 * if (!result.granted) {
 *   console.log(result.guidance); // Instructions for granting access
 * }
 */
export async function checkScreenRecording(): Promise<PermissionStatus> {
  const cacheKey = 'screenRecording'
  const cached = getCachedStatus(cacheKey)
  if (cached) {
    return cached
  }

  // Use CGPreflightScreenCaptureAccess to check screen recording permission
  // This is more reliable than trying to capture a screenshot
  const script = `
    use framework "Foundation"
    use framework "CoreGraphics"

    set accessGranted to current application's CGPreflightScreenCaptureAccess()
    return accessGranted as boolean
  `

  const result = await executeAppleScript({ script, timeout: 5000 })

  let status: PermissionStatus

  if (result.success && result.parsed === true) {
    status = {
      granted: true,
      type: 'screenRecording',
    }
  } else if (result.success && result.parsed === false) {
    // Explicitly denied
    status = {
      granted: false,
      type: 'screenRecording',
      guidance: getPermissionGuidance('screenRecording'),
    }
  } else {
    // Error or unexpected result - fallback to checking window list
    // Some older macOS versions might not support CGPreflightScreenCaptureAccess
    const fallbackScript = `
      tell application "System Events"
        try
          get every window of every process
          return true
        on error
          return false
        end try
      end tell
    `

    const fallbackResult = await executeAppleScript({
      script: fallbackScript,
      timeout: 5000,
    })

    if (fallbackResult.success && fallbackResult.parsed === true) {
      status = {
        granted: true,
        type: 'screenRecording',
      }
    } else {
      status = {
        granted: false,
        type: 'screenRecording',
        guidance: getPermissionGuidance('screenRecording'),
      }
    }
  }

  cacheStatus(cacheKey, status)
  return status
}
