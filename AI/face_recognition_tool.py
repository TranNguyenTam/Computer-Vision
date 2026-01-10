"""
Face Recognition Tool - Trả về Mã Y Tế
Kết nối AI module với Backend API
"""
import cv2
import requests
import logging
from typing import Dict, List, Optional
from pathlib import Path
import yaml

from src.services import FastFaceRecognition
from src.core import HikvisionCamera

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

class FaceRecognitionTool:
    def __init__(self, config_path: str = "config/tool_config.yaml"):
        # Load config
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        self.backend_url = config['backend']['url']
        self.timeout = config['backend']['timeout']
        
        # Initialize face recognition
        face_config = config['face_recognition']
        self.recognizer = FastFaceRecognition(face_config)
        
        # Cache để lưu thông tin bệnh nhân
        self.patient_cache = {}

    def get_patient_info(self, person_id: str) -> Optional[Dict]:
        """Lấy thông tin bệnh nhân từ Backend API"""
        if person_id in self.patient_cache:
            return self.patient_cache[person_id]
        
        try:
            url = f"{self.backend_url}/api/patients/by-face-id/{person_id}"
            response = requests.get(url, timeout=self.timeout)
            
            if response.status_code == 200:
                patient_data = response.json()
                patient_info = {
                    'ma_yte': patient_data.get('maYTe'),
                    'ho_ten': patient_data.get('tenBenhNhan'),
                    'ngay_sinh': patient_data.get('ngaySinh'),
                    'gioi_tinh': patient_data.get('gioiTinh'),
                    'dia_chi': patient_data.get('diaChi'),
                    'so_dien_thoai': patient_data.get('soDienThoai'),
                }
                self.patient_cache[person_id] = patient_info
                return patient_info
            else:
                return None
        except Exception as e:
            logger.error(f"Backend API error: {e}")
            return None
    
    def recognize_from_frame(self, frame) -> List[Dict]:
        """Nhận diện khuôn mặt từ frame và trả về thông tin"""
        result = self.recognizer.process_frame(frame)
        faces = result.get('faces', [])
        
        results = []
        for face in faces:
            person_id = face.get('person_id') or face.get('identity')
            
            if person_id and person_id != 'Unknown':
                patient_info = self.get_patient_info(person_id)
                results.append({
                    'person_id': person_id,
                    'ma_yte': patient_info.get('ma_yte') if patient_info else None,
                    'ho_ten': patient_info.get('ho_ten') if patient_info else f'Face ID: {person_id}',
                    'confidence': face.get('confidence', 0),
                    'bbox': face.get('bbox'),
                    'recognized': patient_info is not None
                })
            else:
                results.append({
                    'person_id': 'Unknown',
                    'ma_yte': None,
                    'ho_ten': 'Không xác định',
                    'confidence': face.get('confidence', 0),
                    'bbox': face.get('bbox'),
                    'recognized': False
                })
        
        return results
    
    def recognize_from_camera(self, camera_id: int = 0, display: bool = True):
        """Nhận diện realtime từ camera"""
        cap = cv2.VideoCapture(camera_id)
        
        if not cap.isOpened():
            logger.error(f"Cannot open camera {camera_id}")
            return
        
        logger.info(f"📹 Camera {camera_id} started. Press 'q' to quit")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Nhận diện
            results = self.recognize_from_frame(frame)
            
            # Vẽ kết quả lên frame
            for result in results:
                bbox = result['bbox']
                if bbox:
                    x1, y1, x2, y2 = bbox
                    
                    # Màu: xanh nếu nhận diện được, đỏ nếu không
                    color = (0, 255, 0) if result['recognized'] else (0, 0, 255)
                    
                    # Vẽ box
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    
                    # Text
                    if result['recognized']:
                        label = f"{result['ma_yte']}: {result['ho_ten']}"
                        conf_text = f"{result['confidence']:.1%}"
                    else:
                        label = result['ho_ten']
                        conf_text = ""
                    
                    # Background cho text
                    (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
                    cv2.rectangle(frame, (x1, y1 - text_h - 10), (x1 + text_w, y1), color, -1)
                    
                    # Text
                    cv2.putText(frame, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
                    
                    if conf_text:
                        cv2.putText(frame, conf_text, (x1, y2 + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
                    
                    # Print ra console
                    if result['recognized']:
                        print(f"✅ {result['ma_yte']} - {result['ho_ten']} ({result['confidence']:.1%})")
            
            if display:
                cv2.imshow('Face Recognition Tool', frame)
            
            # Quit
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        
        cap.release()
        cv2.destroyAllWindows()
        logger.info("Camera stopped")
    
    def recognize_from_hikvision(self, camera_ip: str, display: bool = True):
        """Nhận diện realtime từ Hikvision camera"""
        # Load full config for camera settings
        config_path = Path(__file__).parent / "config" / "config.yaml"
        with open(config_path, 'r', encoding='utf-8') as f:
            full_config = yaml.safe_load(f)
        
        camera_config = full_config.get('camera', {})
        
        # Build camera config
        hikvision_config = {
            'id': 'recognition_camera',
            'ip': camera_ip,
            'username': camera_config.get('username', 'admin'),
            'password': camera_config.get('password', 'test@2025'),
            'port': camera_config.get('port', 554),
            'channel': camera_config.get('channel', 1),
            'stream': camera_config.get('stream', 1),
            'transport': camera_config.get('transport', 'tcp'),
        }
        
        # Initialize Hikvision camera
        camera = HikvisionCamera(hikvision_config)
        
        if not camera.connect():
            logger.error(f"Cannot connect to Hikvision camera {camera_ip}")
            return
        
        logger.info(f"🎥 Hikvision camera {camera_ip} connected. Press 'q' to quit")
        
        # Set running flag for direct read loop (không dùng background thread)
        camera.is_running = True
        
        try:
            frame_count = 0
            while camera.is_running and camera.is_connected:
                ret, frame = camera.cap.read()
                if not ret or frame is None:
                    logger.warning("Failed to read frame, retrying...")
                    time.sleep(0.1)
                    continue
                
                frame_count += 1
                if frame_count == 1:
                    logger.info(f"📸 Frame info: shape={frame.shape}, dtype={frame.dtype}, min={frame.min()}, max={frame.max()}")
                
                # Nhận diện
                results = self.recognize_from_frame(frame)
                
                # Vẽ kết quả lên frame
                for result in results:
                    bbox = result['bbox']
                    if bbox:
                        x1, y1, x2, y2 = bbox
                        
                        # Màu: xanh nếu nhận diện được, đỏ nếu không
                        color = (0, 255, 0) if result['recognized'] else (0, 0, 255)
                        
                        # Vẽ box
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                        
                        # Text
                        if result['recognized']:
                            label = f"{result['ma_yte']}: {result['ho_ten']}"
                            conf_text = f"{result['confidence']:.1%}"
                        else:
                            label = result['ho_ten']
                            conf_text = ""
                        
                        # Background cho text
                        (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
                        cv2.rectangle(frame, (x1, y1 - text_h - 10), (x1 + text_w, y1), color, -1)
                        
                        # Text
                        cv2.putText(frame, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
                        
                        if conf_text:
                            cv2.putText(frame, conf_text, (x1, y2 + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
                        
                        # Print ra console
                        if result['recognized']:
                            print(f"✅ {result['ma_yte']} - {result['ho_ten']} ({result['confidence']:.1%})")
                
                if display:
                    # Resize để dễ xem (2560x1440 quá lớn)
                    display_frame = cv2.resize(frame, (1280, 720))
                    
                    # Thêm thông tin FPS
                    fps_text = f"Frame: {frame_count}"
                    cv2.putText(display_frame, fps_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                    
                    cv2.imshow('Face Recognition - Hikvision', display_frame)
                
                # Quit
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        
        finally:
            camera.disconnect()
            cv2.destroyAllWindows()
            logger.info("Hikvision camera stopped")


if __name__ == "__main__":
    print("=" * 60)
    print("🏥 Face Recognition Tool")
    print("=" * 60)
    print("\nThis is a library module, not a CLI tool.")
    print("\nUsage:")
    print("  from face_recognition_tool import FaceRecognitionTool")
    print("  tool = FaceRecognitionTool(backend_url='http://localhost:5000')")
    print("  results = tool.recognize_faces(frame)")
    print("\nFor CLI usage, use:")
    print("  python tools/recognize_face.py")
    print("=" * 60)