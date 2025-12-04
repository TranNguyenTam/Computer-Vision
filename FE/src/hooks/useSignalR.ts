import { useCallback, useEffect, useRef, useState } from 'react';
import signalRService from '../services/signalr';
import { DetectionEvent, FallAlert } from '../types';

interface UseSignalROptions {
  autoConnect?: boolean;
  onFallAlert?: (alert: FallAlert) => void;
  onPatientDetected?: (event: DetectionEvent) => void;
}

export function useSignalR(options: UseSignalROptions = {}) {
  const { autoConnect = true, onFallAlert, onPatientDetected } = options;
  const [isConnected, setIsConnected] = useState(signalRService.isConnected);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<FallAlert[]>([]);
  const mountedRef = useRef(true);

  // Connect to SignalR
  const connect = useCallback(async () => {
    try {
      setConnectionError(null);
      await signalRService.connect();
      if (mountedRef.current) {
        setIsConnected(true);
      }
    } catch (error) {
      if (mountedRef.current) {
        setConnectionError((error as Error).message);
        setIsConnected(false);
      }
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    await signalRService.disconnect();
    if (mountedRef.current) {
      setIsConnected(false);
    }
  }, []);

  // Handle new fall alerts
  useEffect(() => {
    const unsubscribe = signalRService.onFallAlert((alert) => {
      if (mountedRef.current) {
        setAlerts((prev) => [alert, ...prev].slice(0, 50)); // Keep last 50 alerts
        onFallAlert?.(alert);
      }
    });

    return unsubscribe;
  }, [onFallAlert]);

  // Handle patient detected
  useEffect(() => {
    if (onPatientDetected) {
      const unsubscribe = signalRService.onPatientDetected(onPatientDetected);
      return unsubscribe;
    }
  }, [onPatientDetected]);

  // Auto connect on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect && !signalRService.isConnected) {
      connect();
    } else {
      setIsConnected(signalRService.isConnected);
    }

    // Check connection status periodically
    const interval = setInterval(() => {
      if (mountedRef.current) {
        setIsConnected(signalRService.isConnected);
      }
    }, 5000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [autoConnect, connect]);

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId: number, acknowledgedBy: string) => {
    await signalRService.acknowledgeAlert(alertId, acknowledgedBy);
  }, []);

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    isConnected,
    connectionError,
    alerts,
    connect,
    disconnect,
    acknowledgeAlert,
    clearAlerts,
  };
}

export default useSignalR;
