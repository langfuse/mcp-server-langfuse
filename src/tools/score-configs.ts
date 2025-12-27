import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Langfuse from "langfuse";

/**
 * Register score configuration tools with the MCP server.
 */
export function registerScoreConfigTools(server: McpServer, langfuse: Langfuse): void {
  // create-score-config
  server.tool(
    "create-score-config",
    "Create a score configuration template for consistent scoring across your project.",
    {
      name: z.string().min(1).describe("Unique name for the score config"),
      dataType: z
        .enum(["NUMERIC", "CATEGORICAL", "BOOLEAN"])
        .describe("Data type for scores using this config"),
      minValue: z.coerce
        .number()
        .optional()
        .describe("Minimum value for NUMERIC scores"),
      maxValue: z.coerce
        .number()
        .optional()
        .describe("Maximum value for NUMERIC scores"),
      categories: z
        .array(
          z.object({
            label: z.string().describe("Category display label"),
            value: z.coerce.number().describe("Category numeric value"),
          })
        )
        .optional()
        .describe("Category definitions for CATEGORICAL scores"),
      description: z.string().optional().describe("Description of the score config"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.scoreConfigsCreate({
          name: args.name,
          dataType: args.dataType,
          minValue: args.minValue ?? undefined,
          maxValue: args.maxValue ?? undefined,
          categories: args.categories ?? undefined,
          description: args.description ?? undefined,
        });

        const summary = `Created score config "${args.name}" (${args.dataType})`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error creating score config: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // list-score-configs
  server.tool(
    "list-score-configs",
    "List all score configurations in the project.",
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
    },
    async (args) => {
      try {
        const result = await langfuse.api.scoreConfigsGet({
          page: args.page,
          limit: args.limit,
        });

        const count = (result as { data?: unknown[] }).data?.length ?? 0;
        const summary = `Found ${count} score configs`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error listing score configs: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // get-score-config
  server.tool(
    "get-score-config",
    "Get a specific score configuration by ID.",
    {
      configId: z.string().min(1).describe("The unique score config identifier"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.scoreConfigsGetById(args.configId);

        const name = (result as { name?: string }).name ?? args.configId;
        const dataType = (result as { dataType?: string }).dataType ?? "unknown";
        const summary = `Score config "${name}" (${dataType})`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error getting score config: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
