import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Langfuse from "langfuse";

/**
 * Register observation-related tools with the MCP server.
 */
export function registerObservationTools(server: McpServer, langfuse: Langfuse): void {
  // list-observations
  server.tool(
    "list-observations",
    "List observations (generations, spans, events) with filtering. Supports cursor-based pagination.",
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
      traceId: z.string().optional().describe("Filter by trace ID"),
      name: z.string().optional().describe("Filter by observation name"),
      type: z
        .enum(["GENERATION", "SPAN", "EVENT"])
        .optional()
        .describe("Filter by observation type"),
      parentObservationId: z.string().optional().describe("Filter by parent observation ID"),
      fromStartTime: z.string().optional().describe("Start of time range (ISO 8601)"),
      toStartTime: z.string().optional().describe("End of time range (ISO 8601)"),
      userId: z.string().optional().describe("Filter by user ID"),
      version: z.string().optional().describe("Filter by version"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.observationsGetMany({
          page: args.page,
          limit: args.limit,
          traceId: args.traceId ?? undefined,
          name: args.name ?? undefined,
          type: args.type ?? undefined,
          parentObservationId: args.parentObservationId ?? undefined,
          fromStartTime: args.fromStartTime ?? undefined,
          toStartTime: args.toStartTime ?? undefined,
          userId: args.userId ?? undefined,
          version: args.version ?? undefined,
        });

        const count = (result as { data?: unknown[] }).data?.length ?? 0;
        const summary = `Found ${count} observations`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error listing observations: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // get-observation
  server.tool(
    "get-observation",
    "Get a specific observation with all details including usage, costs, and timing.",
    {
      observationId: z.string().min(1).describe("The unique observation identifier"),
      includeIO: z.coerce
        .boolean()
        .optional()
        .default(false)
        .describe("Include input/output fields (can be very large, disabled by default)"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.observationsGet(args.observationId);

        // Optionally strip input/output fields to reduce response size
        let response: Record<string, unknown> = result as unknown as Record<string, unknown>;
        if (!args.includeIO) {
          const { input: _i, output: _o, ...rest } = response;
          response = rest;
        }

        const obsType = (result as { type?: string }).type ?? "observation";
        const name = (result as { name?: string }).name ?? args.observationId;
        const summary = `${obsType} "${name}"`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(response, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error getting observation: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
