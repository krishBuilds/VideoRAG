import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { AlertCircle, CheckCircle, Upload, Video, Settings, Play } from 'lucide-react';
import { remoteVideoService, UploadProgress, UploadResult } from '../services/RemoteVideoService';
import { BackendConfig } from './BackendConfig';

interface VideoUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
  onProcessComplete?: (result: any) => void;
}

interface ProcessingConfig {
  detect_scenes: boolean;
  scene_threshold: number;
  min_duration: number;
  max_duration: number;
  target_fps: number;
  generate_embeddings: boolean;
}

export function VideoUpload({ onUploadComplete, onProcessComplete }: VideoUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<ProcessingConfig>({
    detect_scenes: true,
    scene_threshold: 0.2,
    min_duration: 5.0,
    max_duration: 12.0,
    target_fps: 1, // Always 1 FPS
    generate_embeddings: true
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setUploadResult(null);
      setJobStatus(null);
    } else {
      alert('Please select a valid video file');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(null);
    setUploadResult(null);

    try {
      const result = await remoteVideoService.uploadVideo(
        selectedFile,
        config,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      setUploadResult(result);
      onUploadComplete?.(result);

      if (result.success && result.job_id) {
        // Auto-start processing after upload
        await handleProcess(result.job_id);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadResult({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleProcess = async (jobId: string) => {
    setIsProcessing(true);
    try {
      const result = await remoteVideoService.processVideo(jobId, config);
      if (result.success) {
        // Poll for job status
        pollJobStatus(jobId);
      }
    } catch (error) {
      console.error('Process error:', error);
      setIsProcessing(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await remoteVideoService.getJobStatus(jobId);
        setJobStatus(status);

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(pollInterval);
          setIsProcessing(false);
          onProcessComplete?.(status);
        }
      } catch (error) {
        console.error('Status poll error:', error);
        clearInterval(pollInterval);
        setIsProcessing(false);
      }
    }, 2000);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Backend Configuration */}
      <BackendConfig />

      {/* Video Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Video Upload to RunPod
          </CardTitle>
          <CardDescription>
            Upload video files to your RunPod backend for processing at 1 FPS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Selection */}
          <div className="space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full"
              disabled={isUploading || isProcessing}
            >
              <Upload className="w-4 h-4 mr-2" />
              Select Video File
            </Button>
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{selectedFile.name}</span>
                <Badge variant="secondary">
                  {formatFileSize(selectedFile.size)}
                </Badge>
              </div>
              <div className="text-sm text-gray-600">
                Type: {selectedFile.type}
              </div>
            </div>
          )}

          {/* Configuration Toggle */}
          <Button
            variant="ghost"
            onClick={() => setShowConfig(!showConfig)}
            className="w-full"
          >
            <Settings className="w-4 h-4 mr-2" />
            Processing Configuration
          </Button>

          {/* Configuration Panel */}
          {showConfig && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Scene Detection</label>
                  <select
                    value={config.detect_scenes.toString()}
                    onChange={(e) => setConfig({
                      ...config,
                      detect_scenes: e.target.value === 'true'
                    })}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Scene Threshold</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={config.scene_threshold}
                    onChange={(e) => setConfig({
                      ...config,
                      scene_threshold: parseFloat(e.target.value)
                    })}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Min Duration (sec)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="60"
                    value={config.min_duration}
                    onChange={(e) => setConfig({
                      ...config,
                      min_duration: parseFloat(e.target.value)
                    })}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Max Duration (sec)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="60"
                    value={config.max_duration}
                    onChange={(e) => setConfig({
                      ...config,
                      max_duration: parseFloat(e.target.value)
                    })}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Target FPS: {config.target_fps} (fixed for optimized processing)
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploadProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress.percentage}%</span>
              </div>
              <Progress value={uploadProgress.percentage} />
              <div className="text-xs text-gray-600">
                {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}
              </div>
            </div>
          )}

          {/* Upload Result */}
          {uploadResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              uploadResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {uploadResult.success ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <div>
                <p className="font-medium">
                  {uploadResult.success ? 'Upload Complete' : 'Upload Failed'}
                </p>
                {uploadResult.success && (
                  <p className="text-sm">Job ID: {uploadResult.job_id}</p>
                )}
                {uploadResult.error && (
                  <p className="text-sm">{uploadResult.error}</p>
                )}
              </div>
            </div>
          )}

          {/* Processing Status */}
          {isProcessing && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <Play className="w-4 h-4 animate-pulse" />
                <span>Processing video...</span>
              </div>
            </div>
          )}

          {/* Job Status */}
          {jobStatus && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Job Status</h4>
              <div className="space-y-2 text-sm">
                <div>Status: <Badge variant="outline">{jobStatus.status}</Badge></div>
                {jobStatus.progress !== undefined && (
                  <Progress value={jobStatus.progress * 100} />
                )}
                {jobStatus.message && (
                  <div>{jobStatus.message}</div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {selectedFile && !isUploading && !uploadResult?.success && (
            <Button
              onClick={handleUpload}
              className="w-full"
              disabled={!selectedFile}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload and Process
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}