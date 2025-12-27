import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Langfuse from "langfuse";

/**
 * Register trace-related tools with the MCP server.
 */
export function registerTraceTools(server: McpServer, langfuse: Langfuse): void {
  // list-traces
  server.tool(
    "list-traces",
    "List traces with filtering and pagination. Returns trace metadata including latency, cost, and observation/score counts.",
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
      name: z.string().optional().describe("Filter by trace name"),
      userId: z.string().optional().describe("Filter by user ID"),
      sessionId: z.string().optional().describe("Filter by session ID"),
      tags: z.array(z.string()).optional().describe("Filter by tags (AND logic)"),
      fromTimestamp: z.string().optional().describe("Start of time range (ISO 8601)"),
      toTimestamp: z.string().optional().describe("End of time range (ISO 8601)"),
      orderBy: z.enum(["timestamp", "latency", "totalCost"]).optional().describe("Sort field"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.traceList({
          page: args.page,
          limit: args.limit,
          name: args.name ?? undefined,
          userId: args.userId ?? undefined,
          sessionId: args.sessionId ?? undefined,
          tags: args.tags ?? undefined,
          fromTimestamp: args.fromTimestamp ?? undefined,
          toTimestamp: args.toTimestamp ?? undefined,
          orderBy: args.orderBy ?? undefined,
        });

        const count = result.data?.length ?? 0;
        const total = result.meta?.totalItems ?? count;
        const summary = `Found ${count} traces (total: ${total})`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error listing traces: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // get-trace
  server.tool(
    "get-trace",
    "Get a specific trace with full details including all observations and scores.",
    {
      traceId: z.string().min(1).describe("The unique trace identifier"),
      includeIO: z.coerce
        .boolean()
        .optional()
        .default(false)
        .describe("Include input/output fields (can be very large, disabled by default)"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.traceGet(args.traceId);

        // Optionally strip input/output fields to reduce response size
        let response: Record<string, unknown> = result as unknown as Record<string, unknown>;
        if (!args.includeIO) {
          const { input: _i, output: _o, ...rest } = response;
          response = rest;
        }

        const observationCount = (result as { observations?: unknown[] }).observations?.length ?? 0;
        const scoreCount = (result as { scores?: unknown[] }).scores?.length ?? 0;
        const name = (result as { name?: string }).name ?? args.traceId;
        const summary = `Trace "${name}" with ${observationCount} observations and ${scoreCount} scores`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(response, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error getting trace: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
