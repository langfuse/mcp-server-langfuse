/**
 * Observability tools for Langfuse MCP server.
 *
 * This module provides comprehensive tools for interacting with Langfuse's
 * observability features: traces, observations, scores, datasets, and sessions.
 */

export { registerTraceTools } from "./traces.js";
export { registerObservationTools } from "./observations.js";
export { registerScoreTools } from "./scores.js";
export { registerScoreConfigTools } from "./score-configs.js";
export { registerDatasetTools } from "./datasets.js";
export { registerSessionTools } from "./sessions.js";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Langfuse from "langfuse";
import { registerTraceTools } from "./traces.js";
import { registerObservationTools } from "./observations.js";
import { registerScoreTools } from "./scores.js";
import { registerScoreConfigTools } from "./score-configs.js";
import { registerDatasetTools } from "./datasets.js";
import { registerSessionTools } from "./sessions.js";

/**
 * Register all observability tools with the MCP server.
 *
 * This includes:
 * - 3 trace tools (list, get, delete)
 * - 2 observation tools (list, get)
 * - 4 score tools (create, list, get, delete)
 * - 3 score config tools (create, list, get)
 * - 10 dataset tools (create/list/get dataset, create/list/get/delete items, create run item, list/get runs)
 * - 2 session tools (list, get)
 *
 * Total: 24 observability tools
 */
export function registerAllObservabilityTools(server: McpServer, langfuse: Langfuse): void {
  registerTraceTools(server, langfuse);
  registerObservationTools(server, langfuse);
  registerScoreTools(server, langfuse);
  registerScoreConfigTools(server, langfuse);
  registerDatasetTools(server, langfuse);
  registerSessionTools(server, langfuse);
}
