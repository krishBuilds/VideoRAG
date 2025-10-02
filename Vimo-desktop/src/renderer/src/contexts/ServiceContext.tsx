import { createContext, useContext, ReactNode } from 'react';
import { useVideoRAGService } from '../hooks/useVideoRAGService';

// Create Service Status Context
interface ServiceContextType {
  serviceState: {
    isRunning: boolean;
    internvideo2Loaded: boolean;
    message?: string;
    error?: string;
  };
  loading: {
    starting: boolean;
    stopping: boolean;
    checkingService: boolean;
    loadingInternVideo2: boolean;
    releasingInternVideo2: boolean;
  };
  startService: () => Promise<boolean>;
  stopService: () => Promise<boolean>;
  checkServiceStatus: () => Promise<void>;
  loadInternVideo2: () => Promise<boolean>;
  releaseInternVideo2: () => Promise<boolean>;
  checkInternVideo2Status: () => Promise<void>;
}

const ServiceContext = createContext<ServiceContextType | null>(null);

export const ServiceProvider = ({ children }: { children: ReactNode }) => {
  const {
    serviceState,
    loading,
    startService,
    stopService,
    checkServiceStatus,
    loadInternVideo2,
    releaseInternVideo2,
    checkInternVideo2Status
  } = useVideoRAGService();

  return (
    <ServiceContext.Provider
      value={{
        serviceState,
        loading,
        startService,
        stopService,
        checkServiceStatus,
        loadInternVideo2,
        releaseInternVideo2,
        checkInternVideo2Status
      }}
    >
      {children}
    </ServiceContext.Provider>
  );
};

export const useServiceContext = () => {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServiceContext must be used within a ServiceProvider');
  }
  return context;
}; 