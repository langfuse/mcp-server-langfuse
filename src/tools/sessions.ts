import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Langfuse from "langfuse";

/**
 * Register session-related tools with the MCP server.
 */
export function registerSessionTools(server: McpServer, langfuse: Langfuse): void {
  // list-sessions
  server.tool(
    "list-sessions",
    "List all sessions with filtering and pagination.",
    {
      page: z.coerce.number().int().min(1).optional().default(1).describe("Page number (1-indexed)"),
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(10)
        .describe("Items per page (max 100)"),
      fromTimestamp: z.string().optional().describe("Start of time range (ISO 8601)"),
      toTimestamp: z.string().optional().describe("End of time range (ISO 8601)"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.sessionsList({
          page: args.page,
          limit: args.limit,
          fromTimestamp: args.fromTimestamp ?? undefined,
          toTimestamp: args.toTimestamp ?? undefined,
        });

        const count = (result as { data?: unknown[] }).data?.length ?? 0;
        const summary = `Found ${count} sessions`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error listing sessions: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // get-session
  server.tool(
    "get-session",
    "Get a specific session with its associated traces.",
    {
      sessionId: z.string().min(1).describe("The unique session identifier"),
      includeIO: z.coerce
        .boolean()
        .optional()
        .default(false)
        .describe("Include input/output fields in traces (can be very large)"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.sessionsGet(args.sessionId);

        // Optionally strip input/output fields from traces to reduce response size
        let response: Record<string, unknown> = result as unknown as Record<string, unknown>;
        if (!args.includeIO && response.traces) {
          const traces = response.traces as Record<string, unknown>[];
          response = {
            ...response,
            traces: traces.map((trace) => {
              const { input: _i, output: _o, ...rest } = trace;
              return rest;
            }),
          };
        }

        const traceCount = ((result as { traces?: unknown[] }).traces?.length ?? 0);
        const summary = `Session "${args.sessionId}" with ${traceCount} traces`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(response, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error getting session: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
