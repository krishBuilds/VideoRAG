import { BackendConfig } from '../components/BackendConfig';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  fileId?: string;
  job_id?: string;
  message?: string;
  error?: string;
}

export class RemoteVideoService {
  private baseUrl: string;
  private apiKey?: string;

  constructor() {
    // Load config from localStorage
    const savedConfig = localStorage.getItem('videorag-backend-config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      this.baseUrl = config.url || 'http://localhost:8000';
      this.apiKey = config.apiKey;
    } else {
      this.baseUrl = 'http://localhost:8000';
    }
  }

  async uploadVideo(
    file: File,
    config?: any,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      const formData = new FormData();
      formData.append('video', file);

      // Add configuration with 1 FPS processing
      const uploadConfig = {
        ...config,
        target_fps: 1, // Ensure 1 FPS processing
        detect_scenes: config?.detect_scenes !== false,
        scene_threshold: config?.scene_threshold || 0.2,
        min_duration: config?.min_duration || 5.0,
        max_duration: config?.max_duration || 12.0
      };

      formData.append('config', JSON.stringify(uploadConfig));

      const xhr = new XMLHttpRequest();

      // Create a Promise to handle the upload
      return new Promise((resolve) => {
        // Track upload progress
        if (onProgress) {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress: UploadProgress = {
                loaded: event.loaded,
                total: event.total,
                percentage: Math.round((event.loaded / event.total) * 100)
              };
              onProgress(progress);
            }
          });
        }

        // Handle completion
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve({
                success: true,
                fileId: response.file_id,
                job_id: response.job_id,
                message: response.message
              });
            } catch (error) {
              resolve({
                success: false,
                error: 'Invalid response from server'
              });
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              resolve({
                success: false,
                error: errorResponse.error || `Upload failed with status ${xhr.status}`
              });
            } catch {
              resolve({
                success: false,
                error: `Upload failed with status ${xhr.status}`
              });
            }
          }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
          resolve({
            success: false,
            error: 'Network error during upload'
          });
        });

        // Set up and send request
        xhr.open('POST', `${this.baseUrl}/api/upload/video`);

        // Add headers
        if (this.apiKey) {
          xhr.setRequestHeader('Authorization', `Bearer ${this.apiKey}`);
        }

        xhr.send(formData);
      });

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/jobs/${jobId}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get job status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get job status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processVideo(
    jobId: string,
    config: {
      detect_scenes?: boolean;
      scene_threshold?: number;
      min_duration?: number;
      max_duration?: number;
      generate_embeddings?: boolean;
      [key: string]: any;
    }
  ): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/jobs/${jobId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error(`Failed to start processing: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to start processing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// Singleton instance
export const remoteVideoService = new RemoteVideoService();