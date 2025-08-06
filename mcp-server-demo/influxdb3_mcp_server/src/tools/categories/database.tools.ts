/**
 * Database Management Tools
 */

import { z } from "zod";
import { InfluxDBMasterService } from "../../services/influxdb-master.service.js";
import { McpTool } from "../index.js";

export function createDatabaseTools(
  influxService: InfluxDBMasterService,
): McpTool[] {
  return [
    {
      name: "create_database",
      description:
        "Create a new database in InfluxDB. Database names must follow InfluxDB naming rules: alphanumeric characters, dashes (-), underscores (_), and forward slashes (/) are allowed. Must start with a letter or number. Maximum 64 characters. For Cloud Dedicated, optional configuration parameters can be specified.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Name of the database to create (alphanumeric, -, _, / allowed; max 64 chars; must start with letter/number)",
            pattern: "^[a-zA-Z0-9][a-zA-Z0-9\\-_/]*$",
            maxLength: 64,
          },
          maxTables: {
            type: "number",
            description:
              "Maximum number of tables (Cloud Dedicated only, default: 500)",
            minimum: 1,
          },
          maxColumnsPerTable: {
            type: "number",
            description:
              "Maximum columns per table (Cloud Dedicated only, default: 200)",
            minimum: 1,
          },
          retentionPeriod: {
            type: "number",
            description:
              "Retention period in nanoseconds (Cloud Dedicated only, default: 0 = no expiration)",
            minimum: 0,
          },
        },
        required: ["name"],
        additionalProperties: false,
      },
      zodSchema: z.object({
        name: z
          .string()
          .min(1, "Database name cannot be empty")
          .max(64, "Database name cannot exceed 64 characters")
          .regex(
            /^[a-zA-Z0-9]/,
            "Database name must start with a letter or number",
          )
          .regex(
            /^[a-zA-Z0-9\-_/]+$/,
            "Database name can only contain alphanumeric characters, dashes (-), underscores (_), and forward slashes (/)",
          )
          .describe("Name of the database to create"),
        maxTables: z
          .number()
          .min(1)
          .optional()
          .describe("Maximum number of tables (Cloud Dedicated only)"),
        maxColumnsPerTable: z
          .number()
          .min(1)
          .optional()
          .describe("Maximum columns per table (Cloud Dedicated only)"),
        retentionPeriod: z
          .number()
          .min(0)
          .optional()
          .describe("Retention period in nanoseconds (Cloud Dedicated only)"),
      }),
      handler: async (args) => {
        try {
          const config =
            args.maxTables !== undefined ||
            args.maxColumnsPerTable !== undefined ||
            args.retentionPeriod !== undefined
              ? {
                  name: args.name,
                  ...(args.maxTables !== undefined && {
                    maxTables: args.maxTables,
                  }),
                  ...(args.maxColumnsPerTable !== undefined && {
                    maxColumnsPerTable: args.maxColumnsPerTable,
                  }),
                  ...(args.retentionPeriod !== undefined && {
                    retentionPeriod: args.retentionPeriod,
                  }),
                }
              : undefined;

          await influxService.database.createDatabase(args.name, config);

          return {
            content: [
              {
                type: "text",
                text: `Database '${args.name}' created successfully`,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      },
    },

    {
      name: "update_database",
      description:
        "Update database configuration for InfluxDB Cloud Dedicated clusters only. Allows modification of maxTables, maxColumnsPerTable, and retentionPeriod settings. Not available for Core/Enterprise installations.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name of the database to update",
          },
          maxTables: {
            type: "number",
            description: "Maximum number of tables (optional)",
            minimum: 1,
          },
          maxColumnsPerTable: {
            type: "number",
            description: "Maximum columns per table (optional)",
            minimum: 1,
          },
          retentionPeriod: {
            type: "number",
            description: "Retention period in nanoseconds (optional)",
            minimum: 0,
          },
        },
        required: ["name"],
        additionalProperties: false,
      },
      zodSchema: z.object({
        name: z.string().describe("Name of the database to update"),
        maxTables: z
          .number()
          .min(1)
          .optional()
          .describe("Maximum number of tables"),
        maxColumnsPerTable: z
          .number()
          .min(1)
          .optional()
          .describe("Maximum columns per table"),
        retentionPeriod: z
          .number()
          .min(0)
          .optional()
          .describe("Retention period in nanoseconds"),
      }),
      handler: async (args) => {
        try {
          const config: any = {};
          if (args.maxTables !== undefined) config.maxTables = args.maxTables;
          if (args.maxColumnsPerTable !== undefined)
            config.maxColumnsPerTable = args.maxColumnsPerTable;
          if (args.retentionPeriod !== undefined)
            config.retentionPeriod = args.retentionPeriod;

          if (Object.keys(config).length === 0) {
            throw new Error(
              "At least one configuration parameter must be provided",
            );
          }

          await influxService.database.updateDatabase(args.name, config);

          const updatedFields = Object.keys(config)
            .map((key) => `${key}: ${config[key]}`)
            .join(", ");

          return {
            content: [
              {
                type: "text",
                text: `Database '${args.name}' updated successfully with: ${updatedFields}`,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      },
    },

    {
      name: "delete_database",
      description:
        "Delete a database from InfluxDB. Use the exact database name as returned by the list_databases tool.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Name of the database to delete (use exact name from database list)",
          },
        },
        required: ["name"],
        additionalProperties: false,
      },
      zodSchema: z.object({
        name: z.string().describe("Name of the database to delete"),
      }),
      handler: async (args) => {
        try {
          await influxService.database.deleteDatabase(args.name);

          return {
            content: [
              {
                type: "text",
                text: `Database '${args.name}' deleted successfully`,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      },
    },

    {
      name: "list_databases",
      description:
        "List all databases in the InfluxDB instance (all versions). Returns database names, count, and status information.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      zodSchema: z.object({}),
      handler: async () => {
        try {
          const databases = await influxService.database.listDatabases();

          const databaseList = databases.map((db) => db.name).join(", ");
          const count = databases.length;

          return {
            content: [
              {
                type: "text",
                text: `Found ${count} database${count !== 1 ? "s" : ""} in InfluxDB instance:\n${databaseList || "None"}\n\nDatabase details:\n${JSON.stringify(databases, null, 2)}`,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error listing databases: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      },
    },
  ];
}
