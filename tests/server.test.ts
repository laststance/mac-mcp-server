/**
 * MCP Server Core Tests
 *
 * Tests for MCP server initialization, tool registration, and protocol compliance.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'

import {
  createMcpServer,
  SERVER_INFO,
  createSuccessResponse,
  createErrorResponse,
  createStructuredResponse,
} from '../src/lib/server.js'

describe('MCP Server Core', () => {
  describe('Server Initialization', () => {
    it('should create a server with correct name and version', () => {
      const server = createMcpServer()
      expect(server).toBeDefined()
      expect(SERVER_INFO.name).toBe('mac-mcp-server')
      expect(SERVER_INFO.version).toBe('0.1.0')
    })
  })

  describe('Tool Registration', () => {
    it('should have registerTool method available', () => {
      const server = createMcpServer()
      expect(typeof server.registerTool).toBe('function')
    })

    it('should register a tool with input schema and handler', () => {
      const server = createMcpServer()

      // Should not throw when registering a tool
      expect(() => {
        server.registerTool(
          'echo',
          {
            title: 'Echo Tool',
            description: 'Echoes back the input message',
            inputSchema: {
              message: z.string().describe('Message to echo'),
            },
          },
          async ({ message }) => ({
            content: [{ type: 'text', text: `Echo: ${message}` }],
          }),
        )
      }).not.toThrow()
    })
  })

  describe('Server Connection', () => {
    it('should have connect method for transport binding', () => {
      const server = createMcpServer()
      expect(typeof server.connect).toBe('function')
    })
  })

  describe('Response Helpers', () => {
    describe('createSuccessResponse', () => {
      it('should create MCP-compliant success response', () => {
        const response = createSuccessResponse('Operation completed')
        expect(response.content).toHaveLength(1)
        expect(response.content[0]?.type).toBe('text')
        expect(response.content[0]?.text).toBe('Operation completed')
        expect(response.isError).toBeUndefined()
      })
    })

    describe('createErrorResponse', () => {
      it('should create MCP-compliant error response with isError flag', () => {
        const response = createErrorResponse('Application not found')
        expect(response.isError).toBe(true)
        expect(response.content).toHaveLength(1)
        expect(response.content[0]?.type).toBe('text')
        expect(response.content[0]?.text).toBe('Application not found')
      })
    })

    describe('createStructuredResponse', () => {
      it('should create response with both text and structured content', () => {
        const data = { volume: 75, muted: false }
        const response = createStructuredResponse(data)

        expect(response.content).toHaveLength(1)
        expect(response.content[0]?.type).toBe('text')
        expect(response.content[0]?.text).toBe(JSON.stringify(data))
        expect(response.structuredContent).toEqual(data)
      })

      it('should handle nested object data', () => {
        const data = {
          apps: [
            { name: 'App1', pid: 123 },
            { name: 'App2', pid: 456 },
          ],
          count: 2,
        }
        const response = createStructuredResponse(data)

        expect(response.structuredContent).toEqual(data)
        expect(JSON.parse(response.content[0]?.text ?? '')).toEqual(data)
      })
    })
  })
})
