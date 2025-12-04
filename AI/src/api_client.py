"""
API Client for Backend Communication
Handles sending data to backend server via REST API and WebSocket
"""

import json
import logging
import threading
import queue
from typing import Optional, Callable, Dict, Any
from datetime import datetime

import requests

try:
    import websocket
    WEBSOCKET_AVAILABLE = True
except ImportError:
    WEBSOCKET_AVAILABLE = False

logger = logging.getLogger(__name__)


class APIClient:
    """
    REST API Client for backend communication
    """
    
    def __init__(self, base_url: str, timeout: int = 5):
        """
        Initialize API client
        
        Args:
            base_url: Backend server base URL
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        
        logger.info(f"API Client initialized with base URL: {self.base_url}")
    
    def _make_request(self, method: str, endpoint: str, 
                      data: dict = None, params: dict = None) -> dict:
        """Make HTTP request to backend"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                params=params,
                timeout=self.timeout
            )
            response.raise_for_status()
            return {
                'success': True,
                'data': response.json() if response.content else None,
                'status_code': response.status_code
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'status_code': getattr(e.response, 'status_code', None) if hasattr(e, 'response') else None
            }
    
    def get_patient_info(self, patient_id: str) -> dict:
        """
        Get patient information from backend
        
        Args:
            patient_id: Patient identifier
            
        Returns:
            Patient information dictionary
        """
        return self._make_request('GET', f'/api/patient/{patient_id}')
    
    def send_fall_alert(self, patient_id: Optional[str], 
                        location: str = None,
                        confidence: float = 1.0,
                        frame_data: str = None) -> dict:
        """
        Send fall alert to backend
        
        Args:
            patient_id: Patient identifier (None if unknown)
            location: Camera/location identifier
            confidence: Detection confidence
            frame_data: Base64 encoded frame image
            
        Returns:
            Response from backend
        """
        data = {
            'patient_id': patient_id,
            'timestamp': datetime.utcnow().isoformat(),
            'location': location,
            'confidence': confidence,
            'alert_type': 'fall',
            'frame_data': frame_data
        }
        return self._make_request('POST', '/api/fall-alert', data=data)
    
    def send_patient_detected(self, patient_id: str,
                              location: str = None,
                              confidence: float = 1.0) -> dict:
        """
        Send patient detection event to backend
        
        Args:
            patient_id: Patient identifier
            location: Camera/location identifier
            confidence: Detection confidence
            
        Returns:
            Response from backend
        """
        data = {
            'patient_id': patient_id,
            'timestamp': datetime.utcnow().isoformat(),
            'location': location,
            'confidence': confidence,
            'event_type': 'patient_detected'
        }
        return self._make_request('POST', '/api/patient/detected', data=data)
    
    def health_check(self) -> bool:
        """Check if backend is available"""
        result = self._make_request('GET', '/api/health')
        return result.get('success', False)


class WebSocketClient:
    """
    WebSocket Client for real-time communication
    """
    
    def __init__(self, ws_url: str, 
                 on_message: Callable = None,
                 on_error: Callable = None,
                 on_close: Callable = None):
        """
        Initialize WebSocket client
        
        Args:
            ws_url: WebSocket server URL
            on_message: Callback for incoming messages
            on_error: Callback for errors
            on_close: Callback for connection close
        """
        if not WEBSOCKET_AVAILABLE:
            raise ImportError("websocket-client not installed")
        
        self.ws_url = ws_url
        self.on_message_callback = on_message
        self.on_error_callback = on_error
        self.on_close_callback = on_close
        
        self.ws: Optional[websocket.WebSocketApp] = None
        self.ws_thread: Optional[threading.Thread] = None
        self.message_queue = queue.Queue()
        self.connected = False
        self.running = False
        
        logger.info(f"WebSocket Client initialized with URL: {self.ws_url}")
    
    def _on_open(self, ws):
        """WebSocket connection opened"""
        self.connected = True
        logger.info("WebSocket connected")
    
    def _on_message(self, ws, message):
        """WebSocket message received"""
        try:
            data = json.loads(message)
            if self.on_message_callback:
                self.on_message_callback(data)
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {message}")
    
    def _on_error(self, ws, error):
        """WebSocket error occurred"""
        logger.error(f"WebSocket error: {error}")
        if self.on_error_callback:
            self.on_error_callback(error)
    
    def _on_close(self, ws, close_status_code, close_msg):
        """WebSocket connection closed"""
        self.connected = False
        logger.info(f"WebSocket closed: {close_status_code} - {close_msg}")
        if self.on_close_callback:
            self.on_close_callback(close_status_code, close_msg)
    
    def connect(self):
        """Establish WebSocket connection"""
        if self.connected:
            return
        
        self.ws = websocket.WebSocketApp(
            self.ws_url,
            on_open=self._on_open,
            on_message=self._on_message,
            on_error=self._on_error,
            on_close=self._on_close
        )
        
        self.running = True
        self.ws_thread = threading.Thread(target=self._run_forever, daemon=True)
        self.ws_thread.start()
    
    def _run_forever(self):
        """Run WebSocket client in background"""
        while self.running:
            try:
                self.ws.run_forever()
            except Exception as e:
                logger.error(f"WebSocket run error: {e}")
            
            if self.running:
                import time
                time.sleep(5)  # Reconnect after 5 seconds
    
    def send(self, data: dict):
        """Send data through WebSocket"""
        if self.connected and self.ws:
            try:
                self.ws.send(json.dumps(data))
            except Exception as e:
                logger.error(f"WebSocket send error: {e}")
    
    def send_fall_alert(self, patient_id: Optional[str],
                        location: str = None,
                        confidence: float = 1.0):
        """Send fall alert through WebSocket"""
        self.send({
            'type': 'fall_alert',
            'patient_id': patient_id,
            'timestamp': datetime.utcnow().isoformat(),
            'location': location,
            'confidence': confidence
        })
    
    def send_patient_detected(self, patient_id: str,
                              location: str = None,
                              confidence: float = 1.0):
        """Send patient detection through WebSocket"""
        self.send({
            'type': 'patient_detected',
            'patient_id': patient_id,
            'timestamp': datetime.utcnow().isoformat(),
            'location': location,
            'confidence': confidence
        })
    
    def disconnect(self):
        """Close WebSocket connection"""
        self.running = False
        if self.ws:
            self.ws.close()
        self.connected = False


