# Research & Design Decisions

## Summary
- **Feature**: `macos-applescript-mcp`
- **Discovery Scope**: Complex Integration (New Feature)
- **Key Findings**:
  - MCP TypeScript SDK provides `McpServer` with `StdioServerTransport` for Claude Code integration
  - AppleScript via osascript binary is sufficient for all 17 requirements without native Node.js addons
  - macOS Accessibility APIs (AXUIElement) accessible through AppleScript's System Events UI scripting

## Research Log

### MCP TypeScript SDK Implementation
- **Context**: Need to implement MCP server compatible with Claude Code
- **Sources Consulted**:
  - Context7: `/modelcontextprotocol/typescript-sdk` documentation
  - Official MCP specification
- **Findings**:
  - Use `@modelcontextprotocol/sdk` package (v1.x, Benchmark Score: 85.3)
  - `McpServer` class with `StdioServerTransport` for stdio communication
  - `server.registerTool()` accepts Zod schemas for input validation
  - Response format: `{ content: [{ type: 'text', text: JSON.stringify(result) }] }`
  - Supports structured output with `structuredContent` field
- **Implications**: Clean TypeScript API with built-in validation, no custom protocol handling needed

### AppleScript Execution via osascript
- **Context**: Core execution mechanism for macOS operations
- **Sources Consulted**:
  - Apple Developer Documentation
  - Community patterns (BetterTouchTool, Keyboard Maestro references)
- **Findings**:
  - `osascript` binary accepts AppleScript via `-e` flag or stdin
  - Execution via Node.js `child_process.execFile` for security (no shell)
  - Output returned via stdout, errors via stderr
  - JSON output possible with AppleScript's `do shell script "echo '" & jsonString & "'"`
  - Timeout management critical (30s as per Req 2.3)
- **Implications**: Simple, reliable execution path; no native addon compilation required

### macOS Accessibility API (AXUIElement)
- **Context**: Required for UI element inspection and interaction (Req 15)
- **Sources Consulted**:
  - Mo4Tech: MacOS Accessibility API guide
  - DeepWiki: wakatime/macos-wakatime Accessibility integration
  - GitHub: DFAXUIElement Swift library
- **Findings**:
  - AXUIElement accessed via `AXUIElementCreateApplication(pid)`
  - Attributes via `AXUIElementCopyAttributeValue` (windows, buttons, etc.)
  - Actions via `AXUIElementPerformAction` with keys like `kAXPressAction`
  - AppleScript System Events provides equivalent functionality:
    ```applescript
    tell application "System Events"
      tell process "Finder"
        get entire contents of window 1
      end tell
    end tell
    ```
  - UI scripting requires Accessibility permission
- **Implications**: AppleScript System Events sufficient for UI element interaction; no Swift/ObjC needed

### Mouse & Keyboard Simulation
- **Context**: Required for Req 12 (mouse) and Req 13 (keyboard)
- **Sources Consulted**:
  - Stack Overflow: CGEvent keyboard/mouse simulation
  - GitHub: cgevent topic repositories
  - Macuse MCP server implementation patterns
- **Findings**:
  - CGEvent API requires Accessibility permission
  - macOS 15 Sequoia introduced stricter timestamp requirements
  - AppleScript alternative via System Events:
    ```applescript
    tell application "System Events"
      click at {x, y}
      keystroke "text"
      key code 36 -- Enter key
    end tell
    ```
  - Modifier keys supported: `using {command down, shift down}`
- **Implications**: AppleScript mouse/keyboard sufficient for most use cases; CGEvent only needed for pixel-precise control

### Screenshot Capture
- **Context**: Required for Req 14
- **Sources Consulted**:
  - npm registry: @steipete/peekaboo-mcp
  - macOS screencapture man page
- **Findings**:
  - `screencapture` command-line tool built into macOS
  - Options: `-x` (no sound), `-t png/jpg`, `-R x,y,w,h` (region), `-l windowid`
  - Window capture requires Screen Recording permission
  - Output to file or stdout with `-`
  - Base64 encoding via `base64` command
- **Implications**: Use screencapture + base64 pipeline for screenshot tool

### macOS Permission Model
- **Context**: Required for Req 11 (Security)
- **Sources Consulted**:
  - Apple Developer Documentation
  - Community implementations
- **Findings**:
  - **Accessibility**: Required for UI scripting, mouse/keyboard. Check via:
    ```applescript
    tell application "System Events"
      UI elements enabled
    end tell
    ```
  - **Automation**: Per-app permission for controlling specific applications
  - **Screen Recording**: Required for capturing window contents (not just window chrome)
  - Permissions managed in System Settings > Privacy & Security
