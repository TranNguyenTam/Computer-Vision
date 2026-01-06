"""
Camera Streaming Server
Provides MJPEG stream and WebSocket for live video + AI overlay
Supports Fall Detection and Face Recognition
"""

import cv2
import time
import sys
import json
import logging
import threading
import base64
import os
from pathlib import Path
from flask import Flask, Response, jsonify, request, send_file
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:3001"])
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Upload folder for face registration
UPLOAD_FOLDER = Path(__file__).parent / "data" / "uploads"
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
app.config['UPLOAD_FOLDER'] = str(UPLOAD_FOLDER)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

# Global state
camera = None
fall_detector = None
face_recognizer = None
is_running = False
current_frame = None
raw_frame = None  # Frame gốc không có AI overlay
frame_lock = threading.Lock()
current_camera_config = None  # Lưu config của camera đang sử dụng

# AI settings
ai_settings = {
    "ai_enabled": True,
    "fall_detection_enabled": False,  # Tắt mặc định, bật khi vào trang Fall Detection
    "face_recognition_enabled": False,  # Tắt mặc định, bật khi vào trang Face Recognition
    "auto_detection_enabled": True,  # Auto-record face detection to backend
    "show_bounding_box": True,  # Hiển thị bounding box (tắt khi đăng ký mới)
}

# Stats
stats = {
    "fps": 0,
    "falls_detected": 0,
    "faces_recognized": 0,
    "state": "unknown",
    "recognized_persons": []
}


def load_config():
    import yaml
    config_path = Path(__file__).parent / "config" / "config.yaml"
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def initialize_camera():
    """Initialize camera and AI modules"""
    global camera, fall_detector, face_recognizer, current_camera_config
    
    from camera_manager import HikvisionCamera, load_camera_configs
    from yolo_fall_detector import YOLOFallDetector
    
    # Import face recognition from AI root folder
    import sys
    ai_root = str(Path(__file__).parent)
    if ai_root not in sys.path:
        sys.path.insert(0, ai_root)
    
    # Use deep learning face embedding (MobileFaceNet ONNX)
    try:
        from face_embedding import FaceEmbedding
        USE_EMBEDDING = True
        logger.info("🧠 Using Deep Learning Face Embedding (MobileFaceNet ONNX)")
    except ImportError as e:
        logger.error(f"❌ Failed to import FaceEmbedding: {e}")
        # Fallback to fast CPU version
        from face_recognition_fast import FastFaceRecognition
        USE_EMBEDDING = False
        logger.info("💻 Fallback to Fast Face Recognition (CPU)")
    
    config = load_config()
    
    # Initialize camera
    camera_configs = load_camera_configs(str(Path(__file__).parent / "config" / "config.yaml"))
    if camera_configs:
        current_camera_config = camera_configs[0]  # Lưu config của camera đầu tiên
        camera = HikvisionCamera(current_camera_config)
        if camera.connect():
            logger.info("✅ Camera connected")
        else:
            logger.warning("⚠️ Camera IP failed, trying webcam fallback...")
            # Fallback to webcam
            fallback_source = config.get('camera', {}).get('fallback_source', 0)
            camera.cap = cv2.VideoCapture(fallback_source)
            if camera.cap.isOpened():
                camera.is_connected = True
                logger.info(f"✅ Webcam fallback connected (device {fallback_source})")
            else:
                logger.error("❌ Camera connection failed (IP and webcam)")
                return False
    
    # Initialize fall detector
    fall_config = config.get('fall_detection', {})
    fall_config['model_path'] = 'yolov8n-pose.pt'
    fall_detector = YOLOFallDetector(fall_config)
    logger.info("✅ YOLOv8-Pose initialized")
    
    # Initialize Deep Learning Face Embedding
    # NOTE: Faces are now stored in SQL Server, not local folder
    face_config = config.get('face_recognition', {})
    face_config['database_path'] = str(Path(__file__).parent / "data" / "faces_db.pkl")  # Local cache only
    face_config['detection_interval'] = 5  # Process every 5 frames
    face_config['process_scale'] = 0.75  # Slightly lower resolution for speed
    face_config['threshold'] = 0.75  # Facenet512 cosine similarity threshold (75% minimum)
    
    # Backend API configuration - PRIMARY storage for faces
    face_config['backend_url'] = config.get('backend', {}).get('url', 'http://localhost:5000')
    face_config['auto_detection_enabled'] = True
    face_config['min_face_size'] = 80  # Minimum face width (px) - lowered for ~2-3m distance
    face_config['camera_id'] = current_camera_config.id if current_camera_config else 'camera_01'
    face_config['location'] = current_camera_config.location if current_camera_config else 'Cổng chính'
    
    if USE_EMBEDDING:
        face_recognizer = FaceEmbedding(face_config)
    else:
        face_recognizer = FastFaceRecognition(face_config)
    
    logger.info(f"✅ Face Recognition initialized ({len(face_recognizer.registered_faces)} faces from SQL Server)")
    
    return True
    
    return True


