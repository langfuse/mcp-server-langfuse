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
import { registerAllObservabilityTools } from "./tools/index.js";

// Requires Environment Variables
const langfuse = new Langfuse();

// Create MCP server instance with a "prompts" capability.
const server = new McpServer(
  {
    name: "langfuse",
    version: "1.0.0",
  },
  {
    capabilities: {
      prompts: {},
    },
  }
);

// Register observability tools (traces, observations, scores, datasets, sessions)
registerAllObservabilityTools(server, langfuse);

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Langfuse MCP Server running on stdio");
  console.error("24 tools registered (2 prompt tools + 22 observability tools)");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
