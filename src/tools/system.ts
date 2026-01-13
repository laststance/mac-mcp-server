/**
 * System Information Tools
 *
 * Provides tools for retrieving macOS system information including
 * hardware specs, battery status, and display configuration.
 *
 * @module tools/system
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { z } from 'zod'

import { executeAppleScript } from '../lib/executor.js'

/**
 * System information interface.
 * @returns
 * - macOSVersion: OS version string (e.g., "15.0", "14.2.1")
 * - hardwareModel: Hardware model identifier (e.g., "MacBook Pro")
 * - processorInfo: Processor description (e.g., "Apple M1 Pro")
 * - totalMemory: Total RAM (e.g., "16 GB")
 */
export interface SystemInfo {
  macOSVersion: string
  hardwareModel: string
  processorInfo: string
  totalMemory: string
}

/**
 * Battery status interface.
 * @returns
 * - percentage: Battery level 0-100, or -1 for desktop
 * - isCharging: True if charging, false otherwise
 * - isDesktop: True if Mac has no battery (desktop Mac)
 */
export interface BatteryStatus {
  percentage: number
  isCharging: boolean
  isDesktop: boolean
}

/**
 * Display information interface.
 * @returns
 * - name: Display name
 * - resolution: Width and height in pixels
 * - isMain: True if this is the main display
 */
export interface DisplayInfo {
  name: string
  resolution: {
    width: number
    height: number
  }
  isMain: boolean
}

/**
 * Result type for tool functions.
 * @template T - The data type returned on success
 */
export interface ToolResult<T> {
  success: boolean
  data?: T
  error?: string
}

// Zod schemas for MCP tool registration
export const GetSystemInfoSchema = z.object({})
export const GetBatteryStatusSchema = z.object({})
export const GetDisplayInfoSchema = z.object({})

/**
 * Retrieves macOS system information.
 *
 * Uses system_profiler to gather hardware information and parses
 * the output using regex patterns.
 *
 * @returns Promise with SystemInfo data or error
 *
 * @example
 * const result = await getSystemInfo()
 * if (result.success) {
 *   console.log(result.data.macOSVersion) // "15.0"
 * }
 */
export async function getSystemInfo(): Promise<ToolResult<SystemInfo>> {
  const script = `
    set shellOutput to do shell script "system_profiler SPSoftwareDataType SPHardwareDataType"
    return shellOutput
  `

  const result = await executeAppleScript({ script, timeout: 15000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to retrieve system information',
    }
  }

  const output = result.output ?? ''

  // Parse macOS version
  const versionMatch = output.match(/System Version:\s*macOS\s+([\d.]+)/)
  const macOSVersion = versionMatch?.[1] ?? 'Unknown'

  // Parse hardware model
  const modelMatch = output.match(/Model Name:\s*(.+)/)
  const hardwareModel = modelMatch?.[1]?.trim() ?? 'Unknown'

  // Parse processor info - handle both Intel and Apple Silicon
  let processorInfo = 'Unknown'
  const chipMatch = output.match(/Chip:\s*(.+)/)
  if (chipMatch && chipMatch[1]) {
    processorInfo = chipMatch[1].trim()
  } else {
    const cpuMatch = output.match(/Processor Name:\s*(.+)/)
    if (cpuMatch && cpuMatch[1]) {
      processorInfo = cpuMatch[1].trim()
    }
  }

  // Parse total memory
  const memoryMatch = output.match(/Memory:\s*(\d+\s*GB)/)
  const totalMemory = memoryMatch?.[1] ?? 'Unknown'

  return {
    success: true,
    data: {
      macOSVersion,
      hardwareModel,
      processorInfo,
      totalMemory,
    },
  }
}

/**
 * Retrieves battery status for MacBooks or indicates desktop Mac.
 *
 * Uses pmset to get battery information. For desktop Macs without
 * battery, returns isDesktop: true with percentage: -1.
 *
 * @returns Promise with BatteryStatus data or error
 *
 * @example
 * const result = await getBatteryStatus()
 * if (result.success && !result.data.isDesktop) {
 *   console.log(`Battery: ${result.data.percentage}%`)
 * }
 */
export async function getBatteryStatus(): Promise<ToolResult<BatteryStatus>> {
  const script = `
    try
      set pmsetOutput to do shell script "pmset -g batt"
      return pmsetOutput
    on error
      return "NO_BATTERY"
    end try
  `

  const result = await executeAppleScript({ script, timeout: 5000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to retrieve battery status',
    }
  }

  const output = result.output ?? ''

  // Check for desktop Mac (no battery)
  if (
    output === 'NO_BATTERY' ||
    output.includes('No batteries') ||
    !output.includes('%')
  ) {
    return {
      success: true,
      data: {
        percentage: -1,
        isCharging: false,
        isDesktop: true,
      },
    }
  }

  // Parse battery percentage - look for pattern like "100%;" or "85%;"
  const percentMatch = output.match(/(\d+)%/)
  const percentage =
    percentMatch && percentMatch[1] ? parseInt(percentMatch[1], 10) : -1

  // Check if charging or on AC power
  const isCharging =
    output.includes('charging') ||
    output.includes('AC Power') ||
    output.includes('charged')

  // Check if "discharging" which means NOT charging despite AC
  const isDischarging = output.includes('discharging')

  return {
    success: true,
    data: {
      percentage,
      isCharging: isCharging && !isDischarging,
      isDesktop: false,
    },
  }
}

