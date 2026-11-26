> **This repository is replaced by the Langfuse MCP server.** The Langfuse MCP server is built into Langfuse at `https://cloud.langfuse.com/api/public/mcp`, with the same path on the US, Japan, HIPAA and self-hosted deployments. It covers prompts, traces and observations, scores, datasets and experiments, evaluators and annotation queues, with read and write tools. Setup: <https://langfuse.com/docs/api-and-data-platform/features/mcp-server>

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

#### VS Code

For one-click installation, click one of the install buttons below:

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-NPM-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=langfuse&config=%7B%22command%22%3A%22node%22%2C%22args%22%3A%5B%22build%2Findex.js%22%5D%2C%22env%22%3A%7B%22LANGFUSE_PUBLIC_KEY%22%3A%22%24%7Binput%3Apublic_key%7D%22%2C%22LANGFUSE_SECRET_KEY%22%3A%22%24%7Binput%3Asecret_key%7D%22%2C%22LANGFUSE_BASEURL%22%3A%22https%3A%2F%2Fcloud.langfuse.com%22%7D%7D&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22public_key%22%2C%22description%22%3A%22Langfuse+Public+Key%22%2C%22password%22%3Atrue%7D%2C%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22secret_key%22%2C%22description%22%3A%22Langfuse+Secret+Key%22%2C%22password%22%3Atrue%7D%5D) [![Install with NPX in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-NPM-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=langfuse&config=%7B%22command%22%3A%22node%22%2C%22args%22%3A%5B%22build%2Findex.js%22%5D%2C%22env%22%3A%7B%22LANGFUSE_PUBLIC_KEY%22%3A%22%24%7Binput%3Apublic_key%7D%22%2C%22LANGFUSE_SECRET_KEY%22%3A%22%24%7Binput%3Asecret_key%7D%22%2C%22LANGFUSE_BASEURL%22%3A%22https%3A%2F%2Fcloud.langfuse.com%22%7D%7D&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22public_key%22%2C%22description%22%3A%22Langfuse+Public+Key%22%2C%22password%22%3Atrue%7D%2C%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22secret_key%22%2C%22description%22%3A%22Langfuse+Secret+Key%22%2C%22password%22%3Atrue%7D%5D&quality=insiders)

You can also install manually by adding the following configuration to your VS Code settings. Click the install buttons above for an automated setup.

Add the following JSON block to your User Settings (JSON) file in VS Code. You can do this by pressing `Ctrl + Shift + P` and typing `Preferences: Open User Settings (JSON)`.

```json
{
  "mcp": {
    "inputs": [
      {
        "type": "promptString",
        "id": "public_key",
        "description": "Langfuse Public Key",
        "password": true
      },
      {
        "type": "promptString",
        "id": "secret_key",
        "description": "Langfuse Secret Key",
        "password": true
      }
    ],
    "servers": {
      "langfuse": {
        "command": "node",
        "args": ["build/index.js"],
        "env": {
          "LANGFUSE_PUBLIC_KEY": "${input:public_key}",
          "LANGFUSE_SECRET_KEY": "${input:secret_key}",
          "LANGFUSE_BASEURL": "https://cloud.langfuse.com"
        }
      }
    }
  }
}
```

Optionally, you can add it to a file called `.vscode/mcp.json` in your workspace:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "public_key",
      "description": "Langfuse Public Key",
      "password": true
    },
    {
      "type": "promptString",
      "id": "secret_key",
      "description": "Langfuse Secret Key",
      "password": true
    }
  ],
  "servers": {
    "langfuse": {
      "command": "node",
      "args": ["build/index.js"],
      "env": {
        "LANGFUSE_PUBLIC_KEY": "${input:public_key}",
        "LANGFUSE_SECRET_KEY": "${input:secret_key}",
        "LANGFUSE_BASEURL": "https://cloud.langfuse.com"
        }
      }
    }
  }
}
```

## Limitations

The MCP Server is a work in progress and has some limitations:

- Only prompts with a `production` label in Langfuse are returned
- All arguments are assumed to be optional and do not include descriptions as variables do not have specification in Langfuse
- List operations require fetching each prompt individually in the background to extract the arguments, this works but is not efficient

Contributions are welcome! Please open an issue or a PR ([repo](https://github.com/langfuse/mcp-server-langfuse)) if you have any suggestions or feedback.
