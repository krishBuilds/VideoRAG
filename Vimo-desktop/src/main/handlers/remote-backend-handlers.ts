import { ipcMain } from 'electron';
import { remoteVideoService } from '../../renderer/src/services/RemoteVideoService';

// Register IPC handlers for remote backend (RunPod) communication
export function registerRemoteBackendHandlers() {
  console.log('🌐 Registering remote backend handlers for RunPod...');

  // Upload video to remote backend
  ipcMain.handle('remote-backend:upload-video', async (_, { file, config, onProgress }) => {
    try {
      console.log('📤 Uploading video to remote backend:', file.name);

      // Note: File cannot be directly passed through IPC, need to handle differently
      // This handler expects the frontend to use RemoteVideoService directly
      // We'll provide the base URL and let frontend handle the upload
      return {
        success: false,
        error: 'Frontend should use RemoteVideoService directly. IPC cannot handle File objects.'
      };
    } catch (error) {
      console.error('❌ Remote upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Get job status from remote backend
  ipcMain.handle('remote-backend:get-job-status', async (_, jobId: string) => {
    try {
      const service = new (await import('../../renderer/src/services/RemoteVideoService')).RemoteVideoService();
      const status = await service.getJobStatus(jobId);
      return {
        success: true,
        data: status
      };
    } catch (error) {
      console.error('❌ Get job status error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Process video on remote backend
  ipcMain.handle('remote-backend:process-video', async (_, { jobId, config }) => {
    try {
      const service = new (await import('../../renderer/src/services/RemoteVideoService')).RemoteVideoService();

      // Add 1 FPS processing configuration
      const processConfig = {
        ...config,
        target_fps: 1, // Force 1 FPS processing
        detect_scenes: config.detect_scenes !== false,
        scene_threshold: config.scene_threshold || 0.2,
        min_duration: config.min_duration || 5.0,
        max_duration: config.max_duration || 12.0,
        generate_embeddings: config.generate_embeddings !== false
      };

      const result = await service.processVideo(jobId, processConfig);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('❌ Process video error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Check remote backend health
  ipcMain.handle('remote-backend:check-health', async () => {
    try {
      const service = new (await import('../../renderer/src/services/RemoteVideoService')).RemoteVideoService();
      const isHealthy = await service.checkHealth();
      return {
        success: true,
        data: isHealthy
      };
    } catch (error) {
      console.error('❌ Health check error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Get remote backend base URL
  ipcMain.handle('remote-backend:get-base-url', async () => {
    try {
      const service = new (await import('../../renderer/src/services/RemoteVideoService')).RemoteVideoService();
      const baseUrl = service.getBaseUrl();
      return {
        success: true,
        data: baseUrl
      };
    } catch (error) {
      console.error('❌ Get base URL error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  console.log('✅ Remote backend handlers registered');
}