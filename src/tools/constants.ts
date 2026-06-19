/**
 * Shared tool constants keep timing and scan bounds explicit for macOS automation code.
 */

/** Default timeout for menu operations in milliseconds. */
export const MENU_TIMEOUT_MS = 15000

/** Time to wait for a status menu to open after clicking its menu bar item. */
export const STATUS_MENU_LOAD_DELAY_SECONDS = 0.3

/** Maximum SystemUIServer status items to inspect before moving to the next scope. */
export const STATUS_BAR_SYSTEM_ITEM_LIMIT = 30

/** Maximum ControlCenter status items to inspect before moving to app-owned items. */
export const STATUS_BAR_CONTROL_CENTER_ITEM_LIMIT = 40

/** Maximum running app processes to inspect for app-owned status menu bars. */
export const STATUS_BAR_APP_PROCESS_LIMIT = 80

/** Maximum status items to inspect inside one app-owned status menu bar. */
export const STATUS_BAR_APP_ITEM_LIMIT = 20

/** Number of polling attempts while waiting for a lazy-loaded status menu. */
export const STATUS_BAR_MENU_LOAD_MAX_WAIT_ATTEMPTS = 5

/** Delay between lazy-loaded status menu polling attempts. */
export const STATUS_BAR_MENU_LOAD_POLL_DELAY_SECONDS = 0.2
