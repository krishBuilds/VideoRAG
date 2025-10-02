import { app, BrowserWindow } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { join } from 'node:path';
import { ipcMain } from 'electron';
import { createMainWindow } from './handlers/window'
import { setupVideoRAGHandlers, stopVideoRAGService } from './handlers/videorag-handlers';
import { registerFileHandlers } from './handlers/file-handlers';
import { registerSettingsHandlers } from './handlers/settings';
import { registerChatSessionHandlers } from './handlers/chat-session-handlers';
import { registerRemoteBackendHandlers } from './handlers/remote-backend-handlers';


// Create window when app is ready
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.videorag.app');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Register all IPC handlers
  registerFileHandlers();
  registerSettingsHandlers();
  registerChatSessionHandlers();
  setupVideoRAGHandlers();
  registerRemoteBackendHandlers(); // For RunPod communication
  registerModelHandlers();

  // VideoRAG API service is now started manually via UI button
  // Users can start it after configuring their environment
  console.log('VideoRAG API service will be started manually via UI');

  createMainWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// Quit app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Clean up VideoRAG service when app quits
app.on('before-quit', () => {
  stopVideoRAGService();
});

/**
 * Register model-related IPC handlers
 * Note: This is a simplified version. Full model download functionality 
 * has been moved to a separate module for better maintainability.
 */
function registerModelHandlers(): void {
  // Check model files
  ipcMain.handle('check-model-files', async (_, storeDirectory: string) => {
    try {
      const { access } = require('fs/promises');

      const internvideo2Path = join(storeDirectory, 'checkpoints', 'InternVideo2_1B_S2.pth');

      let internvideo2 = false;

      try {
        await access(internvideo2Path);
        internvideo2 = true;
      } catch {}

      return { internvideo2 };
    } catch (error) {
      return { internvideo2: false };
    }
  });

  // Download InternVideo2 model
  ipcMain.handle('download-internvideo2', async (event, storeDirectory: string) => {
    try {
      const https = require('https');
      const { createWriteStream, mkdirSync, existsSync } = require('fs');
      const { access } = require('fs/promises');

      // Create directory if it doesn't exist
      if (!existsSync(storeDirectory)) {
        mkdirSync(storeDirectory, { recursive: true });
      }

      // Create checkpoints directory
      const checkpointsDir = join(storeDirectory, 'checkpoints');
      if (!existsSync(checkpointsDir)) {
        mkdirSync(checkpointsDir, { recursive: true });
      }

      const internvideo2Path = join(checkpointsDir, 'InternVideo2_1B_S2.pth');

      // Check if file already exists
      try {
        await access(internvideo2Path);
        return { success: true, message: 'InternVideo2 model already exists' };
      } catch {
        // File doesn't exist, proceed with download
      }

      const url = 'https://huggingface.co/OpenGVLab/InternVideo2_1B_Sty/resolve/main/InternVideo2_1B_S2.pth';
    
    return new Promise((resolve) => {
        const file = createWriteStream(internvideo2Path);
        let downloadedBytes = 0;
        let totalBytes = 0;

        const request = https.get(url, (response) => {
          if (response.statusCode !== 200) {
            // Delete the entire checkpoints directory on HTTP error
            const { rmSync } = require('fs');
            try {
              rmSync(checkpointsDir, { recursive: true, force: true });
            } catch (cleanupError) {
              console.error('Failed to cleanup checkpoints directory:', cleanupError);
            }
            resolve({ success: false, error: `HTTP ${response.statusCode}: ${response.statusMessage}` });
            return;
          }

          totalBytes = parseInt(response.headers['content-length'] || '0', 10);

          response.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0) {
              const progress = Math.round((downloadedBytes / totalBytes) * 100);
              event.sender.send('download-progress', {
                type: 'internvideo2',
                progress,
                downloaded: downloadedBytes,
                total: totalBytes
              });
            }
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve({ success: true, message: 'InternVideo2 download completed' });
          });

          file.on('error', (err) => {
            file.close();
            // Delete the entire checkpoints directory on error
            const { rmSync } = require('fs');
            try {
              rmSync(checkpointsDir, { recursive: true, force: true });
            } catch (cleanupError) {
              console.error('Failed to cleanup checkpoints directory:', cleanupError);
            }
            resolve({ success: false, error: err.message });
          });
        });

        request.on('error', (err) => {
          // Delete the entire checkpoints directory on error
          const { rmSync } = require('fs');
          try {
            rmSync(checkpointsDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.error('Failed to cleanup checkpoints directory:', cleanupError);
          }
          resolve({ success: false, error: err.message });
        });

        request.setTimeout(300000, () => { // 5 minute timeout
          request.destroy();
          // Delete the entire checkpoints directory on timeout
          const { rmSync } = require('fs');
          try {
            rmSync(checkpointsDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.error('Failed to cleanup checkpoints directory:', cleanupError);
          }
          resolve({ success: false, error: 'Download timeout' });
        });
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  });
}
