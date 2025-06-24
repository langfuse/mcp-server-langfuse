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

// Requires Environment Variables
const langfuse = new Langfuse();

// Create MCP server instance with a "prompts" capability.
const server = new McpServer(
  {
    name: "langfuse-prompts",
    version: "0.1.0",
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

server.tool(
  "update-prompt",
  "Create a new prompt version or update labels on an existing version. Can promote to production.",
  {
    name: z.string().describe("Name of the prompt to create or update"),
    prompt: z
      .union([
        z.string(),
        z.array(
          z.object({
            role: z
              .string()
              .describe("Role of the message (system, user, assistant)"),
            content: z.string().describe("Content of the message"),
          })
        ),
      ])
      .optional()
      .describe(
        "The prompt content. For text prompts, provide a string. For chat prompts, provide an array of message objects with role and content. Required when creating new versions, omit when only updating labels."
      ),
    version: z
      .number()
      .optional()
      .describe(
        "Specific version number to update labels on. If provided, only labels will be updated. If omitted, creates a new version."
      ),
    type: z
      .enum(["text", "chat"])
      .optional()
      .default("text")
      .describe(
        "Type of prompt - 'text' for simple text prompts or 'chat' for conversation-style prompts"
      ),
    config: z
      .record(z.any())
      .optional()
      .describe(
        "Optional configuration object for model parameters (e.g., temperature, model name, etc.)"
      ),
    labels: z
      .array(z.string())
      .optional()
      .describe(
        "Labels to assign to this prompt version (e.g., ['staging', 'production'])"
      ),
    tags: z
      .array(z.string())
      .optional()
      .describe("Tags to categorize the prompt"),
  },
  async (args) => {
    try {
      // Prepare labels, adding 'production' if requested
      let finalLabels = args.labels
        ? [...args.labels, "production"]
        : ["production"];

      let result;
      let isNewVersion = false;

      // If version is specified, update labels on existing version
      if (args.version !== undefined) {
        result = await langfuse.updatePrompt({
          name: args.name,
          version: args.version,
          newLabels: finalLabels,
        });
      } else {
        // Create new version
        if (!args.prompt) {
          throw new Error(
            "Prompt content is required when creating new versions"
          );
        }

        isNewVersion = true;

        if (args.type === "chat") {
          // Handle chat prompts
          if (typeof args.prompt === "string") {
            throw new Error(
              "For chat prompts, prompt must be an array of message objects"
            );
          }
          result = await langfuse.createPrompt({
            name: args.name,
            prompt: args.prompt,
            type: "chat",
            config: args.config,
            labels: finalLabels,
            tags: args.tags,
          });
        } else {
          // Handle text prompts
          if (typeof args.prompt !== "string") {
            throw new Error("For text prompts, prompt must be a string");
          }
          result = await langfuse.createPrompt({
            name: args.name,
            prompt: args.prompt,
            type: "text",
            config: args.config,
            labels: finalLabels,
            tags: args.tags,
          });
        }
      }

      const message = isNewVersion
        ? `Prompt '${args.name}' ${
            finalLabels.includes("production")
              ? "created and promoted to production"
              : "created successfully"
          }`
        : `Prompt '${args.name}' version ${args.version} ${
            finalLabels.includes("production")
              ? "promoted to production"
              : "labels updated successfully"
          }`;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: message,
                promptName: args.name,
                version: args.version || "New version created",
                labels: finalLabels,
                operation: isNewVersion ? "create" : "update_labels",
                deployedTo: finalLabels.includes("production")
                  ? "production"
                  : "staging",
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error updating prompt: ${error}` }],
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
