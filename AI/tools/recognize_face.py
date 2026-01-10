"""
CLI Tool để nhận diện khuôn mặt
"""

import sys
import argparse
import yaml
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from face_recognition_tool import FaceRecognitionTool

def load_config():
    """Load configuration from YAML"""
    config_path = Path(__file__).parent.parent / "config" / "config.yaml"
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def main():
    parser = argparse.ArgumentParser(description="Face Recognition CLI Tool for Hospital Vision AI")

    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    cam_parser = subparsers.add_parser('camera', help='Nhận diện realtime từ camera')
    cam_parser.add_argument('--id', type=int, default=0, help='Camera ID (default: 0)')
    cam_parser.add_argument('--hikvision', action='store_true', help='Use Hikvision camera from config')
    cam_parser.add_argument('--ip', type=str, help='Hikvision camera IP (override config)')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return
    
    print("🚀 Initializing Face Recognition Tool...")
    
    # Load config
    config = load_config()
    backend_url = config.get('backend', {}).get('url', 'http://localhost:5000')
    
    # Load main config for camera settings
    main_config_path = Path(__file__).parent.parent / "config" / "config.yaml"
    with open(main_config_path, 'r', encoding='utf-8') as f:
        main_config = yaml.safe_load(f)
      
    tool = FaceRecognitionTool(config_path=str(Path(__file__).parent.parent / "config" / "tool_config.yaml"))
    print(f"✅ Connected to backend: {backend_url}\n")

    if args.command == 'camera':
        print("📹 Starting camera feed...")
        print("Press 'q' to quit.")
        
        if args.hikvision:
            # Use Hikvision camera
            hikvision_ip = args.ip if args.ip else config.get('camera', {}).get('ip', '192.168.1.6')
            print(f"🎥 Using Hikvision camera: {hikvision_ip}")
            tool.recognize_from_hikvision(hikvision_ip, display=True)
        else:
            # Use webcam
            tool.recognize_from_camera(camera_id=args.id, display=True)

if __name__ == "__main__":
    main()
     