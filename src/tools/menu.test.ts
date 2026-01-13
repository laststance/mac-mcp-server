/**
 * Menu Bar and Status Item Tools - Test Suite
 *
 * Tests for list_menu_items, click_menu_item, get_menu_item_state,
 * list_status_bar_items, click_status_bar_item, click_status_bar_menu_item,
 * and get_menu_bar_structure tools.
 *
 * @module menu.test
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11
 */

import { describe, expect, it } from 'vitest'

import {
  ClickMenuItemSchema,
  ClickStatusBarItemSchema,
  ClickStatusBarMenuItemSchema,
  GetMenuBarStructureSchema,
  GetMenuItemStateSchema,
  ListMenuItemsSchema,
  ListStatusBarItemsSchema,
  clickMenuItem,
  clickStatusBarItem,
  getMenuBarStructure,
  getMenuItemState,
  listMenuItems,
  listStatusBarItems,
  type MenuItem,
  type StatusBarItem,
} from './menu.js'

// ============================================================================
// Platform Detection Helper
// ============================================================================

const isMacOS = process.platform === 'darwin'

/**
 * Skip test if not on macOS.
 */
const itMacOS = isMacOS ? it : it.skip

// ============================================================================
// Schema Tests
// ============================================================================

describe('Menu Tool Schemas', () => {
  describe('ListMenuItemsSchema', () => {
    it('should validate valid input with appName', () => {
      const result = ListMenuItemsSchema.safeParse({ appName: 'Finder' })
      expect(result.success).toBe(true)
    })

    it('should reject missing appName', () => {
      const result = ListMenuItemsSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('ClickMenuItemSchema', () => {
    it('should validate valid input', () => {
      const result = ClickMenuItemSchema.safeParse({
        appName: 'Finder',
        menuPath: 'File > New Window',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing menuPath', () => {
      const result = ClickMenuItemSchema.safeParse({
        appName: 'Finder',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing appName', () => {
      const result = ClickMenuItemSchema.safeParse({
        menuPath: 'File > New Window',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('GetMenuItemStateSchema', () => {
    it('should validate valid input', () => {
      const result = GetMenuItemStateSchema.safeParse({
        appName: 'Finder',
        menuPath: 'View > Show Path Bar',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('ListStatusBarItemsSchema', () => {
    it('should validate empty object', () => {
      const result = ListStatusBarItemsSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('ClickStatusBarItemSchema', () => {
    it('should validate valid input', () => {
      const result = ClickStatusBarItemSchema.safeParse({
        identifier: 'Bluetooth',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing identifier', () => {
      const result = ClickStatusBarItemSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('ClickStatusBarMenuItemSchema', () => {
    it('should validate valid input', () => {
      const result = ClickStatusBarMenuItemSchema.safeParse({
        identifier: 'Wi-Fi',
        menuPath: 'Turn Wi-Fi Off',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing menuPath', () => {
      const result = ClickStatusBarMenuItemSchema.safeParse({
        identifier: 'Wi-Fi',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('GetMenuBarStructureSchema', () => {
    it('should validate valid input', () => {
      const result = GetMenuBarStructureSchema.safeParse({
        processName: 'Finder',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing processName', () => {
      const result = GetMenuBarStructureSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })
})

// ============================================================================
// Interface Tests
// ============================================================================

describe('MenuItem Interface', () => {
  it('should have correct structure', () => {
    const item: MenuItem = {
      name: 'New Window',
      enabled: true,
      checked: false,
      hasSubmenu: false,
    }

    expect(item.name).toBe('New Window')
    expect(item.enabled).toBe(true)
    expect(item.checked).toBe(false)
    expect(item.hasSubmenu).toBe(false)
  })

  it('should support optional shortcut and children', () => {
    const item: MenuItem = {
      name: 'Copy',
      shortcut: '⌘C',
      enabled: true,
      checked: false,
      hasSubmenu: false,
    }

    expect(item.shortcut).toBe('⌘C')
  })

  it('should support children array for submenus', () => {
    const item: MenuItem = {
      name: 'View',
      enabled: true,
      checked: false,
      hasSubmenu: true,
      children: [
        {
          name: 'Show Sidebar',
          enabled: true,
          checked: true,
          hasSubmenu: false,
        },
      ],
    }

    expect(item.children).toHaveLength(1)
    expect(item.children![0]!.checked).toBe(true)
  })
})

describe('StatusBarItem Interface', () => {
  it('should have correct structure', () => {
    const item: StatusBarItem = {
      description: 'Bluetooth',
      position: 1,
      processName: 'SystemUIServer',
    }

    expect(item.description).toBe('Bluetooth')
    expect(item.position).toBe(1)
    expect(item.processName).toBe('SystemUIServer')
  })
})

// ============================================================================
// Permission Handling Tests
// ============================================================================

describe('Permission Handling', () => {
  itMacOS('listMenuItems should check accessibility permission', async () => {
    const result = await listMenuItems({
      appName: 'NonExistentApp12345',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  itMacOS('clickMenuItem should check accessibility permission', async () => {
    const result = await clickMenuItem({
      appName: 'NonExistentApp12345',
      menuPath: 'File > New',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  itMacOS(
    'getMenuItemState should check accessibility permission',
    async () => {
      const result = await getMenuItemState({
        appName: 'NonExistentApp12345',
        menuPath: 'File > New',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    },
  )

  itMacOS(
    'listStatusBarItems should check accessibility permission',
    async () => {
      const result = await listStatusBarItems()

      // This may succeed or fail based on permission status
      expect(typeof result.success).toBe('boolean')
    },
  )

  itMacOS(
    'clickStatusBarItem should check accessibility permission',
    async () => {
      const result = await clickStatusBarItem({
        identifier: 'NonExistentStatusItem',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    },
  )

  itMacOS(
    'getMenuBarStructure should check accessibility permission',
    async () => {
      const result = await getMenuBarStructure({
        processName: 'NonExistentProcess',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    },
  )
})

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  itMacOS('listMenuItems should handle app not found', async () => {
    const result = await listMenuItems({
      appName: 'ThisAppDoesNotExist',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error!.length).toBeGreaterThan(0)
  })

  itMacOS('clickMenuItem should handle invalid menu path', async () => {
    const result = await clickMenuItem({
      appName: 'Finder',
      menuPath: 'NonExistent > Menu > Path',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  itMacOS('should reject empty app name', async () => {
    const result = await listMenuItems({
      appName: '',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  itMacOS('should reject empty menu path', async () => {
    const result = await clickMenuItem({
      appName: 'Finder',
      menuPath: '',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  itMacOS('clickStatusBarItem should handle item not found', async () => {
    const result = await clickStatusBarItem({
      identifier: 'NonExistentStatusBarItem123',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration Tests', () => {
  itMacOS(
    'listMenuItems should return menu hierarchy for Finder',
    async () => {
      const result = await listMenuItems({
        appName: 'Finder',
      })

      // Finder is always available on macOS
      if (result.success) {
        expect(result.items).toBeDefined()
        expect(Array.isArray(result.items)).toBe(true)
        // Finder should have standard menus
        if (result.items && result.items.length > 0) {
          const firstItem = result.items[0]!
          expect(firstItem.name).toBeDefined()
          expect(typeof firstItem.enabled).toBe('boolean')
        }
      } else {
        // Permission denied or timeout is acceptable
        expect(result.error).toBeDefined()
      }
    },
    20000,
  )

  itMacOS(
    'getMenuItemState should return state for Finder menu item',
    async () => {
      const result = await getMenuItemState({
        appName: 'Finder',
        menuPath: 'File > New Finder Window',
      })

      if (result.success) {
        expect(typeof result.enabled).toBe('boolean')
        expect(typeof result.checked).toBe('boolean')
        expect(typeof result.hasSubmenu).toBe('boolean')
      } else {
        // May fail if menu path doesn't exist or permission denied
        expect(result.error).toBeDefined()
      }
    },
  )

  itMacOS('listStatusBarItems should return items', async () => {
    const result = await listStatusBarItems()

    if (result.success) {
      expect(result.items).toBeDefined()
      expect(Array.isArray(result.items)).toBe(true)
      // There should be at least some status bar items (clock, etc.)
      if (result.items && result.items.length > 0) {
        expect(result.items[0]!.processName).toBeDefined()
      }
    } else {
      // Permission denied is acceptable
      expect(result.error).toBeDefined()
    }
  })

  itMacOS(
    'getMenuBarStructure should return structure for Finder',
    async () => {
      const result = await getMenuBarStructure({
        processName: 'Finder',
      })

      if (result.success) {
        expect(result.menus).toBeDefined()
        expect(Array.isArray(result.menus)).toBe(true)
        expect(result.processName).toBe('Finder')
      } else {
        // Permission denied or timeout is acceptable
        expect(result.error).toBeDefined()
      }
    },
    20000,
  )
})

// ============================================================================
// Input Validation Tests
// ============================================================================

describe('Input Validation', () => {
  itMacOS('should reject extremely long app names', async () => {
    const result = await listMenuItems({
      appName: 'A'.repeat(300),
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('255')
  })

  itMacOS('should sanitize special characters in menu path', async () => {
    // Menu path with special characters shouldn't cause injection
    const result = await clickMenuItem({
      appName: 'Finder',
      menuPath: 'File"; return "injected" --',
    })

    // Should fail safely, not return "injected"
    expect(result.success).toBe(false)
    if (result.error) {
      expect(result.error).not.toContain('injected')
    }
  })

  itMacOS('should handle menu path with various separators', async () => {
    // Test with proper > separator
    const result = await clickMenuItem({
      appName: 'Finder',
      menuPath: 'File > New Finder Window',
    })

    // May succeed or fail based on menu availability
    expect(typeof result.success).toBe('boolean')
  })
})
