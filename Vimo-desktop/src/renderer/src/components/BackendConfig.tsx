import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { AlertCircle, CheckCircle, Server } from 'lucide-react';

interface BackendConfig {
  url: string;
  apiKey?: string;
}

export function BackendConfig() {
  const [config, setConfig] = useState<BackendConfig>({ url: 'http://localhost:8000' });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Load saved config
    const savedConfig = localStorage.getItem('videorag-backend-config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
      setIsSaved(true);
    }
  }, []);

  const saveConfig = () => {
    localStorage.setItem('videorag-backend-config', JSON.stringify(config));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`${config.url}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          message: `Connected successfully! Backend version: ${data.version || 'Unknown'}`
        });
      } else {
        setTestResult({
          success: false,
          message: `Connection failed: ${response.status} ${response.statusText}`
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="w-5 h-5" />
          Backend Configuration
        </CardTitle>
        <CardDescription>
          Configure the remote backend URL (RunPod server)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="backend-url">Backend URL</Label>
          <Input
            id="backend-url"
            placeholder="http://your-runpod-url:8000"
            value={config.url}
            onChange={(e) => setConfig({ ...config, url: e.target.value })}
          />
          <p className="text-sm text-muted-foreground">
            Enter the URL of your RunPod backend server (e.g., http://123.45.67.89:8000)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="api-key">API Key (Optional)</Label>
          <Input
            id="api-key"
            type="password"
            placeholder="Your API key for authentication"
            value={config.apiKey || ''}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          />
          <p className="text-sm text-muted-foreground">
            Required if your backend requires authentication
          </p>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {testResult.success ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="text-sm">{testResult.message}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={testConnection}
            disabled={isTesting || !config.url}
            variant="outline"
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button
            onClick={saveConfig}
            disabled={!config.url}
          >
            {isSaved ? 'Saved!' : 'Save Configuration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}