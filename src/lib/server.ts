/**
 * MCP Server Factory
 *
 * Creates and configures the MCP server instance for macOS automation.
 * Handles tool registration and protocol compliance.
 *
 * @module server
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

/**
 * Server metadata exposed for testing and identification.
 */
export const SERVER_INFO = {
  name: 'mac-mcp-server',
  version: '0.1.0',
} as const

/**
 * MCP-compliant text content block.
 */
export interface TextContent {
  type: 'text'
  text: string
}

/**
 * MCP-compliant tool response.
 * Matches the SDK's expected return type for tool handlers.
 */
export interface ToolResponse {
  content: TextContent[]
  isError?: boolean
  structuredContent?: Record<string, unknown>
}

/**
 * Tool handler function type.
 *
 * @template T - Input parameters type inferred from Zod schema
 * @param params - Validated input parameters
 * @returns MCP-compliant tool response
 *
 * @example
 * const handler: ToolHandler<{ name: string }> = async ({ name }) => ({
 *   content: [{ type: 'text', text: `Hello, ${name}!` }],
 * })
 */
export type ToolHandler<T> = (params: T) => Promise<ToolResponse>

/**
 * Creates a new MCP server instance with macOS automation capabilities.
 *
 * @returns Configured McpServer instance ready for tool registration
 *
 * @example
 * const server = createMcpServer()
 * server.registerTool('my-tool', {...}, handler)
 * await server.connect(transport)
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
  })

  return server
}

/**
 * Creates a success response in MCP-compliant format.
 *
 * @param text - Response text content
 * @returns MCP-compliant success response
 *
 * @example
 * return createSuccessResponse('Operation completed')
 */
export function createSuccessResponse(text: string): ToolResponse {
  return {
    content: [{ type: 'text', text }],
  }
}

/**
 * Creates an error response in MCP-compliant format.
 *
 * @param message - Error message
 * @returns MCP-compliant error response with isError flag
 *
 * @example
 * return createErrorResponse('Application not found: Safari')
 */
export function createErrorResponse(message: string): ToolResponse {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  }
}

/**
 * Creates a structured response with both text and parsed data.
 *
 * @template T - Type of the structured content (must be a Record)
 * @param data - Structured data to include
 * @returns MCP-compliant response with structuredContent
 *
 * @example
 * return createStructuredResponse({ volume: 75, muted: false })
 */
export function createStructuredResponse<T extends Record<string, unknown>>(
  data: T,
): ToolResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: data,
  }
}
