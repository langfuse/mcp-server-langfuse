# Langfuse Prompt Management MCP Server

[Model Context Protocol](https://github.com/modelcontextprotocol) (MCP) Server for [Langfuse Prompt Management](https://langfuse.com/docs/prompts/get-started). This server allows you to access and manage your Langfuse prompts through the Model Context Protocol.

## Demo

Quick demo of Langfuse Prompts MCP in Claude Desktop (_unmute for voice-over explanations_):

https://github.com/user-attachments/assets/61da79af-07c2-4f69-b28c-ca7c6e606405

## Features

### MCP Prompt

This server implements the [MCP Prompts specification](https://modelcontextprotocol.io/docs/concepts/prompts) for prompt discovery and retrieval.

- `prompts/list`: List all available prompts

  - Optional cursor-based pagination
  - Returns prompt names and their required arguments, limitation: all arguments are assumed to be optional and do not include descriptions as variables do not have specification in Langfuse
  - Includes next cursor for pagination if there's more than 1 page of prompts

- `prompts/get`: Get a specific prompt

  - Transforms Langfuse prompts (text and chat) into MCP prompt objects
  - Compiles prompt with provided variables

### Tools

To increase compatibility with other MCP clients that do not support the prompt capability, the server also exports tools that replicate the functionality of the MCP Prompts.

- `get-prompts`: List available prompts

  - Optional `cursor` parameter for pagination
  - Returns a list of prompts with their arguments

- `get-prompt`: Retrieve and compile a specific prompt
  - Required `name` parameter: Name of the prompt to retrieve
  - Optional `arguments` parameter: JSON object with prompt variables
- `get-trace`: Retrieve Langfuse trace data, optionally filtering by observation name or index.
  - Required `traceId` parameter: The ID of the trace to retrieve.
  - Optional `function_name` parameter: Filter observations by exact name. If multiple matches are found, their trace-level indices are returned.
  - Optional `index` parameter: Retrieve a specific observation by its trace-level index (0-based). `function_name` and `index` are mutually exclusive.
  - Caching: Fetched traces are cached locally in the `cache_data/` directory (ignored by git) to speed up subsequent requests for the same trace.
  - Size Limit: If no filter (`function_name` or `index`) is provided and the full trace data exceeds 40 KB, a summary of the trace structure (observation names and indices) is returned instead of the full content to prevent excessive output.

## Development

```bash
npm install

# build current file
npm run build

# test in mcp inspector
npx @modelcontextprotocol/inspector node ./build/index.js
```

## Usage

### Step 1: Build

```bash
npm install
npm run build
```

### Step 2: Add the server to your MCP servers:

#### Claude Desktop

Configure Claude for Desktop by editing `claude_desktop_config.json`

```json
{
  "mcpServers": {
    "langfuse": {
      "command": "node",
      "args": ["<absolute-path>/build/index.js"],
      "env": {
        "LANGFUSE_PUBLIC_KEY": "your-public-key",
        "LANGFUSE_SECRET_KEY": "your-secret-key",
        "LANGFUSE_BASEURL": "https://cloud.langfuse.com"
      }
    }
  }
}
```

Make sure to replace the environment variables with your actual Langfuse API keys. The server will now be available to use in Claude Desktop.

#### Cursor

Add new server to Cursor:

- Name: `Langfuse Prompts`
- Type: `command`
- Command:
  ```bash
  LANGFUSE_PUBLIC_KEY="your-public-key" LANGFUSE_SECRET_KEY="your-secret-key" LANGFUSE_BASEURL="https://cloud.langfuse.com" node absolute-path/build/index.js
  ```

## Limitations

The MCP Server is a work in progress and has some limitations:

- Only prompts with a `production` label in Langfuse are returned
- All arguments are assumed to be optional and do not include descriptions as variables do not have specification in Langfuse
- List operations require fetching each prompt individually in the background to extract the arguments, this works but is not efficient

Contributions are welcome! Please open an issue or a PR ([repo](https://github.com/langfuse/mcp-server-langfuse)) if you have any suggestions or feedback.
