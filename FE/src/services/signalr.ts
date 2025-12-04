import * as signalR from '@microsoft/signalr';
import { DetectionEvent, FallAlert } from '../types';

type FallAlertHandler = (alert: FallAlert) => void;
type PatientDetectedHandler = (event: DetectionEvent) => void;
type AlertStatusUpdateHandler = (data: { alertId: number; status: string }) => void;

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private fallAlertHandlers: FallAlertHandler[] = [];
  private patientDetectedHandlers: PatientDetectedHandler[] = [];
  private alertStatusUpdateHandlers: AlertStatusUpdateHandler[] = [];
  private isConnecting = false;

  async connect(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const hubUrl = import.meta.env.VITE_SIGNALR_URL || '/hubs/alerts';
      
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl)
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Set up event handlers
      this.connection.on('FallAlert', (alert: FallAlert) => {
        console.log('Received fall alert:', alert);
        this.fallAlertHandlers.forEach(handler => handler(alert));
      });

      this.connection.on('PatientDetected', (event: DetectionEvent) => {
        console.log('Patient detected:', event);
        this.patientDetectedHandlers.forEach(handler => handler(event));
      });

      this.connection.on('AlertStatusUpdate', (data: { alertId: number; status: string }) => {
        console.log('Alert status update:', data);
        this.alertStatusUpdateHandlers.forEach(handler => handler(data));
      });

      this.connection.onreconnecting(() => {
        console.log('SignalR reconnecting...');
      });

      this.connection.onreconnected(() => {
        console.log('SignalR reconnected');
      });

      this.connection.onclose(() => {
        console.log('SignalR connection closed');
      });

      await this.connection.start();
      console.log('SignalR connected');
    } catch (error) {
      console.error('SignalR connection error:', error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }

  onFallAlert(handler: FallAlertHandler): () => void {
    this.fallAlertHandlers.push(handler);
    return () => {
      this.fallAlertHandlers = this.fallAlertHandlers.filter(h => h !== handler);
    };
  }

  onPatientDetected(handler: PatientDetectedHandler): () => void {
    this.patientDetectedHandlers.push(handler);
    return () => {
      this.patientDetectedHandlers = this.patientDetectedHandlers.filter(h => h !== handler);
    };
  }

  onAlertStatusUpdate(handler: AlertStatusUpdateHandler): () => void {
    this.alertStatusUpdateHandlers.push(handler);
    return () => {
      this.alertStatusUpdateHandlers = this.alertStatusUpdateHandlers.filter(h => h !== handler);
    };
  }

  async acknowledgeAlert(alertId: number, acknowledgedBy: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      await this.connection.invoke('AcknowledgeAlert', alertId, acknowledgedBy);
    }
  }

  get isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }
}

export const signalRService = new SignalRService();
export default signalRService;