def process_frames():
    """Background thread for processing frames"""
    global current_frame, raw_frame, is_running, stats
    
    frame_count = 0
    fps_start = time.time()
    error_count = 0
    max_errors = 30  # Tăng lên 30 để tránh reconnect quá sớm (~1 giây @ 30fps)
    reconnect_cooldown = 0  # Thời gian chờ sau reconnect
    
    while is_running:
        try:
            if camera is None:
                time.sleep(0.1)
                continue
            
            # Skip reconnect cooldown period
            if reconnect_cooldown > 0:
                reconnect_cooldown -= 1
                time.sleep(0.033)  # ~30fps
                continue
            
            # IMPORTANT: Flush buffer to get latest frame and reduce latency
            # Read multiple frames quickly to skip buffered old frames
            if camera.cap and camera.cap.isOpened():
                for _ in range(2):  # Skip 2 buffered frames
                    camera.cap.grab()
            
            ret, frame = camera.read()
            if not ret or frame is None:
                error_count += 1
                logger.debug(f"Frame read failed ({error_count}/{max_errors})")
                
                if error_count > max_errors:
                    logger.warning("⚠️ Too many frame errors, attempting reconnect...")
                    if camera.reconnect():
                        logger.info("✅ Reconnect successful!")
                        error_count = 0
                        reconnect_cooldown = 30  # Wait 30 frames after reconnect
                    else:
                        logger.error("❌ Reconnect failed, will retry...")
                        error_count = max_errors - 5  # Retry sooner
                    time.sleep(0.5)  # Brief pause
                time.sleep(0.05)
                continue
            
            error_count = 0  # Reset on success
            frame_count += 1

            # Keep ORIGINAL frame at full resolution (1920x1080) for high quality stream
            original_frame = frame.copy()
            
            # Resize for processing (960x540 = balance quality & speed)
            process_frame = cv2.resize(frame, (960, 540))
            display_frame = process_frame.copy()
            
            # Lưu raw frame GỐC KHÔNG RESIZE (cho trang camera HQ)
            with frame_lock:
                raw_frame = original_frame.copy()  # Full resolution 1920x1080
            
            # Run AI if enabled
            if ai_settings["ai_enabled"]:
                # Fall Detection
                if ai_settings["fall_detection_enabled"] and fall_detector:
                    result = fall_detector.process_frame(process_frame)
                    display_frame = result.get('annotated_frame', display_frame)
                    
                    # Update stats
                    stats["state"] = result.get('state', 'unknown')
                    if hasattr(stats["state"], 'value'):
                        stats["state"] = stats["state"].value
                    
                    if result.get('fall_detected'):
                        stats["falls_detected"] += 1
                        # Emit fall event via WebSocket
                        socketio.emit('fall_detected', {
                            'timestamp': time.time(),
                            'confidence': result.get('confidence', 0.9)
                        })
                        
                        # Send fall alert to Backend API
                        try:
                            import requests
                            fall_event = result.get('fall_event')
                            frame_data = None
                            if fall_event and fall_event.frame_data:
                                frame_data = base64.b64encode(fall_event.frame_data).decode('utf-8')
                            
                            backend_url = load_config().get('backend', {}).get('url', 'http://localhost:5000')
                            # Lấy location từ camera đang sử dụng
                            camera_location = 'Không xác định'
                            if current_camera_config:
                                camera_location = current_camera_config.location
                            
                            alert_data = {
                                'patientId': None,  # Unknown patient
                                'location': camera_location,
                                'confidence': result.get('confidence', 0.9),
                                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                                'frameData': frame_data
                            }
                            
                            response = requests.post(
                                f"{backend_url}/api/fall-alert",
                                json=alert_data,
                                timeout=5
                            )
                            
                            if response.status_code in [200, 201]:
                                logger.info(f"✅ Fall alert sent to backend: {response.json()}")
                            else:
                                logger.warning(f"⚠️ Backend returned {response.status_code}: {response.text}")
                        except Exception as e:
                            logger.error(f"❌ Failed to send fall alert to backend: {e}")
                
                # Face Recognition
                if ai_settings["face_recognition_enabled"] and face_recognizer:
                    # Enable auto_record for automatic detection logging
                    auto_record = ai_settings.get("auto_detection_enabled", True)
                    show_box = ai_settings.get("show_bounding_box", True)
                    face_result = face_recognizer.process_frame(display_frame, auto_record=auto_record, show_bounding_box=show_box)
                    display_frame = face_result.get('annotated_frame', display_frame)
                    
                    # Update stats
                    stats["faces_recognized"] = face_result.get('recognized_count', 0)
                    
                    # Track recognized persons
                    recognized = [f for f in face_result.get('faces', []) if f.get('recognized')]
                    if recognized:
                        stats["recognized_persons"] = [
                            {'id': f['person_id'], 'name': f['person_name'], 'confidence': f['confidence']}
                            for f in recognized
                        ]
                        # Emit recognition event
                        socketio.emit('face_recognized', {
                            'timestamp': time.time(),
                            'persons': stats["recognized_persons"]
                        })
                    else:
                        # Clear recognized persons when no face detected
                        stats["recognized_persons"] = []
            
            # Calculate FPS
            elapsed = time.time() - fps_start
            if elapsed > 0:
                stats["fps"] = frame_count / elapsed
            
            # Add overlay
            overlay_y = 30
            cv2.putText(display_frame, f"FPS: {stats['fps']:.1f}", (10, overlay_y),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            if ai_settings["fall_detection_enabled"]:
                overlay_y += 25
                cv2.putText(display_frame, f"State: {stats['state']}", (10, overlay_y),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
            
            if ai_settings["face_recognition_enabled"]:
                overlay_y += 25
                cv2.putText(display_frame, f"Faces: {stats['faces_recognized']}", (10, overlay_y),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            
            # Update current frame
            with frame_lock:
                current_frame = display_frame.copy()
            
            # Small sleep to prevent CPU overload
            time.sleep(0.01)
            
        except Exception as e:
            logger.error(f"Frame processing error: {e}")
            time.sleep(0.1)


def generate_mjpeg():
    """Generate MJPEG stream with minimal latency"""
    while True:
        with frame_lock:
            if current_frame is None:
                time.sleep(0.005)
                continue
            frame = current_frame.copy()
        
        # Better quality for clearer face recognition (65%)
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 65])
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        time.sleep(0.033)  # ~30 FPS (enough for monitoring, saves bandwidth)


def generate_raw_mjpeg():
    """Generate RAW MJPEG stream without AI overlay (for registration page)"""
    while True:
        with frame_lock:
            if raw_frame is None:
                time.sleep(0.005)
                continue
            frame = raw_frame.copy()
        
        # Lower quality for faster transmission
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        time.sleep(0.033)  # ~30 FPS (enough for registration)


def generate_hq_mjpeg():
    """Generate HIGH QUALITY MJPEG stream without AI overlay (for camera monitoring page)"""
    while True:
        with frame_lock:
            if raw_frame is None:
                time.sleep(0.005)
                continue
            frame = raw_frame.copy()
        
        # High quality for best viewing experience (95%)
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        time.sleep(0.016)  # ~60 FPS for smooth playback


# ============== API Routes ==============

@app.route('/api/stream')
def video_stream():
    """MJPEG video stream endpoint (with AI overlay)"""
    return Response(generate_mjpeg(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/api/stream/raw')
def video_stream_raw():
    """RAW MJPEG video stream endpoint (without AI overlay - for registration)"""
    return Response(generate_raw_mjpeg(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/api/stream/hq')
def video_stream_hq():
    """HIGH QUALITY MJPEG video stream endpoint (best quality for camera monitoring)"""
    return Response(generate_hq_mjpeg(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/api/snapshot')
def snapshot():
    """Get current frame as JPEG"""
    with frame_lock:
        if current_frame is None:
            return jsonify({"error": "No frame available"}), 503
        frame = current_frame.copy()
    
    _, buffer = cv2.imencode('.jpg', frame)
    return Response(buffer.tobytes(), mimetype='image/jpeg')


@app.route('/api/settings', methods=['GET'])
def get_settings():
    """Get current AI settings"""
    return jsonify(ai_settings)


@app.route('/api/settings', methods=['POST'])
def update_settings():
    """Update AI settings"""
    global ai_settings
    data = request.json
    
    if 'ai_enabled' in data:
        ai_settings['ai_enabled'] = data['ai_enabled']
    if 'fall_detection_enabled' in data:
        ai_settings['fall_detection_enabled'] = data['fall_detection_enabled']
    if 'face_recognition_enabled' in data:
        ai_settings['face_recognition_enabled'] = data['face_recognition_enabled']
    if 'auto_detection_enabled' in data:
        ai_settings['auto_detection_enabled'] = data['auto_detection_enabled']
    if 'show_bounding_box' in data:
        ai_settings['show_bounding_box'] = data['show_bounding_box']
    
    logger.info(f"Settings updated: {ai_settings}")
    return jsonify(ai_settings)


@app.route('/api/stats')
def get_stats():
    """Get current stats"""
    return jsonify(stats)


@app.route('/api/camera/status')
def camera_status():
    """Get camera connection status with location info"""
    camera_info = {}
    if current_camera_config:
        camera_info = {
            "id": current_camera_config.id,
            "name": current_camera_config.name,
            "location": current_camera_config.location,
            "ip": current_camera_config.ip
        }
    
    return jsonify({
        "connected": camera is not None and camera.is_connected if camera else False,
        "running": is_running,
        "settings": ai_settings,
        "stats": stats,
        "camera": camera_info
    })


@app.route('/api/camera/info')
def camera_info():
    """Get current camera information including location"""
    if current_camera_config is None:
        return jsonify({"error": "No camera configured"}), 404
    
    return jsonify({
        "id": current_camera_config.id,
        "name": current_camera_config.name,
        "location": current_camera_config.location,
        "ip": current_camera_config.ip,
        "enabled": True
    })


@app.route('/api/faces/sync', methods=['POST'])
def sync_faces():
    """Sync face database with Backend API"""
    if face_recognizer is None:
        return jsonify({"error": "Face recognition not initialized"}), 503
    
    try:
        face_recognizer.sync_with_backend()
        return jsonify({
            "success": True,
            "message": "Synced with backend",
            "registered_count": len(face_recognizer.registered_faces),
            "detected_today": len(face_recognizer.detected_today)
        })
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/faces/reset-detections', methods=['POST'])
def reset_detections():
    """Reset detected today cache (for testing)"""
    if face_recognizer is None:
        return jsonify({"error": "Face recognition not initialized"}), 503
    
    face_recognizer.reset_detected_today()
    return jsonify({"success": True, "message": "Reset detected today cache"})


# ============== Face Recognition API ==============

@app.route('/api/faces/current-detection')
def current_detection():
    """Get currently detected faces (realtime status)"""
    return jsonify({
        "has_detection": len(stats.get("recognized_persons", [])) > 0,
        "persons": stats.get("recognized_persons", []),
        "timestamp": time.time()
    })


@app.route('/api/faces', methods=['GET'])
def list_faces():
    """List all registered faces"""
    if face_recognizer is None:
        return jsonify({"error": "Face recognition not initialized"}), 503
    
    faces = face_recognizer.list_registered()
    return jsonify({
        "count": len(faces),
        "faces": faces
    })


@app.route('/api/faces/<person_id>', methods=['GET'])
def get_face(person_id):
    """Get face details by ID"""
    if face_recognizer is None:
        return jsonify({"error": "Face recognition not initialized"}), 503
    
    if person_id in face_recognizer.registered_faces:
        face = face_recognizer.registered_faces[person_id]
        return jsonify({
            "person_id": face.person_id,
            "person_name": face.person_name,
            "person_type": face.person_type,
            "image_path": face.image_path
        })
    
    return jsonify({"error": "Face not found"}), 404


@app.route('/api/faces/<person_id>/image', methods=['GET'])
def get_face_image(person_id):
    """Get face image by ID"""
    if face_recognizer is None:
        return jsonify({"error": "Face recognition not initialized"}), 503
    
    # Look for image in faces folder
    faces_folder = Path('data/faces') / person_id
    if faces_folder.exists():
        # Return first image found
        for ext in ['*.jpg', '*.png', '*.jpeg']:
            for img_file in faces_folder.glob(ext):
                return send_file(str(img_file), mimetype='image/jpeg')
    
    return jsonify({"error": "Image not found"}), 404


@app.route('/api/faces/register', methods=['POST'])
def register_face():
    """
    Register a new face - saves image and embedding to SQL Server
    Supports: JPG, PNG, HEIC/HEIF
    
    Form data:
        - person_id: Mã y tế MAYTE (required)
        - person_name: Full name (required for display)
        - image: Image file (optional, uses current camera frame if not provided)
    """
    if face_recognizer is None:
        return jsonify({"error": "Face recognition not initialized"}), 503
    
    person_id = request.form.get('person_id')
    person_name = request.form.get('person_name')
    
    if not person_id:
        return jsonify({"error": "person_id (MAYTE) is required"}), 400
    
    # Get image from upload or current frame
    if 'image' in request.files:
        file = request.files['image']
        logger.info(f"📷 Received file: {file.filename}, content_type: {file.content_type}")
        if file.filename:
            # Read file content as bytes
            file_bytes = file.read()
            logger.info(f"📷 File size: {len(file_bytes)} bytes")
            
            # Use face_recognizer.read_image to handle HEIC and other formats
            frame = face_recognizer.read_image(file_bytes)
            
            if frame is None:
                logger.error(f"❌ Could not decode image from {file.filename}")
                return jsonify({
                    "success": False,
                    "error": "Không thể đọc file ảnh. Định dạng hỗ trợ: JPG, PNG, HEIC/HEIF"
                }), 400
            logger.info(f"✅ Image decoded: {frame.shape}")
        else:
            return jsonify({"error": "Empty file"}), 400
    else:
        # Use current camera frame
        with frame_lock:
            if current_frame is None:
                return jsonify({"error": "No camera frame available"}), 503
            frame = current_frame.copy()
    
    # IMPORTANT: Detect and crop face from image first!
    faces = face_recognizer._detect_faces(frame)
    if not faces:
        logger.warning(f"❌ No face detected in uploaded image for {person_id}")
        return jsonify({
            "success": False,
            "error": "Không phát hiện khuôn mặt trong ảnh. Vui lòng chọn ảnh có khuôn mặt rõ ràng."
        }), 400
    
    # Get the largest face (closest person)
    faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
    x, y, w, h = faces[0]
    face_crop = frame[y:y+h, x:x+w]
    
    logger.info(f"📸 Detected face for {person_id}: crop size {w}x{h} from image {frame.shape}")
    
    # Register face crop - saves to SQL Server via Backend API
    logger.info(f"👤 Registering face for {person_id} ({person_name or 'N/A'})")
    success, message = face_recognizer.register_face(person_id, face_crop, save_to_backend=True, person_name=person_name)
    logger.info(f"👤 Result: success={success}, message={message}")
    
    if success:
        # Get updated face count
        image_count = len(face_recognizer.registered_faces.get(person_id, []))
        return jsonify({
            "success": True,
            "message": message,
            "person_id": person_id,
            "person_name": person_name,
            "image_count": image_count
        })
    else:
        return jsonify({"success": False, "error": message}), 400


@app.route('/api/faces/register-from-camera', methods=['POST'])
def register_from_camera():
    """
    Register face from current camera view - saves to SQL Server
    
    JSON body:
        - person_id: MAYTE (required)
        - person_name: Full name (optional, for display)
    """
    if face_recognizer is None:
        return jsonify({"error": "Face recognition not initialized"}), 503
    
    data = request.json or {}
    person_id = data.get('person_id')
    person_name = data.get('person_name')
    
    if not person_id:
        return jsonify({"error": "person_id (MAYTE) is required"}), 400
    
    # Get RAW camera frame (without AI overlay/bounding boxes)
    # IMPORTANT: Use raw_frame, NOT current_frame which has overlays!
    with frame_lock:
        if raw_frame is None:
            return jsonify({"error": "No camera frame available"}), 503
        frame = raw_frame.copy()
    
    logger.info(f"📸 Register from camera: frame shape {frame.shape}")
    
    # IMPORTANT: Detect and crop face from frame first!
    faces = face_recognizer._detect_faces(frame)
    if not faces:
        logger.warning(f"❌ No face detected for {person_id}")
        return jsonify({"success": False, "error": "Không phát hiện khuôn mặt trong khung hình"}), 400
    
    # Get the largest face (closest person)
    faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
    x, y, w, h = faces[0]
    face_crop = frame[y:y+h, x:x+w]
    
    logger.info(f"📸 Registering face for {person_id}: crop size {w}x{h} from raw frame")
    
    # DEBUG: Save face crop for debugging
    import os
    debug_dir = os.path.join(os.path.dirname(__file__), 'debug_faces')
    os.makedirs(debug_dir, exist_ok=True)
    
    # Save original frame and face crop
    debug_frame_path = os.path.join(debug_dir, f'{person_id}_frame.jpg')
    debug_face_path = os.path.join(debug_dir, f'{person_id}_face_crop.jpg')
    cv2.imwrite(debug_frame_path, frame)
    cv2.imwrite(debug_face_path, face_crop)
    logger.info(f"🔍 DEBUG: Saved frame to {debug_frame_path}")
    logger.info(f"🔍 DEBUG: Saved face crop to {debug_face_path}")
    
    # DEBUG: Extract embedding and log
    debug_embedding = face_recognizer._extract_embedding(face_crop)
    if debug_embedding is not None:
        logger.info(f"🔍 DEBUG: Embedding extracted, first 5 values: {debug_embedding[:5]}")
        
        # Verify by reloading the saved image
        face_reloaded = cv2.imread(debug_face_path)
        emb_reloaded = face_recognizer._extract_embedding(face_reloaded)
        if emb_reloaded is not None:
            sim = face_recognizer._cosine_similarity(debug_embedding, emb_reloaded)
            logger.info(f"🔍 DEBUG: Similarity (original vs reloaded): {sim*100:.2f}%")
    
    # Register face crop - saves to SQL Server via Backend API
    success, message = face_recognizer.register_face(person_id, face_crop, save_to_backend=True, person_name=person_name)
    
    if success:
        # DEBUG: Verify registration by comparing with stored embedding
        if person_id in face_recognizer.registered_faces:
            stored_data = face_recognizer.registered_faces[person_id]
            if isinstance(stored_data, dict):
                stored_embs = stored_data.get('embeddings', [])
            else:
                stored_embs = stored_data
            if stored_embs:
                import numpy as np
                stored_emb = np.array(stored_embs[-1])  # Last registered
                if debug_embedding is not None:
                    sim_stored = face_recognizer._cosine_similarity(debug_embedding, stored_emb)
                    logger.info(f"🔍 DEBUG: Similarity (extracted vs stored): {sim_stored*100:.2f}%")
                    logger.info(f"🔍 DEBUG: Stored embedding first 5: {stored_emb[:5]}")
        
        image_count = len(face_recognizer.registered_faces.get(person_id, {}).get('embeddings', []) if isinstance(face_recognizer.registered_faces.get(person_id), dict) else face_recognizer.registered_faces.get(person_id, []))
        return jsonify({
            "success": True,
            "message": message,
            "person_id": person_id,
            "person_name": person_name,
            "image_count": image_count,
            "debug_face_path": debug_face_path  # Return path for debugging
        })
    else:
        return jsonify({"success": False, "error": message}), 400


@app.route('/api/faces/<person_id>', methods=['DELETE'])
def delete_face(person_id):
    """Delete a registered face"""
    if face_recognizer is None:
        return jsonify({"error": "Face recognition not initialized"}), 503
    
    if face_recognizer.delete_face(person_id):
        return jsonify({"success": True, "message": f"Deleted face: {person_id}"})
    else:
        return jsonify({"error": "Face not found"}), 404


@app.route('/api/faces/identify', methods=['POST'])
def identify_face():
    """
    Identify face in uploaded image
    
    Form data:
        - image: Image file
    """
    if face_recognizer is None:
        return jsonify({"error": "Face recognition not initialized"}), 503
    
    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400
    
    file = request.files['image']
    if not file.filename:
        return jsonify({"error": "Empty file"}), 400
    
    # Save and read image
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    frame = cv2.imread(filepath)
    os.remove(filepath)
    
    if frame is None:
        return jsonify({"error": "Could not read image"}), 400
    
    # Process frame
    result = face_recognizer.process_frame(frame)
    
    return jsonify({
        "total_faces": result.get('total_faces', 0),
        "recognized_count": result.get('recognized_count', 0),
        "faces": result.get('faces', [])
    })


@app.route('/api/faces/identify-from-camera', methods=['POST'])
def identify_from_camera():
    """
    Nhận diện khuôn mặt từ camera frame hiện tại
    Trả về danh sách người được nhận diện với MAYTE
    
    Returns:
        - success: bool
        - total_faces: số khuôn mặt phát hiện
        - recognized_count: số khuôn mặt nhận diện được
        - faces: danh sách thông tin khuôn mặt
        - snapshot: base64 encoded image với annotation
    """
    if face_recognizer is None:
        return jsonify({"success": False, "error": "Face recognition not initialized"}), 503
    
    # Get current camera frame
    with frame_lock:
        if current_frame is None:
            return jsonify({"success": False, "error": "No camera frame available"}), 503
        frame = current_frame.copy()
    
    # Process frame for face recognition
    result = face_recognizer.process_frame(frame)
    
    # Get annotated frame as base64
    annotated_frame = result.get('annotated_frame', frame)
    _, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    snapshot_base64 = base64.b64encode(buffer).decode('utf-8')
    
    # Extract recognized faces with their MAYTE (person_id)
    faces = []
    for face in result.get('faces', []):
        face_info = {
            'recognized': face.get('recognized', False),
            'confidence': face.get('confidence', 0),
            'bbox': face.get('bbox', [])
        }
        if face.get('recognized'):
            face_info['person_id'] = face.get('person_id', '')  # MAYTE
            face_info['person_name'] = face.get('person_name', '')
        faces.append(face_info)
    
    return jsonify({
        "success": True,
        "total_faces": result.get('total_faces', 0),
        "recognized_count": result.get('recognized_count', 0),
        "faces": faces,
        "snapshot": snapshot_base64
    })


# ============== WebSocket Events ==============

@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    emit('status', {'connected': True, 'settings': ai_settings})


@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")


@socketio.on('toggle_ai')
def handle_toggle_ai(data):
    global ai_settings
    ai_settings['ai_enabled'] = data.get('enabled', True)
    emit('settings_updated', ai_settings, broadcast=True)


@socketio.on('toggle_fall_detection')
def handle_toggle_fall(data):
    global ai_settings
    ai_settings['fall_detection_enabled'] = data.get('enabled', True)
    emit('settings_updated', ai_settings, broadcast=True)


@socketio.on('toggle_face_recognition')
def handle_toggle_face(data):
    global ai_settings
    ai_settings['face_recognition_enabled'] = data.get('enabled', True)
    logger.info(f"Face recognition: {'enabled' if ai_settings['face_recognition_enabled'] else 'disabled'}")
    emit('settings_updated', ai_settings, broadcast=True)


# ============== Main ==============

def main():
    global is_running
    
    print("=" * 60)
    print("🎥 CAMERA STREAMING SERVER")
    print("   Fall Detection + Face Recognition")
    print("=" * 60)
    
    # Initialize
    if not initialize_camera():
        print("❌ Failed to initialize. Exiting.")
        return
    
    # Start processing thread
    is_running = True
    process_thread = threading.Thread(target=process_frames, daemon=True)
    process_thread.start()
    
    print("\n✅ Server starting...")
    print("\n📹 Video Endpoints:")
    print("   MJPEG Stream: http://localhost:8080/api/stream")
    print("   Snapshot:     http://localhost:8080/api/snapshot")
    print("   WebSocket:    ws://localhost:8080")
    print("\n⚙️ Settings API:")
    print("   GET/POST:     http://localhost:8080/api/settings")
    print("   Status:       http://localhost:8080/api/camera/status")
    print("\n👤 Face Recognition API:")
    print("   List faces:   GET  http://localhost:8080/api/faces")
    print("   Register:     POST http://localhost:8080/api/faces/register")
    print("   From camera:  POST http://localhost:8080/api/faces/register-from-camera")
    print("   Delete:       DELETE http://localhost:8080/api/faces/<id>")
    print("   Identify:     POST http://localhost:8080/api/faces/identify")
    print("\n" + "=" * 60)
    
    # Run Flask with SocketIO
    socketio.run(app, host='0.0.0.0', port=8080, debug=False, allow_unsafe_werkzeug=True)


if __name__ == "__main__":
    main()