/**
 * Retrieves information about connected displays.
 *
 * Uses system_profiler SPDisplaysDataType to get display information
 * and parses the output.
 *
 * @returns Promise with array of DisplayInfo or error
 *
 * @example
 * const result = await getDisplayInfo()
 * if (result.success) {
 *   result.data.forEach(display => {
 *     console.log(`${display.name}: ${display.resolution.width}x${display.resolution.height}`)
 *   })
 * }
 */
export async function getDisplayInfo(): Promise<ToolResult<DisplayInfo[]>> {
  const script = `
    set shellOutput to do shell script "system_profiler SPDisplaysDataType"
    return shellOutput
  `

  const result = await executeAppleScript({ script, timeout: 15000 })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to retrieve display information',
    }
  }

  const output = result.output ?? ''
  const displays: DisplayInfo[] = []

  // Split by display sections - look for display name patterns
  const displaySections = output.split(/\n(?=\s{8}[A-Za-z])/)

  let isFirstDisplay = true

  for (const section of displaySections) {
    // Look for display name (indented at 8 spaces)
    const nameMatch = section.match(/^\s{8}([^:]+):/)
    if (!nameMatch || !nameMatch[1]) continue

    const name = nameMatch[1].trim()

    // Skip non-display sections
    if (
      name.toLowerCase().includes('graphics') &&
      !section.includes('Resolution')
    ) {
      continue
    }

    // Parse resolution - various formats possible
    // "Resolution: 2560 x 1440 (QHD/WQHD - Wide Quad High Definition)"
    // "Resolution: 3456 x 2234 Retina"
    // "UI Looks like: 1728 x 1117 @ 120.00Hz"
    let width = 0
    let height = 0

    // Try main resolution first
    const resMatch = section.match(/Resolution:\s*(\d+)\s*x\s*(\d+)/)
    if (resMatch && resMatch[1] && resMatch[2]) {
      width = parseInt(resMatch[1], 10)
      height = parseInt(resMatch[2], 10)
    }

    // Also try "UI Looks like" for Retina displays
    if (width === 0) {
      const uiMatch = section.match(/UI Looks like:\s*(\d+)\s*x\s*(\d+)/)
      if (uiMatch && uiMatch[1] && uiMatch[2]) {
        width = parseInt(uiMatch[1], 10)
        height = parseInt(uiMatch[2], 10)
      }
    }

    // Skip if no resolution found
    if (width === 0 || height === 0) continue

    // Check if main display
    const isMain =
      isFirstDisplay ||
      section.toLowerCase().includes('main display: yes') ||
      section.toLowerCase().includes('main display:yes')

    displays.push({
      name,
      resolution: { width, height },
      isMain,
    })

    isFirstDisplay = false
  }

  // If no displays found through standard parsing, try alternative approach
  if (displays.length === 0) {
    // Try to find any resolution in the output
    const anyResMatch = output.match(/(\d{3,4})\s*x\s*(\d{3,4})/)
    if (anyResMatch && anyResMatch[1] && anyResMatch[2]) {
      displays.push({
        name: 'Display',
        resolution: {
          width: parseInt(anyResMatch[1], 10),
          height: parseInt(anyResMatch[2], 10),
        },
        isMain: true,
      })
    }
  }

  // If still no displays, return built-in display info as fallback
  if (displays.length === 0) {
    // Use AppleScript to get screen bounds as fallback
    const fallbackScript = `
      tell application "Finder"
        get bounds of window of desktop
      end tell
    `
    const fallbackResult = await executeAppleScript({
      script: fallbackScript,
      timeout: 5000,
    })

    if (fallbackResult.success && fallbackResult.output) {
      // Parse bounds format: "0, 0, 1440, 900"
      const boundsMatch = fallbackResult.output.match(
        /(\d+),\s*(\d+),\s*(\d+),\s*(\d+)/,
      )
      if (boundsMatch && boundsMatch[3] && boundsMatch[4]) {
        displays.push({
          name: 'Built-in Display',
          resolution: {
            width: parseInt(boundsMatch[3], 10),
            height: parseInt(boundsMatch[4], 10),
          },
          isMain: true,
        })
      }
    }
  }

  return {
    success: true,
    data: displays,
  }
}
