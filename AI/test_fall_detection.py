#!/usr/bin/env python3
"""
Test Fall Detection với Camera thật
Sử dụng YOLOv8-Pose (hỗ trợ Python 3.13)
Hikvision IDS-2CD7146G0-IZS (4MP DeepinView)
"""

import cv2
import time
import sys
import os
import logging
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_config():
    """Load configuration from YAML"""
    import yaml
    config_path = Path(__file__).parent / "config" / "config.yaml"
    
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def main():
    print("=" * 60)
    print("🏥 HOSPITAL VISION SYSTEM - FALL DETECTION TEST")
    print("🤖 Using YOLOv8-Pose (Python 3.13 compatible)")
    print("=" * 60)
    
    # Load config
    config = load_config()
    
    # Import modules
    from camera_manager import HikvisionCamera, load_camera_configs
    from yolo_fall_detector import YOLOFallDetector, PoseState
    
    # Initialize camera
    print("\n📹 Initializing camera...")
    camera_configs = load_camera_configs(str(Path(__file__).parent / "config" / "config.yaml"))
    
    if not camera_configs:
        print("❌ No camera configs found!")
        return
    
    camera = HikvisionCamera(camera_configs[0])
    
    # Initialize fall detection with YOLOv8
    print("🤖 Initializing YOLOv8-Pose Fall Detection...")
    fall_config = config.get('fall_detection', {})
    fall_config['model_path'] = 'yolov8n-pose.pt'  # nano model for speed
    fall_detector = YOLOFallDetector(fall_config)
    
    print(f"   Model: YOLOv8n-pose")
    print(f"   Angle threshold: {fall_detector.angle_threshold}°")
    print(f"   Confidence: {fall_detector.confidence_threshold}")
    
    # Connect to camera
    print("\n🔌 Connecting to camera...")
    if not camera.connect():
        print("❌ Failed to connect to camera!")
        return
    
    print("✅ Camera connected!")
    print("\n" + "=" * 60)
    print("👁️ LIVE FALL DETECTION - Press 'q' to quit")
    print("=" * 60)
    print("\n📊 Legend:")
    print("   🟢 GREEN skeleton = Standing")
    print("   🟡 YELLOW skeleton = Sitting")
    print("   🟠 ORANGE skeleton = Lying")
    print("   🔴 RED border = FALL DETECTED!")
    print("")
    
    # Stats
    frame_count = 0
    fps_start = time.time()
    fall_count = 0
    last_fall_time = 0
    
    # Colors
    COLOR_NORMAL = (0, 255, 0)     # Green
    COLOR_WARNING = (0, 255, 255)  # Yellow
    COLOR_FALL = (0, 0, 255)       # Red
    # GPU optimization: process every frame with CUDA
    process_interval = 1  # Process every frame with GPU
    last_result = None
    last_display_frame = None
    
    # Check GPU
    import torch
    if torch.cuda.is_available():
        print(f"\n🚀 Running on GPU: {torch.cuda.get_device_name(0)}")
        print(f"   Processing every frame at full speed!\n")
    else:
        print(f"\n⚠️ Running on CPU - may be slower")
        process_interval = 3
    
    while True:
        ret, frame = camera.read()
        if not ret or frame is None:
            continue
        
        frame_count += 1
        
        # Resize for processing - 720p for good balance
        process_frame = cv2.resize(frame, (1280, 720))
        
        # Process frame (every frame with GPU, skip frames on CPU)
        if frame_count % process_interval == 0 or last_result is None:
            # Detect falls using YOLOv8
            result = fall_detector.process_frame(process_frame)
            last_result = result
            
            # Get annotated frame from detector
            display_frame = result.get('annotated_frame', process_frame.copy())
            last_display_frame = display_frame
        else:
            # Reuse last result
            result = last_result
            display_frame = last_display_frame if last_display_frame is not None else process_frame
        
        # Get current pose state
        current_state = result.get('state', PoseState.UNKNOWN) if result else PoseState.UNKNOWN
        
        # Check for fall
        if result and result.get('fall_detected', False):
            fall_count += 1
            last_fall_time = time.time()
            logger.warning(f"🚨 FALL DETECTED!")
        
        # Calculate FPS
        elapsed = time.time() - fps_start
        fps = frame_count / elapsed if elapsed > 0 else 0
        
        # Draw info overlay
        y_offset = 30
        cv2.putText(display_frame, f"FPS: {fps:.1f}", (10, y_offset),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        y_offset += 30
        state_text = f"State: {current_state.value.upper()}"
        cv2.putText(display_frame, state_text, (10, y_offset),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        y_offset += 30
        if result.get('body_angle') is not None:
            cv2.putText(display_frame, f"Body Angle: {result['body_angle']:.1f}°", (10, y_offset),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        y_offset += 30
        cv2.putText(display_frame, f"Falls detected: {fall_count}", (10, y_offset),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        # Flash warning when fall detected (within last 3 seconds)
        if time.time() - last_fall_time < 3:
            # Draw red border
            cv2.rectangle(display_frame, (0, 0), 
                         (display_frame.shape[1]-1, display_frame.shape[0]-1), 
                         (0, 0, 255), 5)
            
            # Draw warning text
            cv2.putText(display_frame, "!! FALL DETECTED !!", 
                       (display_frame.shape[1]//2 - 150, 50),
                       cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)
        
        # Show frame
        cv2.imshow("Fall Detection - Press 'q' to quit", display_frame)
        
        # Handle key press
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('r'):
            # Reset stats
            fall_count = 0
            frame_count = 0
            fps_start = time.time()
            print("📊 Stats reset!")
    
    # Cleanup
    cv2.destroyAllWindows()
    camera.disconnect()
    
    print("\n" + "=" * 60)
    print("📊 SESSION SUMMARY")
    print("=" * 60)
    print(f"   Total frames: {frame_count}")
    print(f"   Average FPS: {fps:.1f}")
    print(f"   Falls detected: {fall_count}")
    print("=" * 60)


if __name__ == "__main__":
    main()