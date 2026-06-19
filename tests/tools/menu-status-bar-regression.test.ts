/**
 * Status bar regression tests pin macOS 26 fallback behavior without requiring that OS in CI.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { executeAppleScript } from '../../src/lib/executor.js'
import { checkAccessibility } from '../../src/lib/permission.js'
import {
  buildClickStatusBarItemScript,
  buildClickStatusBarMenuItemScript,
  buildListStatusBarItemsScript,
  clickStatusBarItem,
  clickStatusBarMenuItem,
  listStatusBarItems,
} from '../../src/tools/menu.js'

vi.mock('../../src/lib/executor.js', () => ({
  executeAppleScript: vi.fn(),
}))

vi.mock('../../src/lib/permission.js', () => ({
  checkAccessibility: vi.fn(),
}))

const mockExecuteAppleScript = executeAppleScript as unknown as ReturnType<
  typeof vi.fn
>
const mockCheckAccessibility = checkAccessibility as unknown as ReturnType<
  typeof vi.fn
>

describe('Status bar macOS 26 regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckAccessibility.mockResolvedValue({ granted: true })
  })

  it('keeps ControlCenter and app-owned status items reachable when SystemUIServer has no menu bar', () => {
    // Arrange
    const script = buildListStatusBarItemsScript()

    // Act
    const systemUiServerIndex = script.indexOf('tell process "SystemUIServer"')
    const controlCenterIndex = script.indexOf('tell process "ControlCenter"')
    const appOwnedIndex = script.indexOf(
      'menu bar items of menu bar 2 of runningProcess',
    )

    // Assert
    expect(systemUiServerIndex).toBeGreaterThan(-1)
    expect(controlCenterIndex).toBeGreaterThan(systemUiServerIndex)
    expect(appOwnedIndex).toBeGreaterThan(controlCenterIndex)
    expect(script).toContain('try\n          tell process "SystemUIServer"')
    expect(script).toContain('if inspectedProcessCount > 80 then exit repeat')
  })

  it('escapes status item descriptions before building JSON output', () => {
    // Arrange
    const script = buildListStatusBarItemsScript()

    // Act
    const hasJsonEscapeHandler = script.includes('on jsonEscape(rawValue)')
    const escapesQuotes = script.includes(String.raw`"\\\""`)
    const escapesBackslashes = script.includes(String.raw`"\\\\"`)
    const escapesTabs = script.includes(String.raw`"\\t"`)

    // Assert
    expect(hasJsonEscapeHandler).toBe(true)
    expect(escapesQuotes).toBe(true)
    expect(escapesBackslashes).toBe(true)
    expect(escapesTabs).toBe(true)
    expect(script).toContain('my jsonEscape(itemDescription)')
    expect(script).toContain('my jsonEscape(statusProcessName)')
  })

  it('clicks app-owned Electron tray items by scanning process menu bar 2', () => {
    // Arrange
    const script = buildClickStatusBarItemScript('Electron')

    // Act
    const hasAppOwnedScan = script.includes(
      'menu bar items of menu bar 2 of runningProcess',
    )
    const usesProcessNameMatching = script.includes(
      'clickMatchingStatusItem(appStatusItems, runningProcessName, "Electron", 20)',
    )

    // Assert
    expect(hasAppOwnedScan).toBe(true)
    expect(usesProcessNameMatching).toBe(true)
    expect(script).toContain('return searchableText contains identifier')
    expect(script).toContain(
      'if inspectedItemCount > itemLimit then exit repeat',
    )
  })

  it('bounds lazy-loaded status menu polling before clicking a menu item', () => {
    // Arrange
    const script = buildClickStatusBarMenuItemScript('Electron', 'Quit')

    // Act
    const hasBoundedWait = script.includes('repeat while waitCount < 5')
    const hasPollingDelay = script.includes('delay 0.2')
    const clicksTargetMenuItem = script.includes(
      'click menu item targetMenuItem of menu 1 of statusItem',
    )

    // Assert
    expect(hasBoundedWait).toBe(true)
    expect(hasPollingDelay).toBe(true)
    expect(clicksTargetMenuItem).toBe(true)
  })

  it('returns parsed status bar items from successful AppleScript JSON output', async () => {
    // Arrange
    mockExecuteAppleScript.mockResolvedValue({
      success: true,
      output:
        '[{"description":"Electron","position":1,"processName":"Electron"}]',
    })

    // Act
    const result = await listStatusBarItems()

    // Assert
    expect(result).toEqual({
      success: true,
      items: [
        {
          description: 'Electron',
          position: 1,
          processName: 'Electron',
        },
      ],
    })
    expect(mockExecuteAppleScript).toHaveBeenCalledWith({
      script: expect.stringContaining('menu bar 2 of runningProcess'),
      timeout: 15000,
    })
  })

  it('bounds click traversal item scans per status bar scope', () => {
    // Arrange
    const itemScript = buildClickStatusBarItemScript('Electron')
    const menuItemScript = buildClickStatusBarMenuItemScript('Electron', 'Quit')

    // Act
    const itemScriptUsesScopeLimits =
      itemScript.includes(
        'clickMatchingStatusItem(menuBarItems, "SystemUIServer", "Electron", 30)',
      ) &&
      itemScript.includes(
        'clickMatchingStatusItem(ccMenuBarItems, "ControlCenter", "Electron", 40)',
      ) &&
      itemScript.includes(
        'clickMatchingStatusItem(appStatusItems, runningProcessName, "Electron", 20)',
      )
    const menuItemScriptUsesScopeLimits =
      menuItemScript.includes(
        'clickMatchingStatusMenuItem(menuBarItems, "SystemUIServer", "Electron", "Quit", 30)',
      ) &&
      menuItemScript.includes(
        'clickMatchingStatusMenuItem(ccMenuBarItems, "ControlCenter", "Electron", "Quit", 40)',
      ) &&
      menuItemScript.includes(
        'clickMatchingStatusMenuItem(appStatusItems, runningProcessName, "Electron", "Quit", 20)',
      )

    // Assert
    expect(itemScriptUsesScopeLimits).toBe(true)
    expect(menuItemScriptUsesScopeLimits).toBe(true)
  })

  it('uses the shared resilient script when clicking a status bar item', async () => {
    // Arrange
    mockExecuteAppleScript.mockResolvedValue({
      success: true,
      output: "success: Clicked status bar item 'Electron'",
    })

    // Act
    const result = await clickStatusBarItem({ identifier: 'Electron' })

    // Assert
    expect(result).toEqual({
      success: true,
      message: "Clicked status bar item 'Electron'",
    })
    expect(mockExecuteAppleScript).toHaveBeenCalledWith({
      script: expect.stringContaining(
        'clickMatchingStatusItem(appStatusItems, runningProcessName, "Electron", 20)',
      ),
      timeout: 15000,
    })
  })

  it('uses the shared resilient script when clicking a status menu item', async () => {
    // Arrange
    mockExecuteAppleScript.mockResolvedValue({
      success: true,
      output: "success: Clicked menu item 'Quit' in status bar item 'Electron'",
    })

    // Act
    const result = await clickStatusBarMenuItem({
      identifier: 'Electron',
      menuPath: 'Quit',
    })

    // Assert
    expect(result).toEqual({
      success: true,
      message: "Clicked menu item 'Quit' in status bar item 'Electron'",
    })
    expect(mockExecuteAppleScript).toHaveBeenCalledWith({
      script: expect.stringContaining(
        'clickMatchingStatusMenuItem(appStatusItems, runningProcessName, "Electron", "Quit", 20)',
      ),
      timeout: 15000,
    })
  })
})
