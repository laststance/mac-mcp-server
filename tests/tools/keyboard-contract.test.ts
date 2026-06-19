/**
 * Keyboard contract tests keep the public docs aligned with the System Events backend.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'vitest'

import { registerAllTools } from '../../src/lib/register-tools.js'
import { KeyCombinationSchema } from '../../src/tools/keyboard.js'

describe('Keyboard shortcut contract', () => {
  it('registers key_combination as focused-app or menu shortcut input', () => {
    // Arrange
    const registeredTools: Array<{ name: string; description: string }> = []
    const fakeServer = {
      tool: (
        name: string,
        description: string,
        _schema: unknown,
        _handler: unknown,
      ) => {
        registeredTools.push({ name, description })
      },
    }

    // Act
    registerAllTools(fakeServer as never)
    const keyCombinationTool = registeredTools.find(
      (tool) => tool.name === 'key_combination',
    )

    // Assert
    expect(keyCombinationTool).toEqual({
      name: 'key_combination',
      description:
        'Presses a focused-app or menu key combination with modifiers; OS-global hotkeys such as Electron globalShortcut are not guaranteed',
    })
  })

  it('documents that Electron globalShortcut is outside the key_combination guarantee', () => {
    // Arrange
    const readmePath = join(process.cwd(), 'README.md')

    // Act
    const readme = readFileSync(readmePath, 'utf8')

    // Assert
    expect(readme).toContain(
      'focused-window shortcuts and app menu key equivalents',
    )
    expect(readme).toContain('Electron globalShortcut/RegisterEventHotKey')
    expect(readme).toContain(
      'click_menu_item, click_status_bar_item, or an in-window shortcut',
    )
  })

  it('still accepts the existing key_combination input shape', () => {
    // Arrange
    const input = { modifiers: ['command'], key: '3' }

    // Act
    const result = KeyCombinationSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        modifiers: ['command'],
        key: '3',
      })
    }
  })
})