class CommunicationManager:
    """
    Manages both REST API and WebSocket communication
    Provides unified interface for backend communication
    """
    
    def __init__(self, api_config: dict):
        """
        Initialize communication manager
        
        Args:
            api_config: Configuration dictionary with API settings
        """
        self.config = api_config
        self.api_client = APIClient(
            api_config.get('backend_url', 'http://localhost:5000'),
            api_config.get('timeout', 5)
        )
        
        self.ws_client: Optional[WebSocketClient] = None
        self.use_websocket = False
        
        # Message queue for async sending
        self.message_queue = queue.Queue()
        self.sender_thread: Optional[threading.Thread] = None
        self.running = False
        
        logger.info("Communication Manager initialized")
    
    def start(self, use_websocket: bool = True):
        """Start communication services"""
        self.running = True
        
        # Start message sender thread
        self.sender_thread = threading.Thread(target=self._process_queue, daemon=True)
        self.sender_thread.start()
        
        # Connect WebSocket if enabled
        if use_websocket and WEBSOCKET_AVAILABLE:
            try:
                ws_url = self.config.get('websocket_url', 'ws://localhost:5000/ws')
                self.ws_client = WebSocketClient(ws_url)
                self.ws_client.connect()
                self.use_websocket = True
            except Exception as e:
                logger.warning(f"WebSocket connection failed: {e}")
                self.use_websocket = False
    
    def stop(self):
        """Stop communication services"""
        self.running = False
        
        if self.ws_client:
            self.ws_client.disconnect()
    
    def _process_queue(self):
        """Process message queue in background"""
        while self.running:
            try:
                message = self.message_queue.get(timeout=1)
                self._send_message(message)
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Error processing message queue: {e}")
    
    def _send_message(self, message: dict):
        """Send message via appropriate channel"""
        msg_type = message.get('type')
        
        if self.use_websocket and self.ws_client and self.ws_client.connected:
            # Send via WebSocket
            self.ws_client.send(message)
        else:
            # Fallback to REST API
            if msg_type == 'fall_alert':
                self.api_client.send_fall_alert(
                    message.get('patient_id'),
                    message.get('location'),
                    message.get('confidence', 1.0)
                )
            elif msg_type == 'patient_detected':
                self.api_client.send_patient_detected(
                    message.get('patient_id'),
                    message.get('location'),
                    message.get('confidence', 1.0)
                )
    
    def get_patient_info(self, patient_id: str) -> dict:
        """Get patient information (always via REST API)"""
        return self.api_client.get_patient_info(patient_id)
    
    def send_fall_alert(self, patient_id: Optional[str],
                        location: str = None,
                        confidence: float = 1.0):
        """Queue fall alert for sending"""
        self.message_queue.put({
            'type': 'fall_alert',
            'patient_id': patient_id,
            'location': location,
            'confidence': confidence,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    def send_patient_detected(self, patient_id: str,
                              location: str = None,
                              confidence: float = 1.0):
        """Queue patient detection for sending"""
        self.message_queue.put({
            'type': 'patient_detected',
            'patient_id': patient_id,
            'location': location,
            'confidence': confidence,
            'timestamp': datetime.utcnow().isoformat()
        })
