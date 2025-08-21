#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { google, drive_v3, sheets_v4 } from "googleapis";
import dotenv from "dotenv";
import { join } from "path";
import { getValidCredentials, setupTokenRefresh } from "./auth.js";

// Load environment variables from .env file.
dotenv.config({ path: join(process.cwd(), ".env") });

/**
 * Combined Google Drive/Sheets client.
 */
interface GoogleDriveClient {
  drive: drive_v3.Drive;
  sheets: sheets_v4.Sheets;
}

/**
 * A single response item.
 */
interface ResponseContentItem {
  type: string; // e.g. "text"
  text: string;
}

/**
 * Our internal tool response.
 */
interface InternalToolResponse {
  content: ResponseContentItem[];
  isError: boolean;
}

/**
 * Input for gdrive_search.
 */
interface GDriveSearchInput {
  query: string;
  pageToken?: string;
  pageSize?: number;
}

/**
 * Input for gdrive_read_file.
 */
interface GDriveReadFileInput {
  fileId: string;
}

/**
 * Input for gsheets_update_cell.
 */
interface GSheetsUpdateCellInput {
  fileId: string;
  range: string;
  value: string;
}

/**
 * Input for gsheets_read.
 */
interface GSheetsReadInput {
  spreadsheetId: string;
  ranges?: string[];
  sheetId?: number;
}

/**
 * MCP server for Google Drive/Sheets.
 */
class GoogleDriveMcpServer {
  private server: Server;
  private googleDriveClient: GoogleDriveClient | null = null;

