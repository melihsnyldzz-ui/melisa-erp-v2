export interface SessionOptions { token?: string; }
export interface SearchOptions extends SessionOptions { q?: string; limit?: number; }
export interface DownloadProgress { downloaded: number; page: number; totalPages: number; totalRows: number; }
export interface DownloadOptions extends SessionOptions {
  pageSize?: number;
  maxPages?: number;
  onProgress?: (progress: DownloadProgress) => void;
}
