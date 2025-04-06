import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListPromptsRequestSchema,
  ListPromptsRequest,
  ListPromptsResult,
  GetPromptRequestSchema,
  GetPromptRequest,
  GetPromptResult,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { Langfuse, ChatPromptClient } from "langfuse";
import { extractVariables } from "./utils.js";
import { z } from "zod";
import * as fs from 'fs/promises';
import * as path from 'path';

// Requires Environment Variables
const langfuse = new Langfuse();
const cacheDir = path.resolve(process.cwd(), 'cache_data');

// Create MCP server instance with a "prompts" capability.
const server = new McpServer(
  {
    name: "langfuse-prompts",
    version: "1.0.0",
  },
  {
    capabilities: {
      prompts: {},
    },
  }
);

async function listPromptsHandler(
  request: ListPromptsRequest
): Promise<ListPromptsResult> {
  try {
    const cursor = request.params?.cursor;
    const page = cursor ? Number(cursor) : 1;
    if (cursor !== undefined && isNaN(page)) {
      throw new Error("Cursor must be a valid number");
    }

    const res = await langfuse.api.promptsList({
      limit: 100,
      page,
      label: "production",
    });

    const resPrompts: ListPromptsResult["prompts"] = await Promise.all(
      res.data.map(async (i) => {
        const prompt = await langfuse.getPrompt(i.name, undefined, {
          cacheTtlSeconds: 0,
        });
        const variables = extractVariables(JSON.stringify(prompt.prompt));
        return {
          name: i.name,
          arguments: variables.map((v) => ({
            name: v,
            required: false,
          })),
        };
      })
    );

    return {
      prompts: resPrompts,
      nextCursor:
        res.meta.totalPages > page ? (page + 1).toString() : undefined,
    };
  } catch (error) {
    console.error("Error fetching prompts:", error);
    throw new Error("Failed to fetch prompts");
  }
}

async function getPromptHandler(
  request: GetPromptRequest
): Promise<GetPromptResult> {
  const promptName: string = request.params.name;
  const args = request.params.arguments || {};

  try {
    // Initialize Langfuse client and fetch the prompt by name.
    let compiledTextPrompt: string | undefined;
    let compiledChatPrompt: ChatPromptClient["prompt"] | undefined; // Langfuse chat prompt type

    try {
      // try chat prompt type first
      const prompt = await langfuse.getPrompt(promptName, undefined, {
        type: "chat",
      });
      if (prompt.type !== "chat") {
        throw new Error(`Prompt '${promptName}' is not a chat prompt`);
      }
      compiledChatPrompt = prompt.compile(args);
    } catch (error) {
      // fallback to text prompt type
      const prompt = await langfuse.getPrompt(promptName, undefined, {
        type: "text",
      });
      compiledTextPrompt = prompt.compile(args);
    }

    if (compiledChatPrompt) {
      const result: GetPromptResult = {
        messages: compiledChatPrompt.map((msg) => ({
          role: ["ai", "assistant"].includes(msg.role) ? "assistant" : "user",
          content: {
            type: "text",
            text: msg.content,
          },
        })),
      };
      return result;
    } else if (compiledTextPrompt) {
      const result: GetPromptResult = {
        messages: [
          {
            role: "user",
            content: { type: "text", text: compiledTextPrompt },
          },
        ],
      };
      return result;
    } else {
      throw new Error(`Failed to get prompt for '${promptName}'`);
    }
  } catch (error: any) {
    throw new Error(
      `Failed to get prompt for '${promptName}': ${error.message}`
    );
  }
}

// Register handlers
server.server.setRequestHandler(ListPromptsRequestSchema, listPromptsHandler);
server.server.setRequestHandler(GetPromptRequestSchema, getPromptHandler);

