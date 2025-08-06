/**
 * MCP Prompts Definitions
 *
 * Defines reusable prompt templates for InfluxDB operations
 */

import { InfluxDBMasterService } from "../services/influxdb-master.service.js";

export interface McpPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
  handler: (args?: Record<string, string>) => Promise<{
    description: string;
    messages: Array<{
      role: string;
      content: { type: string; text: string };
    }>;
  }>;
}

/**
 * Create simple MCP prompts for InfluxDB operations
 */
export function createPrompts(
  _influxService: InfluxDBMasterService,
): McpPrompt[] {
  return [
    {
      name: "list-databases",
      description: "Generate a prompt to list all available databases",
      handler: async () => {
        return {
          description: "List all available InfluxDB databases",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Please list all available databases in this InfluxDB instance. Use the list_databases tool to show me what databases are available.",
              },
            },
          ],
        };
      },
    },

    {
      name: "check-health",
      description: "Generate a prompt to check InfluxDB health status",
      handler: async () => {
        return {
          description: "Check InfluxDB server health and connection status",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Please check the health status of the InfluxDB server. Use the health_check tool to verify the connection and show me the server status.",
              },
            },
          ],
        };
      },
    },

    {
      name: "query-recent-data",
      description: "Generate a prompt to query recent data from a measurement",
      arguments: [
        {
          name: "database",
          description: "Database name to query",
          required: true,
        },
        {
          name: "measurement",
          description: "Measurement/table name to query",
          required: true,
        },
      ],
      handler: async (args) => {
        const database = args?.database || "mydb";
        const measurement = args?.measurement || "my_measurement";

        return {
          description: `Query recent data from ${measurement} in ${database}`,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Please query the most recent data from the "${measurement}" measurement in the "${database}" database. Use the execute_query tool to run: SELECT * FROM ${measurement} ORDER BY time DESC LIMIT 10`,
              },
            },
          ],
        };
      },
    },
  ];
}
