"""
Fall Detection với tích hợp Backend API
Gửi alert đến Backend khi phát hiện té ngã
"""

import cv2
import time
import sys
import logging
import requests
import base64
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Backend API config
BACKEND_URL = "http://localhost:5000"
FALL_ALERT_ENDPOINT = f"{BACKEND_URL}/api/fall-alert"


def load_config():
    """Load configuration from YAML"""
    import yaml
    config_path = Path(__file__).parent / "config" / "config.yaml"
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def send_fall_alert(frame, confidence: float, location: str = "Main Entrance"):
    """Gửi Fall Alert đến Backend API"""
    try:
        # Encode frame as base64
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        frame_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Build request
        payload = {
            "patientId": None,  # Unknown patient - sẽ nhận diện sau
            "location": location,
            "confidence": confidence,
            "frameData": frame_base64,
            "cameraId": "CAM_001"
        }
        
        # Send to backend
        response = requests.post(
            FALL_ALERT_ENDPOINT,
            json=payload,
            timeout=5
        )
        
        if response.status_code in [200, 201]:
            result = response.json()
            logger.info(f"✅ Alert sent to backend! ID: {result.get('id')}")
            return True
        else:
            logger.error(f"❌ Backend error: {response.status_code} - {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        logger.error("❌ Cannot connect to backend. Is it running?")
        return False
    except Exception as e:
        logger.error(f"❌ Error sending alert: {e}")
        return False


def main():
    print("=" * 60)
    print("🏥 HOSPITAL VISION - FALL DETECTION + BACKEND")
    print("=" * 60)
    
    # Check backend connection
    print(f"\n🔗 Checking backend connection: {BACKEND_URL}")
    try:
        response = requests.get(f"{BACKEND_URL}/api/alerts/active", timeout=3)
        print(f"✅ Backend connected! Active alerts: {len(response.json())}")
    except:
        print("⚠️ Backend not running. Alerts will be saved locally.")
        print(f"   Start backend with: cd BE/HospitalVision.API && dotnet run")
    
    # Load config
    config = load_config()
    
    # Import modules
    from src.core import HikvisionCamera, MultiCameraManager
    from src.core.yolo_fall_detector import YOLOFallDetector, PoseState
    from src.core.camera_manager import load_camera_configs
    
    # Tạo thư mục lưu ảnh té ngã
    fall_images_dir = Path("outputs/fall_detections")
    fall_images_dir.mkdir(parents=True, exist_ok=True)
    print(f"📁 Ảnh té ngã sẽ được lưu tại: {fall_images_dir.absolute()}")
    
    # Initialize camera
    print("\n📹 Initializing camera...")
    camera_configs = load_camera_configs(str(Path(__file__).parent / "config" / "config.yaml"))
    
    if not camera_configs:
        print("❌ No camera configs found!")
        return
    
    camera = HikvisionCamera(camera_configs[0])
    
    # Initialize fall detection
    print("🤖 Initializing YOLOv8-Pose Fall Detection...")
    fall_config = config.get('fall_detection', {})
    # Update model path to new location
    model_name = Path(fall_config.get('model_path', 'yolov8n-pose.pt')).name
    fall_config['model_path'] = f'models/{model_name}'
    fall_detector = YOLOFallDetector(fall_config)
    
    # Connect to camera
    print("\n🔌 Connecting to camera...")
    if not camera.connect():
        print("❌ Failed to connect to camera!")
        return
    
    print("✅ Camera connected!")
    
    # Check GPU
    import torch
    if torch.cuda.is_available():
        print(f"🚀 GPU: {torch.cuda.get_device_name(0)}")
    
    print("\n" + "=" * 60)
    print("👁️ LIVE FALL DETECTION - Press 'q' to quit")
    print("   Falls will be sent to backend automatically!")
    print("=" * 60)
    
    # Stats
    frame_count = 0
    fps_start = time.time()
    fall_count = 0
    alerts_sent = 0
    
    while True:
        ret, frame = camera.read()
        if not ret or frame is None:
            continue
        
        frame_count += 1
        
        # Resize for processing
        process_frame = cv2.resize(frame, (1280, 720))
        
        # Detect falls
        result = fall_detector.process_frame(process_frame)
        
        # Get display frame
        display_frame = result.get('annotated_frame', process_frame.copy())
        
        # Check for fall
        if result.get('fall_detected', False):
            fall_count += 1
            confidence = result.get('confidence', 0.9)
            
            logger.warning(f"🚨 FALL DETECTED! Sending to backend...")
            
            # Lưu ảnh té ngã
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            image_filename = f"fall_{timestamp}_{fall_count}.jpg"
            image_path = fall_images_dir / image_filename
            cv2.imwrite(str(image_path), process_frame)
            logger.info(f"💾 Đã lưu ảnh: {image_filename}")
            
            # Send to backend
            if send_fall_alert(process_frame, confidence, "Main Entrance"):
                alerts_sent += 1
        
        # Calculate FPS
        elapsed = time.time() - fps_start
        fps = frame_count / elapsed if elapsed > 0 else 0
        
        # Draw info overlay
        current_state = result.get('state', PoseState.UNKNOWN)
        
        y_offset = 30
        cv2.putText(display_frame, f"FPS: {fps:.1f}", (10, y_offset),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        y_offset += 30
        cv2.putText(display_frame, f"State: {current_state.value}", (10, y_offset),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        y_offset += 30
        cv2.putText(display_frame, f"Falls: {fall_count} | Alerts sent: {alerts_sent}", (10, y_offset),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        # Backend status
        y_offset += 30
        cv2.putText(display_frame, f"Backend: {BACKEND_URL}", (10, y_offset),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
        
        # Show frame
        cv2.imshow("Fall Detection + Backend", display_frame)
        
        # Handle key press
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('t'):
            # Test: send fake alert
            print("📤 Sending test alert...")
            send_fall_alert(process_frame, 0.95, "Test Location")
    
    # Cleanup
    cv2.destroyAllWindows()
    camera.disconnect()
    
    print("\n" + "=" * 60)
    print("📊 SESSION SUMMARY")
    print("=" * 60)
    print(f"   Falls detected: {fall_count}")
    print(f"   Alerts sent to backend: {alerts_sent}")
    print("=" * 60)


if __name__ == "__main__":
    main()
