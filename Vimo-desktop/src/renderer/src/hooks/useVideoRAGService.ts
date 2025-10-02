import { useState } from 'react'



export interface ServiceState {
  isRunning: boolean
  internvideo2Loaded: boolean
  message?: string
  error?: string
}

export const useVideoRAGService = () => {

  const [serviceState, setServiceState] = useState<ServiceState>({
    isRunning: false,
    internvideo2Loaded: false
  })
  const [loading, setLoading] = useState({
    starting: false,
    stopping: false,
    checkingService: false,
    loadingInternVideo2: false,
    releasingInternVideo2: false
  })



  // Check service status
  const checkServiceStatus = async () => {
    setLoading(prev => ({ ...prev, checkingService: true }))
    try {
      const result = await window.api.videorag.systemStatus()
      if (result.success && result.data) {
        setServiceState(prev => ({
          ...prev,
          isRunning: result.data.total_sessions !== undefined || result.data.global_config_set,
          internvideo2Loaded: result.data.internvideo2_loaded || false,
          message: result.data.internvideo2_loaded
            ? 'Service ready for video processing'
            : 'Service running - InternVideo2 not loaded'
        }))
      } else {
        setServiceState(prev => ({
          ...prev,
          isRunning: false,
          internvideo2Loaded: false,
          error: result.error || 'Failed to get system status'
        }))
      }
    } catch (error) {
      setServiceState(prev => ({
        ...prev,
        isRunning: false,
        internvideo2Loaded: false,
        error: 'Failed to check service status'
      }))
    } finally {
      setLoading(prev => ({ ...prev, checkingService: false }))
    }
  }

  // Start service
  const startService = async () => {
    setLoading(prev => ({ ...prev, starting: true }))
    try {
      const result = await window.api.videorag.startService()
      if (result.success) {
        setServiceState(prev => ({
          ...prev,
          isRunning: true,
          message: result.message
        }))
        // API returns success means service started successfully, no additional check needed
        return true
      } else {
        setServiceState(prev => ({
          ...prev,
          isRunning: false,
          error: result.error
        }))
        return false
      }
    } catch (error) {
      setServiceState(prev => ({
        ...prev,
        isRunning: false,
        error: 'Failed to start service'
      }))
      return false
    } finally {
      setLoading(prev => ({ ...prev, starting: false }))
    }
  }

  // Stop service
  const stopService = async () => {
    setLoading(prev => ({ ...prev, stopping: true }))
    try {
      const result = await window.api.videorag.stopService()
      if (result.success) {
        setServiceState(prev => ({
          ...prev,
          isRunning: false,
          message: result.message
        }))
        // API returns success means service stopped successfully, no additional check needed
        return true
      } else {
        setServiceState(prev => ({
          ...prev,
          isRunning: false,
          error: result.error
        }))
        return false
      }
    } catch (error) {
      setServiceState(prev => ({
        ...prev,
        isRunning: false,
        error: 'Failed to stop service'
      }))
      return false
    } finally {
      setLoading(prev => ({ ...prev, stopping: false }))
    }
  }

  // Load InternVideo2 model
  const loadInternVideo2 = async () => {
    setLoading(prev => ({ ...prev, loadingInternVideo2: true }))
    try {
      const result = await window.api.videorag.loadInternVideo2()
      if (result.success) {
        setServiceState(prev => ({
          ...prev,
          internvideo2Loaded: true,
          message: 'InternVideo2 model loaded successfully'
        }))
        return true
      } else {
        setServiceState(prev => ({
          ...prev,
          error: result.error
        }))
        return false
      }
    } catch (error) {
      setServiceState(prev => ({
        ...prev,
        error: 'Failed to load InternVideo2 model'
      }))
      return false
    } finally {
      setLoading(prev => ({ ...prev, loadingInternVideo2: false }))
    }
  }

  // Release InternVideo2 model
  const releaseInternVideo2 = async () => {
    setLoading(prev => ({ ...prev, releasingInternVideo2: true }))
    try {
      const result = await window.api.videorag.releaseInternVideo2()
      if (result.success) {
        setServiceState(prev => ({
          ...prev,
          internvideo2Loaded: false,
          message: 'InternVideo2 model released successfully'
        }))
        return true
      } else {
        setServiceState(prev => ({
          ...prev,
          error: result.error
        }))
        return false
      }
    } catch (error) {
      setServiceState(prev => ({
        ...prev,
        error: 'Failed to release InternVideo2 model'
      }))
      return false
    } finally {
      setLoading(prev => ({ ...prev, releasingInternVideo2: false }))
    }
  }

  // Check InternVideo2 status
  const checkInternVideo2Status = async () => {
    try {
      const result = await window.api.videorag.internvideo2Status()
      if (result.success) {
        setServiceState(prev => ({
          ...prev,
          internvideo2Loaded: result.data?.loaded || false
        }))
      }
    } catch (error) {
      console.error('Failed to check InternVideo2 status:', error)
    }
  }


  return {
    serviceState,
    loading,
    checkServiceStatus,
    startService,
    stopService,
    loadInternVideo2,
    releaseInternVideo2,
    checkInternVideo2Status
  }
} 