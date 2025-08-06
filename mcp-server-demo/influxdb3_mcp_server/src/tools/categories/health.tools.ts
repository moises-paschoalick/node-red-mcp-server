/**
 * Health and Monitoring Tools
 */

import { z } from "zod";
import { InfluxDBMasterService } from "../../services/influxdb-master.service.js";
import { McpTool } from "../index.js";

export function createHealthTools(
  influxService: InfluxDBMasterService,
): McpTool[] {
  return [
    {
      name: "health_check",
      description:
        "Check current connection status to the InfluxDB instance. Returns connection status, configuration, and available endpoint results. Health assessment is flexible - if any check passes (client initialization, /health endpoint, or /ping), the instance is considered healthy. Available checks depend on the InfluxDB product type and token configuration.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      zodSchema: z.object({}),
      handler: async () => {
        try {
          const connectionInfo = influxService.getConnectionInfo();
          const influxType =
            influxService["baseConnection"]?.["config"]?.influx?.type ||
            "unknown";

          let healthStatus = null;
          let pingResult = null;
          let hasAnySuccess = false;

          try {
            healthStatus = await influxService.getHealthStatus();
            if (healthStatus.status === "pass") hasAnySuccess = true;
          } catch (_error: any) {}

          try {
            pingResult = await influxService.ping();
            if (pingResult.ok === true) hasAnySuccess = true;
          } catch (_error: any) {}

          if (connectionInfo.isDataClientInitialized) hasAnySuccess = true;

          const healthInfo = {
            timestamp: new Date().toISOString(),
            connection: {
              status: hasAnySuccess ? "healthy" : "failed",
              url: connectionInfo.url,
              hasToken: connectionInfo.hasToken,
              database: connectionInfo.database,
              type: influxType,
            },
            health: healthStatus,
            ping: pingResult,
          };

          const statusText = hasAnySuccess ? "✅ HEALTHY" : "❌ FAILED";
          const detailsText = JSON.stringify(healthInfo, null, 2);

          return {
            content: [
              {
                type: "text",
                text: `InfluxDB Health Check: ${statusText}\n\nNote: Health assessment is based on available endpoints for your InfluxDB product type and token configuration. If any check passes, the instance is considered operational.\n\nConnection Details:\n${detailsText}`,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error during health check: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      },
    },
  ];
}
