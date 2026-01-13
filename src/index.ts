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

/**
 * Main entry point for the MCP server.
 *
 * Initializes the server and connects via stdio transport for
 * Claude Code compatibility.
 */
async function main(): Promise<void> {
  const server = createMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(console.error)
