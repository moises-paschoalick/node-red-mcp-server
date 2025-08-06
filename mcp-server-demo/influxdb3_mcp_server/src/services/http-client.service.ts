/**
 * HTTP Client Service
 *
 * Simple axios-based HTTP client for making authenticated requests to InfluxDB API
 */

import axios, { AxiosInstance } from "axios";

export class HttpClientService {
  private axiosInstance: AxiosInstance;

  constructor(baseURL?: string, token?: string) {
    this.axiosInstance = axios.create({
      baseURL: baseURL?.replace(/\/$/, ""),
      timeout: 30000,
      headers: this.createAuthHeaders(token),
    });

    this.axiosInstance.interceptors.response.use(
      (response: any) => {
        return response;
      },
      (error: any) => {
        return Promise.reject(error);
      },
    );
  }

  /**
   * Create authentication headers with bearer token
   */
  private createAuthHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (token?.trim()) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Make a GET request
   */
  async get<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.axiosInstance.get(url, config);
    return response.data;
  }

  /**
   * Make a POST request
   */
  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.axiosInstance.post(url, data, config);
    return response.data;
  }

  /**
   * Make a PUT request
   */
  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.axiosInstance.put(url, data, config);
    return response.data;
  }

  /**
   * Make a DELETE request
   */
  async delete<T = any>(url: string, config?: any): Promise<T> {
    const deleteConfig = {
      ...config,
      headers: {
        ...config?.headers,
        Connection: "close",
      },
    };
    try {
      const response = await this.axiosInstance.delete(url, deleteConfig);
      return response.data;
    } catch (error: any) {
      if (error.message?.includes("aborted")) {
        return {} as T;
      }
      throw error;
    }
  }

  /**
   * Make a PATCH request
   */
  async patch<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.axiosInstance.patch(url, data, config);
    return response.data;
  }

  /**
   * Get the underlying axios instance for advanced usage
   */
  getAxiosInstance(): any {
    return this.axiosInstance;
  }

  /**
   * Create a configured instance for InfluxDB API calls
   */
  static createInfluxClient(baseUrl: string, token: string): HttpClientService {
    return new HttpClientService(baseUrl, token);
  }
}
