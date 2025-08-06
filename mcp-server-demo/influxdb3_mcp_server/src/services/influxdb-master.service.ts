/**
 * Master InfluxDB Service
 *
 * Orchestrates all specialized InfluxDB services and provides a unified interface
 */

import {
  BaseConnectionService,
  ConnectionInfo,
} from "./base-connection.service.js";
import { QueryService } from "./query.service.js";
import { WriteService } from "./write.service.js";
import { DatabaseManagementService } from "./database-management.service.js";
import { TokenManagementService } from "./token-management.service.js";
import { CloudTokenManagementService } from "./cloud-token-management.service.js";
import { HelpService } from "./help.service.js";
import { McpServerConfig } from "../config.js";

export class InfluxDBMasterService {
  private baseConnection: BaseConnectionService;
  private queryService: QueryService;
  private writeService: WriteService;
  private databaseService: DatabaseManagementService;
  private tokenService: TokenManagementService;
  private cloudTokenService: CloudTokenManagementService;
  private helpService: HelpService;

  constructor(config: McpServerConfig) {
    this.baseConnection = new BaseConnectionService(config);
    this.queryService = new QueryService(this.baseConnection);
    this.writeService = new WriteService(this.baseConnection);
    this.databaseService = new DatabaseManagementService(this.baseConnection);
    this.tokenService = new TokenManagementService(this.baseConnection);
    this.cloudTokenService = new CloudTokenManagementService(
      this.baseConnection,
    );
    this.helpService = new HelpService();
  }

  // ===== Connection & Health Methods =====

  /**
   * Get connection information
   */
  getConnectionInfo(): ConnectionInfo {
    return this.baseConnection.getConnectionInfo();
  }

  /**
   * Ping InfluxDB instance and return version/type info
   */
  async ping(): Promise<{
    ok: boolean;
    version?: string;
    build?: string;
    message?: string;
  }> {
    return this.baseConnection.ping();
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{ status: string; checks?: any[] }> {
    return this.baseConnection.getHealthStatus();
  }

  // ===== Query Service Access =====

  get query() {
    return this.queryService;
  }

  // ===== Write Service Access =====

  get write() {
    return this.writeService;
  }

  // ===== Database Management Service Access =====

  get database() {
    return this.databaseService;
  }

  // ===== Token Management Service Access =====

  get token() {
    return this.tokenService;
  }

  /**
   * Get the token management service instance
   */
  getTokenManagementService() {
    return this.tokenService;
  }

  // ===== Cloud Token Management Service Access =====

  get cloudToken() {
    return this.cloudTokenService;
  }

  /**
   * Get the cloud token management service instance
   */
  getCloudTokenManagementService() {
    return this.cloudTokenService;
  }

  // ===== Help Service Access =====

  get help() {
    return this.helpService;
  }

  /**
   * Get the main client instance (for advanced operations)
   */
  getClient() {
    return this.baseConnection.getClient();
  }
}
