import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Langfuse from "langfuse";

/**
 * Register score-related tools with the MCP server.
 */
export function registerScoreTools(server: McpServer, langfuse: Langfuse): void {
  // create-score
  server.tool(
    "create-score",
    "Create a score for a trace or observation. Supports numeric, boolean, and categorical score types.",
    {
      traceId: z.string().min(1).describe("ID of the trace to score"),
      name: z.string().min(1).describe("Name of the score (e.g., 'accuracy', 'relevance')"),
      value: z
        .preprocess(
          (val) => (typeof val === "string" && !isNaN(Number(val)) ? Number(val) : val),
          z.union([z.number(), z.string()])
        )
        .describe("Score value - numeric for NUMERIC type, string for CATEGORICAL/BOOLEAN"),
      observationId: z.string().optional().describe("Optional: ID of specific observation to score"),
      dataType: z
        .enum(["NUMERIC", "CATEGORICAL", "BOOLEAN"])
        .optional()
        .describe("Type of score value"),
      comment: z.string().optional().describe("Optional comment explaining the score"),
      configId: z.string().optional().describe("Optional score config ID for validation"),
      id: z.string().optional().describe("Optional custom ID for idempotency"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.scoreCreate({
          traceId: args.traceId,
          name: args.name,
          value: args.value,
          observationId: args.observationId ?? undefined,
          dataType: args.dataType ?? undefined,
          comment: args.comment ?? undefined,
          configId: args.configId ?? undefined,
          id: args.id ?? undefined,
        });

        const targetDesc = args.observationId
          ? `observation ${args.observationId}`
          : `trace ${args.traceId}`;
        const summary = `Created score "${args.name}" = ${String(args.value)} for ${targetDesc}`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error creating score: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // list-scores
  server.tool(
    "list-scores",
    "List scores with filtering and pagination.",
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
      userId: z.string().optional().describe("Filter by user ID associated with the trace"),
      name: z.string().optional().describe("Filter by score name"),
      fromTimestamp: z.string().optional().describe("Start of time range (ISO 8601)"),
      toTimestamp: z.string().optional().describe("End of time range (ISO 8601)"),
      source: z.enum(["API", "ANNOTATION", "EVAL"]).optional().describe("Filter by score source"),
      dataType: z
        .enum(["NUMERIC", "CATEGORICAL", "BOOLEAN"])
        .optional()
        .describe("Filter by data type"),
      configId: z.string().optional().describe("Filter by config ID"),
      operator: z
        .enum(["<", ">", "<=", ">=", "!=", "="])
        .optional()
        .describe("Comparison operator for value filter"),
      value: z.coerce.number().optional().describe("Value to compare (requires operator)"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.scoreGet({
          page: args.page,
          limit: args.limit,
          userId: args.userId ?? undefined,
          name: args.name ?? undefined,
          fromTimestamp: args.fromTimestamp ?? undefined,
          toTimestamp: args.toTimestamp ?? undefined,
          source: args.source ?? undefined,
          dataType: args.dataType ?? undefined,
          configId: args.configId ?? undefined,
          operator: args.operator ?? undefined,
          value: args.value ?? undefined,
        });

        const count = (result as { data?: unknown[] }).data?.length ?? 0;
        const summary = `Found ${count} scores`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error listing scores: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // get-score
  server.tool(
    "get-score",
    "Get a specific score by ID.",
    {
      scoreId: z.string().min(1).describe("The unique score identifier"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.scoreGetById(args.scoreId);

        const name = (result as { name?: string }).name ?? args.scoreId;
        const value = (result as { value?: unknown }).value;
        const summary = `Score "${name}" = ${String(value)}`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error getting score: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // delete-score
  server.tool(
    "delete-score",
    "Delete a score. This action is irreversible.",
    {
      scoreId: z.string().min(1).describe("The unique score identifier to delete"),
    },
    async (args) => {
      try {
        await langfuse.api.scoreDelete(args.scoreId);

        return {
          content: [{ type: "text", text: `Successfully deleted score: ${args.scoreId}` }],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error deleting score: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