- **Implications**: Implement permission checking per tool category; provide clear guidance on how to grant permissions

### Existing MCP Implementations for Reference
- **Context**: Validate architecture decisions against working implementations
- **Sources Consulted**:
  - @steipete/macos-automator-mcp
  - @steipete/peekaboo-mcp
  - @peakmojo/applescript-mcp
  - Macuse MCP server
- **Findings**:
  - Common pattern: AppleScript via osascript for most operations
  - Tool organization by functional domain
  - Error responses with isError flag
  - Permission detection and user guidance in error messages
- **Implications**: Architecture aligns with proven patterns in the ecosystem

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| AppleScript-First | All operations via osascript | Simple, no compilation, cross-version compatible | Performance overhead for rapid operations | **Selected** - aligns with requirements |
| Native Addon | CGEvent/AXUIElement via N-API | Direct API access, better performance | Requires compilation, platform-specific | Overkill for this use case |
| Hybrid | AppleScript + Native for performance-critical | Best of both | Complexity, maintenance burden | Future consideration if perf issues arise |

## Design Decisions

### Decision: AppleScript-First Execution Strategy
- **Context**: Need reliable macOS control without native addon complexity
- **Alternatives Considered**:
  1. Native Node.js addon with CGEvent/AXUIElement bindings
  2. Pure AppleScript via osascript
  3. Hybrid approach
- **Selected Approach**: Pure AppleScript via osascript binary
- **Rationale**:
  - Covers all 17 requirements
  - No compilation required (pure JS/TS)
  - Stable across macOS versions
  - Simpler maintenance
- **Trade-offs**:
  - Slightly higher latency per operation (~50-100ms overhead)
  - Less precise mouse control (sufficient for automation)
- **Follow-up**: Monitor performance; consider native addon only if latency is user-impacting

### Decision: Tool Registration Architecture
- **Context**: 45+ individual tools across 12 domains
- **Alternatives Considered**:
  1. Single file with all tools
  2. Domain-based modules with lazy registration
  3. Dynamic tool loading from filesystem
- **Selected Approach**: Domain-based modules with explicit registration
- **Rationale**:
  - Clear code organization
  - Parallel development possible
  - Easy to test individual domains
  - Type safety with Zod schemas per tool
- **Trade-offs**: More files, explicit imports required
- **Follow-up**: Consider tool discovery for plugin architecture in future

### Decision: Unified Error Response Format
- **Context**: Need consistent error handling across all tools (Req 10)
- **Alternatives Considered**:
  1. Throw exceptions (MCP SDK handles)
  2. Return isError responses consistently
  3. Mix of both
- **Selected Approach**: Return isError responses with structured error messages
- **Rationale**:
  - Predictable for AI consumers
  - Can include actionable guidance (e.g., permission instructions)
  - Aligns with MCP best practices
- **Trade-offs**: More verbose handler code
- **Follow-up**: Create error factory utilities

### Decision: Permission Checking Strategy
- **Context**: Different tools require different macOS permissions (Req 11)
- **Alternatives Considered**:
  1. Check permissions upfront on server start
  2. Check permissions lazily per tool call
  3. Assume permissions and handle errors
- **Selected Approach**: Lazy permission checking with informative errors
- **Rationale**:
  - Better UX - only prompt for needed permissions
  - Some tools work without all permissions
  - Clear error messages guide users
- **Trade-offs**: Permission errors happen at runtime
- **Follow-up**: Consider caching permission status

## Risks & Mitigations
- **Risk**: AppleScript execution timeout on complex operations
  - **Mitigation**: 30-second timeout with clear error; break complex operations into smaller steps
- **Risk**: macOS version compatibility
  - **Mitigation**: Test on macOS 12+ (Monterey through Tahoe); document version requirements
- **Risk**: Permission prompts interrupting workflow
  - **Mitigation**: Clear documentation; permission check tool to validate setup
- **Risk**: AppleScript output parsing failures
  - **Mitigation**: Structured output format; fallback to raw text; comprehensive tests

## References
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK documentation
- [Apple Script Language Guide](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/) - AppleScript reference
- [Accessibility Programming Guide](https://developer.apple.com/library/archive/documentation/Accessibility/Conceptual/AccessibilityMacOSX/) - macOS Accessibility APIs
- [screencapture man page](https://ss64.com/osx/screencapture.html) - Screenshot utility reference
- [Macuse MCP](https://lobehub.com/mcp/macuse-app-macuse) - Reference implementation patterns
