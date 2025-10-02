import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  FolderOpen,
  Download,
  CheckCircle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Settings,
  Brain,
  Star,
  ExternalLink,
} from 'lucide-react';
import vimoLogo from '../assets/images/vimi-logo.png';

interface InitializationWizardProps {
  onComplete: () => void;
}

const InitializationWizard: React.FC<InitializationWizardProps> = ({ onComplete }) => {
  // Define steps configuration
  const steps = [
    { step: 1, icon: FolderOpen, label: 'Directory' },
    { step: 2, icon: Brain, label: 'API Keys' },
    { step: 3, icon: Star, label: 'Complete' }
  ];
  const totalSteps = steps.length;
  
  const [currentStep, setCurrentStep] = useState(1);
  const [storeDirectory, setStoreDirectory] = useState('');
  const [internvideo2Status, setInternvideo2Status] = useState<'pending' | 'downloading' | 'completed' | 'error'>('pending');
  const [downloadProgress, setDownloadProgress] = useState({ internvideo2: 0 });
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // API Key configuration status
  const [apiKeySettings, setApiKeySettings] = useState({
    runpodUrl: 'https://7z1u9gfm19hw4h-8088.proxy.runpod.net',
    runpodApiKey: '',
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiApiKey: '',
    processingModel: 'gpt-4o-mini',
    analysisModel: 'gpt-4o-mini',
    dashscopeApiKey: '',
    captionModel: 'qwen-vl-plus-latest',
    asrModel: 'paraformer-realtime-v2'
  });


  // Initialize component - check for existing settings and models
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        // Load existing settings
        const settingsResult = await window.api.loadSettings();
        
        if (settingsResult.success && settingsResult.settings?.storeDirectory) {
          const existingDirectory = settingsResult.settings.storeDirectory;
          setStoreDirectory(existingDirectory);
          
          // Check if models already exist in the stored directory
          await checkModelFiles(existingDirectory);
        }
      } catch (error) {
        console.error('Failed to initialize component:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeComponent();
  }, []);

  // Listen for download progress events
  useEffect(() => {
    const handleDownloadProgress = (_, data: { type: string, progress: number, downloaded?: number, total?: number }) => {
      console.log('Download progress:', data);
      if (data.type === 'internvideo2') {
        setDownloadProgress(prev => ({ ...prev, internvideo2: data.progress }));
      }
    };

    // Add event listeners
    window.api.onDownloadProgress(handleDownloadProgress);
    
    // Cleanup function
    return () => {
      window.api.removeDownloadListeners();
    };
  }, []);

  // Check if model files exist
  const checkModelFiles = async (directory?: string) => {
    const targetDirectory = directory || storeDirectory;
    if (!targetDirectory) return { internvideo2: false };

    try {
      const result = await window.api.checkModelFiles(targetDirectory);
      console.log('Model check result:', result);

      setInternvideo2Status(result.internvideo2 ? 'completed' : 'pending');

      // Update progress to 100% for completed models
      if (result.internvideo2) {
        setDownloadProgress(prev => ({ ...prev, internvideo2: 100 }));
      }

      return result;
    } catch (error) {
      console.error('Failed to check model files:', error);
      return { internvideo2: false };
    }
  };

  // Select storage directory
  const selectDirectory = async () => {
    try {
      const result = await window.api.selectFolder();
      if (result.success && result.path) {
        setStoreDirectory(result.path);
        // Check if model files already exist in this directory
        setTimeout(() => checkModelFiles(result.path), 500);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  };

  // Download InternVideo2 model
  const downloadInternVideo2 = async () => {
    if (!storeDirectory) return;

    setInternvideo2Status('downloading');
    setDownloadProgress(prev => ({ ...prev, internvideo2: 0 }));

    try {
      console.log('Starting InternVideo2 download...');
      const result = await window.api.downloadInternVideo2(storeDirectory);

      if (result.success) {
        setInternvideo2Status('completed');
        setDownloadProgress(prev => ({ ...prev, internvideo2: 100 }));
        console.log('InternVideo2 download completed successfully');
      } else {
        setInternvideo2Status('error');
        alert(`InternVideo2 download failed: ${result.error}`);
      }
    } catch (error) {
      setInternvideo2Status('error');
      console.error('InternVideo2 download failed:', error);
      alert(`InternVideo2 download error: ${error}`);
    }
  };

  // Check if can proceed to next step
  const canProceedToStep2 = storeDirectory !== '';
  // API keys are optional but recommended
  const canProceedToStep3 = true; // Skip model check since models are on RunPod

  // Handle step transitions with animation
  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  // Refresh model status
  const refreshModelsStatus = async () => {
    if (!storeDirectory || isRefreshing) return;

    setIsRefreshing(true);

    try {
      const result = await window.api.checkModelFiles(storeDirectory);
      console.log('Refresh check result:', result);

      setInternvideo2Status(result.internvideo2 ? 'completed' : 'pending');

      // Update progress for completed models
      if (result.internvideo2) {
        setDownloadProgress(prev => ({ ...prev, internvideo2: 100 }));
      } else {
        setDownloadProgress(prev => ({ ...prev, internvideo2: 0 }));
      }
    } catch (error) {
      console.error('Failed to refresh model status:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle API key changes
  const handleApiKeyChange = (field: string, value: string) => {
    setApiKeySettings(prev => ({
      ...prev,
      [field]: value
    }));
  };



  // Complete initialization
  const completeInitialization = async () => {
    // Save configuration including API keys
    const settings = {
      storeDirectory,
      internvideo2Installed: true,
      ...apiKeySettings, // Include API key settings
      initializedAt: new Date().toISOString()
    };

    await window.api.saveSettings(settings);

    // Save backend configuration to localStorage for RemoteVideoService
    const backendConfig = {
      url: apiKeySettings.runpodUrl,
      apiKey: apiKeySettings.runpodApiKey
    };
    localStorage.setItem('videorag-backend-config', JSON.stringify(backendConfig));

    // Trigger configuration update event, notify sidebar to reload sessions
    const event = new CustomEvent('storage-config-updated', {
      detail: { storeDirectory }
    });
    window.dispatchEvent(event);

    onComplete();
  };

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 z-50 overflow-auto">
        <div className="min-h-full flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Checking VideoRAG environment...</p>
          </div>
        </div>
      </div>
    );
  }

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Select Storage Location</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Choose a safe location to store your AI models and data files
        </p>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Data Storage Directory</h3>
            <p className="text-sm text-gray-600">AI models and Vimo cache data will be stored at this location</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Click browse to select directory..."
              value={storeDirectory}
              readOnly
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-purple-400 transition-colors"
            />
            <Button 
              onClick={selectDirectory} 
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg font-medium transition-all"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Select
            </Button>
          </div>

        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => goToStep(2)}
          disabled={!canProceedToStep2}
          className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-lg font-medium transition-all disabled:opacity-50"
        >
          Next
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  // Models are on RunPod - no need for model download step

  const renderApiKeySetup = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">API Key Configuration</h2>
        <p className="text-gray-600">
          Configure your API keys and backend endpoint for video analysis
        </p>
        <p className="text-sm text-gray-500 mt-2">
          All API keys are stored locally and never shared with third parties
        </p>
      </div>

      <div className="space-y-6">
        {/* RunPod Configuration */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-purple-900">RunPod Backend</h3>
              <p className="text-sm text-purple-700">Configure your RunPod endpoint for video processing</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                RunPod Endpoint URL
              </label>
              <input
                type="text"
                placeholder="https://xxx-8088.proxy.runpod.net"
                value={apiKeySettings.runpodUrl}
                onChange={(e) => handleApiKeyChange('runpodUrl', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">Your RunPod service endpoint URL</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                RunPod API Key (Optional)
              </label>
              <input
                type="password"
                placeholder="Enter API key if required"
                value={apiKeySettings.runpodApiKey}
                onChange={(e) => handleApiKeyChange('runpodApiKey', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">Required if your RunPod endpoint needs authentication</p>
            </div>
          </div>
        </div>

        {/* OpenAI Configuration */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-900">OpenAI Configuration</h3>
              <p className="text-sm text-blue-700">Language model services for intelligent analysis</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Base URL
              </label>
              <input
                type="text"
                placeholder="https://api.openai.com/v1"
                value={apiKeySettings.openaiBaseUrl}
                onChange={(e) => handleApiKeyChange('openaiBaseUrl', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                API Key
              </label>
              <input
                type="password"
                placeholder="sk-..."
                value={apiKeySettings.openaiApiKey}
                onChange={(e) => handleApiKeyChange('openaiApiKey', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Processing Model
                </label>
                <select
                  value={apiKeySettings.processingModel}
                  onChange={(e) => handleApiKeyChange('processingModel', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-5-mini">gpt-5-mini</option>
                  <option value="gpt-5">gpt-5</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Choose model for high-volume preprocessing</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Analysis Model
                </label>
                <select
                  value={apiKeySettings.analysisModel}
                  onChange={(e) => handleApiKeyChange('analysisModel', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-5-mini">gpt-5-mini</option>
                  <option value="gpt-5">gpt-5</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Choose model for detailed analysis tasks</p>
              </div>
            </div>
          </div>
        </div>

        {/* DashScope Configuration */}
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-6 border border-orange-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg flex items-center justify-center">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-orange-900">DashScope Configuration</h3>
                <p className="text-sm text-orange-700">Alibaba Cloud API for video captioning</p>
              </div>
            </div>
            <a
              href="https://www.alibabacloud.com/help/en/model-studio/get-api-key?spm=a2c63.p38356.0.i1"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ExternalLink size={14} />
              Get API Key Tutorial
            </a>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              DashScope API Key
            </label>
            <input
              type="password"
              placeholder="sk-..."
              value={apiKeySettings.dashscopeApiKey}
              onChange={(e) => handleApiKeyChange('dashscopeApiKey', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Caption Model
              </label>
              <input
                type="text"
                value="qwen-vl-plus-latest"
                readOnly
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-100 text-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Fixed model for video captioning tasks</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                ASR Model
              </label>
              <input
                type="text"
                value="paraformer-realtime-v2"
                readOnly
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-100 text-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Fixed model for speech recognition tasks</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <Button
          onClick={() => goToStep(1)}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Button
          onClick={() => goToStep(3)}
          disabled={!canProceedToStep3}
          className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-lg font-medium transition-all disabled:opacity-50"
        >
          Complete Setup
          <Sparkles className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderCelebration = () => (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4">
        <Sparkles className="w-10 h-10 text-white" />
      </div>
      
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">🎉 Setup Complete!</h2>
        <p className="text-lg text-gray-600 mb-4">
          Vimo is ready! You can now start using intelligent video analysis features
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <CheckCircle className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <div className="text-sm font-medium text-blue-800">Directory</div>
          <div className="text-xs text-blue-600">Storage Setup</div>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
          <div className="text-sm font-medium text-green-800">InternVideo2</div>
          <div className="text-xs text-green-600">AI Model</div>
        </div>
        <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
          <CheckCircle className="w-5 h-5 text-orange-600 mx-auto mb-1" />
          <div className="text-sm font-medium text-orange-800">API Keys</div>
          <div className="text-xs text-orange-600">Configuration</div>
        </div>
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
          <CheckCircle className="w-5 h-5 text-purple-600 mx-auto mb-1" />
          <div className="text-sm font-medium text-purple-800">Vimo</div>
          <div className="text-xs text-purple-600">Ready!</div>
        </div>
      </div>

      <Button 
        onClick={completeInitialization}
        className="px-8 py-3 text-lg font-bold bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-lg shadow-lg transition-all"
      >
        Start Using Vimo
        <ArrowRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 z-50 overflow-auto">
      {/* Draggable area */}
      <div className="fixed top-0 left-0 right-0 h-8 bg-transparent z-50" style={{ WebkitAppRegion: 'drag' } as any}></div>
      
      <div className="min-h-full flex items-center justify-center p-4 pt-12">
        <div className="w-full max-w-3xl mx-auto">
          {/* Welcome header */}
          <div className="text-center mb-6">
            <div className="mb-4">
              <div className="flex items-center justify-center gap-3 mb-4">
                <img src={vimoLogo} alt="Vimo" className="w-16 h-16 rounded-2xl shadow-lg" />
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                  Vimo
                </h1>
              </div>
            </div>
            <p className="text-gray-600 mb-1 text-lg">Agentic Video Understanding</p>
            <p className="text-sm text-gray-500">Let's set up your AI environment</p>
          </div>

          {/* Modern Progress indicator */}
          <div className="mb-8 mt-8">
            <div className="max-w-4xl mx-auto px-8">
              {/* Progress bar background */}
              <div className="relative pt-4 pb-12">
                <div className="h-2 bg-gray-200 rounded-full">
                  <div 
                    className="h-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
                  />
                </div>
                
                {/* Step indicators */}
                <div className="absolute top-1 left-0 right-0 flex justify-between items-center">
                  {steps.map(({ step, icon: Icon, label }) => (
                    <div key={step} className="flex flex-col items-center relative">
                      {/* Step circle */}
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-lg transition-all duration-300
                        ${step < currentStep 
                          ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white' 
                          : step === currentStep
                            ? 'bg-purple-500 text-white animate-pulse'
                            : 'bg-gray-300 text-gray-500'
                        }
                      `}>
                        {step < currentStep ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : step === currentStep ? (
                          <Icon className="w-4 h-4" />
                        ) : (
                          <div className="w-2 h-2 bg-gray-400 rounded-full" />
                        )}
                      </div>
                      
                      {/* Step label */}
                      <span className={`mt-4 text-sm font-medium transition-colors duration-300 ${
                        step < currentStep ? 'text-purple-600' 
                        : step === currentStep ? 'text-purple-600' 
                        : 'text-gray-500'
                      }`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Step content */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-6">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderApiKeySetup()}
            {currentStep === 3 && renderCelebration()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InitializationWizard; 