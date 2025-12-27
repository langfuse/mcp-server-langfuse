import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Langfuse from "langfuse";

/**
 * Register dataset-related tools with the MCP server.
 */
export function registerDatasetTools(server: McpServer, langfuse: Langfuse): void {
  // create-dataset
  server.tool(
    "create-dataset",
    "Create a new dataset for storing evaluation items.",
    {
      name: z.string().min(1).describe("Name for the new dataset"),
      description: z.string().optional().describe("Description of the dataset"),
      metadata: z.record(z.unknown()).optional().describe("Additional metadata as key-value pairs"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.datasetsCreate({
          name: args.name,
          description: args.description ?? undefined,
          metadata: args.metadata ?? undefined,
        });

        const summary = `Created dataset "${args.name}"`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error creating dataset: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // list-datasets
  server.tool(
    "list-datasets",
    "List all datasets in the project.",
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
        const result = await langfuse.api.datasetsList({
          page: args.page,
          limit: args.limit,
        });

        const count = (result as { data?: unknown[] }).data?.length ?? 0;
        const summary = `Found ${count} datasets`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error listing datasets: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // get-dataset
  server.tool(
    "get-dataset",
    "Get a dataset by name.",
    {
      datasetName: z.string().min(1).describe("The dataset name"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.datasetsGet(args.datasetName);

        const summary = `Dataset "${args.datasetName}"`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error getting dataset: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // create-dataset-item
  server.tool(
    "create-dataset-item",
    "Create or update a dataset item. Use the id field for upsert behavior.",
    {
      datasetName: z.string().min(1).describe("Target dataset name"),
      input: z.unknown().describe("Item input data (any JSON value)"),
      expectedOutput: z.unknown().optional().describe("Expected output for evaluation"),
      metadata: z.record(z.unknown()).optional().describe("Item metadata"),
      sourceTraceId: z.string().optional().describe("Source trace ID if creating from a trace"),
      sourceObservationId: z
        .string()
        .optional()
        .describe("Source observation ID if creating from an observation"),
      id: z.string().optional().describe("Custom ID for upsert behavior"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.datasetItemsCreate({
          datasetName: args.datasetName,
          input: args.input,
          expectedOutput: args.expectedOutput ?? undefined,
          metadata: args.metadata ?? undefined,
          sourceTraceId: args.sourceTraceId ?? undefined,
          sourceObservationId: args.sourceObservationId ?? undefined,
          id: args.id ?? undefined,
        });

        const itemId = (result as { id?: string }).id ?? "unknown";
        const summary = `Created dataset item ${itemId} in "${args.datasetName}"`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error creating dataset item: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // list-dataset-items
  server.tool(
    "list-dataset-items",
    "List items in a dataset.",
    {
      datasetName: z.string().min(1).describe("Dataset name"),
      page: z.coerce.number().int().min(1).optional().default(1).describe("Page number (1-indexed)"),
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(10)
        .describe("Items per page (max 100)"),
      sourceTraceId: z.string().optional().describe("Filter by source trace ID"),
      sourceObservationId: z.string().optional().describe("Filter by source observation ID"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.datasetItemsList({
          datasetName: args.datasetName,
          page: args.page,
          limit: args.limit,
          sourceTraceId: args.sourceTraceId ?? undefined,
          sourceObservationId: args.sourceObservationId ?? undefined,
        });

        const count = (result as { data?: unknown[] }).data?.length ?? 0;
        const summary = `Found ${count} items in dataset "${args.datasetName}"`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error listing dataset items: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // get-dataset-item
  server.tool(
    "get-dataset-item",
    "Get a specific dataset item by ID.",
    {
      datasetItemId: z.string().min(1).describe("The dataset item ID"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.datasetItemsGet(args.datasetItemId);

        const summary = `Dataset item ${args.datasetItemId}`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error getting dataset item: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // create-dataset-run-item
  server.tool(
    "create-dataset-run-item",
    "Link a trace/observation to a dataset item for evaluation runs.",
    {
      runName: z.string().min(1).describe("Name of the dataset run"),
      datasetItemId: z.string().min(1).describe("Dataset item ID to link"),
      traceId: z.string().min(1).describe("Trace ID to link"),
      runDescription: z.string().optional().describe("Description of this run"),
      observationId: z.string().optional().describe("Specific observation ID within the trace"),
      metadata: z.record(z.unknown()).optional().describe("Run item metadata"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.datasetRunItemsCreate({
          runName: args.runName,
          datasetItemId: args.datasetItemId,
          traceId: args.traceId,
          runDescription: args.runDescription ?? undefined,
          observationId: args.observationId ?? undefined,
          metadata: args.metadata ?? undefined,
        });

        const summary = `Created run item linking trace ${args.traceId} to item ${args.datasetItemId} in run "${args.runName}"`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error creating dataset run item: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // list-dataset-runs
  server.tool(
    "list-dataset-runs",
    "List runs for a dataset.",
    {
      datasetName: z.string().min(1).describe("Dataset name"),
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
        const result = await langfuse.api.datasetsGetRuns({
          datasetName: args.datasetName,
          page: args.page,
          limit: args.limit,
        });

        const count = (result as { data?: unknown[] }).data?.length ?? 0;
        const summary = `Found ${count} runs for dataset "${args.datasetName}"`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error listing dataset runs: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // get-dataset-run
  server.tool(
    "get-dataset-run",
    "Get a specific dataset run with its items.",
    {
      datasetName: z.string().min(1).describe("Dataset name"),
      runName: z.string().min(1).describe("Run name"),
    },
    async (args) => {
      try {
        const result = await langfuse.api.datasetsGetRun(args.datasetName, args.runName);

        const itemCount = (result as { datasetRunItems?: unknown[] }).datasetRunItems?.length ?? 0;
        const summary = `Run "${args.runName}" for dataset "${args.datasetName}" with ${itemCount} items`;

        return {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error getting dataset run: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
