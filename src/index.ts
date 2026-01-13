#!/usr/bin/env node
/**
 * macOS AppleScript MCP Server
 *
 * An MCP server that enables AI assistants to control macOS
 * through AppleScript commands. Exposes tools for application management,
 * window control, system information, clipboard, notifications, and more.
 *
 * @module mac-mcp-server
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { createMcpServer } from './lib/server.js'
import { registerAllTools } from './lib/register-tools.js'

/**
 * Main entry point for the MCP server.
 *
 * Initializes the server, registers all macOS automation tools,
 * and connects via stdio transport for Claude Code compatibility.
 */
async function main(): Promise<void> {
  const server = createMcpServer()

  // Register all 44 macOS automation tools
  registerAllTools(server)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(console.error)