  constructor() {
    // Initialize the MCP server with metadata.
    this.server = new Server(
      {
        name: "google-drive-mcp-server",
        version: "0.1.0",
        description: "A Google Drive and Google Sheets integration server.",
      },
      {
        capabilities: { tools: {} },
      }
    );

    console.error("Debug - Environment variables:", {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? "Set" : "Not set",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? "Set" : "Not set",
      GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN ? "Set" : "Not set",
    });

    this.setupToolHandlers();

    this.server.onerror = (error: Error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Register the request handlers.
   */
  private setupToolHandlers(): void {
    // List tools handler.
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "gdrive_search",
          description: "Search for files in Google Drive",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Name of the file to be searched for",
              },
              pageToken: {
                type: "string",
                description: "Token for the next page of results",
              },
              pageSize: {
                type: "number",
                description: "Number of results per page (max 100)",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "gdrive_read_file",
          description: "Read contents of a file from Google Drive",
          inputSchema: {
            type: "object",
            properties: {
              fileId: {
                type: "string",
                description: "ID of the file to read",
              },
            },
            required: ["fileId"],
          },
        },
        {
          name: "gsheets_update_cell",
          description: "Update a cell value in a Google Spreadsheet",
          inputSchema: {
            type: "object",
            properties: {
              fileId: {
                type: "string",
                description: "ID of the spreadsheet",
              },
              range: {
                type: "string",
                description: "Cell range in A1 notation (e.g. 'Sheet1!A1')",
              },
              value: {
                type: "string",
                description: "New cell value",
              },
            },
            required: ["fileId", "range", "value"],
          },
        },
        {
          name: "gsheets_read",
          description:
            "Read data from a Google Spreadsheet with flexible options for ranges and formatting",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet to read",
              },
              ranges: {
                type: "array",
                items: { type: "string" },
                description:
                  "Optional array of A1 notation ranges (e.g. ['Sheet1!A1:B10'])",
              },
              sheetId: {
                type: "number",
                description:
                  "Optional specific sheet ID. If not provided, reads first sheet.",
              },
            },
            required: ["spreadsheetId"],
          },
        },
      ],
    }));

    // Call tool handler.
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: CallToolRequest) => {
        if (!this.googleDriveClient) {
          throw new McpError(
            ErrorCode.InternalError,
            "Google Drive client not initialized."
          );
        }

        const toolName = request.params.name;
        const args = request.params.arguments;

        let result: InternalToolResponse;
        switch (toolName) {
          case "gdrive_search":
            result = await this.handleGdriveSearch(
              args as unknown as GDriveSearchInput
            );
            break;
          case "gdrive_read_file":
            result = await this.handleGdriveReadFile(
              args as unknown as GDriveReadFileInput
            );
            break;
          case "gsheets_update_cell":
            result = await this.handleGsheetsUpdateCell(
              args as unknown as GSheetsUpdateCellInput
            );
            break;
          case "gsheets_read":
            result = await this.handleGsheetsRead(
              args as unknown as GSheetsReadInput
            );
            break;
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${toolName}`
            );
        }
        // Cast to any so that the response satisfies the expected SDK type.
        return this.convertToolResponse(result) as any;
      }
    );
  }

  /**
   * Wraps the internal response with a required _meta field.
   */
  private convertToolResponse(
    response: InternalToolResponse
  ): { _meta: object; content: ResponseContentItem[]; isError: boolean } {
    return { _meta: {}, content: response.content, isError: response.isError };
  }

  /**
   * Initializes the Google Drive/Sheets client.
   */
  private async initializeGoogleDriveClient(): Promise<GoogleDriveClient | null> {
    try {
      const auth = await getValidCredentials();
      if (!auth) {
        console.error("Failed to obtain valid Google credentials.");
        return null;
      }
      const drive = google.drive({ version: "v3", auth });
      const sheets = google.sheets({ version: "v4", auth });
      return { drive, sheets };
    } catch (error) {
      console.error("Error initializing Google Drive client:", error);
      return null;
    }
  }

  /**
   * Handler for gdrive_search.
   */
  private async handleGdriveSearch(
    args: GDriveSearchInput
  ): Promise<InternalToolResponse> {
    const drive = this.googleDriveClient!.drive;
    const userQuery = (args.query || "").trim();
    let searchQuery = "";

    if (!userQuery) {
      searchQuery = "trashed = false";
    } else {
      const escapedQuery = userQuery.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const conditions: string[] = [];
      conditions.push(`name contains '${escapedQuery}'`);
      if (userQuery.toLowerCase().includes("sheet")) {
        conditions.push("mimeType = 'application/vnd.google-sheets.spreadsheet'");
      }
      searchQuery = `(${conditions.join(" or ")}) and trashed = false`;
    }

    try {
      const res = await drive.files.list({
        q: searchQuery,
        pageSize: args.pageSize || 10,
        pageToken: args.pageToken,
        orderBy: "modifiedTime desc",
        fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size)",
      });
      const files = res.data.files || [];
      let responseText = `Found ${files.length} files:\n`;
      responseText += files
        .map((file) => `Name: ${file.name}\nID: ${file.id}`)
        .join("\n---\n");

      if (res.data.nextPageToken) {
        responseText += `\n\nMore results available. Use pageToken: ${res.data.nextPageToken}`;
      }

      return { content: [{ type: "text", text: responseText }], isError: false };
    } catch (error: any) {
      return {
        content: [
          { type: "text", text: `Error searching Google Drive: ${error.message}` },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handler for gdrive_read_file.
   */
  private async handleGdriveReadFile(
    args: GDriveReadFileInput
  ): Promise<InternalToolResponse> {
    const drive = this.googleDriveClient!.drive;

    const readGoogleDriveFile = async (fileId: string) => {
      const file = await drive.files.get({
        fileId,
        fields: "mimeType,name",
      });

      if (file.data.mimeType?.startsWith("application/vnd.google-apps")) {
        let exportMimeType: string;
        switch (file.data.mimeType) {
          case "application/vnd.google-apps.document":
            exportMimeType = "text/markdown";
            break;
          case "application/vnd.google-apps.spreadsheet":
            exportMimeType = "text/csv";
            break;
          case "application/vnd.google-apps.presentation":
            exportMimeType = "text/plain";
            break;
          case "application/vnd.google-apps.drawing":
            exportMimeType = "image/png";
            break;
          default:
            exportMimeType = "text/plain";
        }

        const res = await drive.files.export(
          { fileId, mimeType: exportMimeType },
          { responseType: "text" }
        );

        return {
          name: file.data.name || fileId,
          mimeType: exportMimeType,
          text: res.data as string,
        };
      } else {
        const res = await drive.files.get(
          { fileId, alt: "media" },
          { responseType: "arraybuffer" }
        );
        const mimeType = file.data.mimeType || "application/octet-stream";
        const contentBuffer = Buffer.from(res.data as ArrayBuffer);
        const isText = mimeType.startsWith("text/") || mimeType === "application/json";

        return {
          name: file.data.name || fileId,
          mimeType,
          text: isText ? contentBuffer.toString("utf-8") : undefined,
          blob: isText ? undefined : contentBuffer.toString("base64"),
        };
      }
    };

    try {
      const fileInfo = await readGoogleDriveFile(args.fileId);
      return {
        content: [
          {
            type: "text",
            text: `Contents of ${fileInfo.name}:\n\n${fileInfo.text || fileInfo.blob}`,
          },
        ],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [
          { type: "text", text: `Error reading Google Drive file: ${error.message}` },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handler for gsheets_update_cell.
   */
  private async handleGsheetsUpdateCell(
    args: GSheetsUpdateCellInput
  ): Promise<InternalToolResponse> {
    const sheets = this.googleDriveClient!.sheets;
    const { fileId, range, value } = args;

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: fileId,
        range: range,
        valueInputOption: "RAW",
        requestBody: { values: [[value]] },
      });
      return {
        content: [
          { type: "text", text: `Updated cell ${range} to value: ${value}` },
        ],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [
          { type: "text", text: `Error updating Google Sheet cell: ${error.message}` },
        ],
        isError: true,
      };
    }
  }

  /**
   * Helper: Convert row and column to A1 notation.
   */
  private getA1Notation(row: number, col: number): string {
    let a1 = "";
    let c = col;
    while (c > 0) {
      c--;
      a1 = String.fromCharCode(65 + (c % 26)) + a1;
      c = Math.floor(c / 26);
    }
    return `${a1}${row + 1}`;
  }

  /**
   * Helper: Process raw Sheets data.
   */
  private async processSheetData(
    response: sheets_v4.Schema$BatchGetValuesResponse | sheets_v4.Schema$ValueRange
  ): Promise<any[]> {
    const results: any[] = [];
    // Narrow the union: if response has a "valueRanges" property, use it; otherwise, wrap response.
    const dataValueRanges =
      "valueRanges" in response && Array.isArray(response.valueRanges)
        ? response.valueRanges
        : [response];
    for (const range of dataValueRanges) {
      // Use type guard for properties.
      if (!("values" in range) || !("range" in range)) continue;
      const values = range.values || [];
      if (values.length === 0) continue;
      const rangeParts = (range.range || "").split("!");
      const sheetName = rangeParts[0]?.replace(/'/g, "") || "Sheet1";
      const processedValues = values.map((rowValues: any[], rowIndex: number) =>
        rowValues.map((cellValue: any, colIndex: number) => ({
          value: cellValue,
          location: `${sheetName}!${this.getA1Notation(rowIndex, colIndex + 1)}`,
        }))
      );
      const columnHeaders = processedValues[0];
      const dataOnly = processedValues.slice(1);
      results.push({
        sheetName,
        data: dataOnly,
        totalRows: values.length,
        totalColumns: columnHeaders.length,
        columnHeaders,
      });
    }
    return results;
  }

  /**
   * Handler for gsheets_read.
   */
  private async handleGsheetsRead(
    args: GSheetsReadInput
  ): Promise<InternalToolResponse> {
    const sheets = this.googleDriveClient!.sheets;
    try {
      let response: sheets_v4.Schema$BatchGetValuesResponse | sheets_v4.Schema$ValueRange;
      if (args.ranges) {
        const batchRes = await sheets.spreadsheets.values.batchGet({
          spreadsheetId: args.spreadsheetId,
          ranges: args.ranges,
        });
        response = batchRes.data;
      } else if (typeof args.sheetId !== "undefined") {
        const meta = await sheets.spreadsheets.get({
          spreadsheetId: args.spreadsheetId,
          fields: "sheets.properties",
        });
        const matchedSheet = meta.data.sheets?.find(
          (s) => s.properties?.sheetId === args.sheetId
        );
        if (!matchedSheet?.properties?.title) {
          throw new Error(`Sheet ID ${args.sheetId} not found`);
        }
        const singleRes = await sheets.spreadsheets.values.get({
          spreadsheetId: args.spreadsheetId,
          range: matchedSheet.properties.title,
        });
        response = singleRes.data;
      } else {
        const singleRes = await sheets.spreadsheets.values.get({
          spreadsheetId: args.spreadsheetId,
          range: "A:ZZ",
        });
        response = singleRes.data;
      }
      const processedData = await this.processSheetData(response);
      return {
        content: [
          { type: "text", text: JSON.stringify(processedData, null, 2) },
        ],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error reading spreadsheet: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Start the MCP server.
   */
  public async run(): Promise<void> {
    this.googleDriveClient = await this.initializeGoogleDriveClient();
    if (!this.googleDriveClient) {
      console.error("Failed to initialize Google Drive client. Exiting...");
      return;
    }
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Google Drive MCP server running on stdio");
    setupTokenRefresh();
  }
}

// Create and run the server.
const server = new GoogleDriveMcpServer();
server.run().catch(console.error);
