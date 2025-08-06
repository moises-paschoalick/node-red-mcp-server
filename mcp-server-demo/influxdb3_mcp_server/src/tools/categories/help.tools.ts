/**
 * Help and Documentation Tools
 */

import { z } from "zod";
import { InfluxDBMasterService } from "../../services/influxdb-master.service.js";
import { McpTool } from "../index.js";

export function createHelpTools(
  influxService: InfluxDBMasterService,
): McpTool[] {
  return [
    {
      name: "get_help",
      description:
        "Get help and troubleshooting guidance for InfluxDB operations. Supports specific categories or keyword search.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      zodSchema: z.object({}),
      handler: async (_args) => {
        try {
          const helpContent = influxService.help.getHelp();
          return {
            content: [
              {
                type: "text",
                text: helpContent,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error getting help: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      },
    },
  ];
}