// Tools for compatibility
server.tool(
  "get-prompts",
  "Get prompts that are stored in Langfuse",
  {
    cursor: z
      .string()
      .optional()
      .describe("Cursor to paginate through prompts"),
  },
  async (args) => {
    try {
      const res = await listPromptsHandler({
        method: "prompts/list",
        params: {
          cursor: args.cursor,
        },
      });

      const parsedRes: CallToolResult = {
        content: res.prompts.map((p) => ({
          type: "text",
          text: JSON.stringify(p),
        })),
      };

      return parsedRes;
    } catch (error) {
      return {
        content: [{ type: "text", text: "Error: " + error }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get-prompt",
  "Get a prompt that is stored in Langfuse",
  {
    name: z
      .string()
      .describe(
        "Name of the prompt to retrieve, use get-prompts to get a list of prompts"
      ),
    arguments: z
      .record(z.string())
      .optional()
      .describe(
        'Arguments with prompt variables to pass to the prompt template, json object, e.g. {"<name>":"<value>"}'
      ),
  },
  async (args, extra) => {
    try {
      const res = await getPromptHandler({
        method: "prompts/get",
        params: {
          name: args.name,
          arguments: args.arguments,
        },
      });

      const parsedRes: CallToolResult = {
        content: [
          {
            type: "text",
            text: JSON.stringify(res),
          },
        ],
      };

      return parsedRes;
    } catch (error) {
      return {
        content: [{ type: "text", text: "Error: " + error }],
        isError: true,
      };
    }
  }
);

// Register the get_trace tool
server.tool(
  "get_trace",
  "Fetches trace data from Langfuse using the provided trace ID.",
  { // Inlined schema definition
    traceId: z.string().describe("The ID of the Langfuse trace to fetch."),
    function_name: z.string().optional().describe("Optional name of the function/observation to filter by within the trace"),
    index: z.number().int().optional().describe("Optional index (0-based) to select a specific function call if multiple matches are found for function_name"),
  },
  async (args): Promise<CallToolResult> => {
    const cacheFilePath = path.join(cacheDir, `${args.traceId}.json`);
    let traceData: any; // Consider using a more specific type from Langfuse SDK if available, e.g., ApiTraceWithFullDetails

    try {
      // 1. Try reading from cache
      try {
        const cachedContent = await fs.readFile(cacheFilePath, 'utf-8');
        traceData = JSON.parse(cachedContent);
        console.error(`Cache hit for trace ${args.traceId}`);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // Cache miss, fetch from API
          console.error(`Cache miss for trace ${args.traceId}. Fetching from API.`);
          traceData = await langfuse.api.traceGet(args.traceId); // Fetch from API

          // Write to cache after successful API fetch
          try {
            await fs.mkdir(cacheDir, { recursive: true });
            await fs.writeFile(cacheFilePath, JSON.stringify(traceData, null, 2), 'utf-8');
            console.error(`Cached trace ${args.traceId} successfully.`);
          } catch (writeError) {
            // Log cache write error but don't fail the operation
            console.error(`Error writing cache for trace ${args.traceId}:`, writeError);
          }
        } else {
          // Other file system error reading cache, re-throw
          throw error;
        }
      }

      // --- REVISED FILTERING / INDEXING LOGIC ---

      // Ensure traceData and observations are valid before proceeding
      if (!traceData || !Array.isArray(traceData.observations)) {
        console.error(`Trace data or observations missing/invalid for trace ${args.traceId}`);
        return {
          content: [{ type: "text", text: `Error: Invalid trace data structure for trace ${args.traceId}. Cannot process filters.` }],
          isError: true,
        };
      }

      const observations = traceData.observations; // Alias for clarity

      // 1. Check for Index Filter (Highest Priority)
      if (args.index !== undefined && typeof args.index === 'number' && Number.isInteger(args.index)) {
        if (args.index >= 0 && args.index < observations.length) {
          // Valid index provided, return the specific observation's details
          const observation = observations[args.index];
          return {
            content: [{ type: "text", text: JSON.stringify({ input: observation.input, output: observation.output }, null, 2) }],
          };
        } else {
          // Invalid index
          return {
            content: [{ type: "text", text: `Error: Index ${args.index} is out of bounds. Valid indices are 0 to ${observations.length - 1}.` }],
            isError: true,
          };
        }
      }
      // 2. Check for Function Name Filter (if index not used)
      else if (args.function_name) {
        const matches = observations
          .map((obs: any, originalIndex: number) => ({ obs, originalIndex })) // Keep original index
          .filter((item: any) => item.obs.name === args.function_name);

        if (matches.length === 0) {
          return {
            content: [{ type: "text", text: `No observations found with name: ${args.function_name}` }],
          };
        } else if (matches.length === 1) {
          // Single match found, return its details
          return {
            content: [{ type: "text", text: JSON.stringify({ input: matches[0].obs.input, output: matches[0].obs.output }, null, 2) }],
          };
        } else {
          // Multiple matches found, return list of original indices and names
          const summary = matches.map((item: any) => ({ index: item.originalIndex, name: item.obs.name }));
          const message = `Multiple observations found with name '${args.function_name}'. Use the 'index' argument with one of the following original indices to retrieve specific details:\n\n${JSON.stringify(summary, null, 2)}`;
          return {
            content: [{ type: "text", text: message }],
          };
        }
      }
      // 3. Handle No Filter (if index and function_name not used)
      else {
        // No specific filter, check size before returning full trace
        const sizeThreshold = 40 * 1024; // 40 KB
        const stringifiedData = JSON.stringify(traceData);
        const byteSize = Buffer.byteLength(stringifiedData, 'utf-8');

        if (byteSize > sizeThreshold) {
          // Size exceeds threshold, return structure summary with original indices
          const structureSummary = observations.map((obs: any, idx: number) => ({ index: idx, name: obs.name }));
          const message = `Trace data exceeds ${sizeThreshold / 1024} KB (${(byteSize / 1024).toFixed(2)} KB). Returning structure summary. Use 'function_name' or 'index' arguments to retrieve specific observation details.\n\n${JSON.stringify(structureSummary, null, 2)}`;
          return {
            content: [{ type: "text", text: message }],
          };
        } else {
          // Size is within limit, return full trace
          return {
            content: [{ type: "text", text: stringifiedData }], // Use already stringified data
          };
        }
      }

    } catch (error) {
      // Handle API errors or unexpected file system errors
      console.error(`Error processing get_trace for ${args.traceId}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error fetching trace ${args.traceId}: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);


async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Langfuse Prompts MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
