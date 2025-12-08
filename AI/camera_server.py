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

# AI settings
ai_settings = {
    "ai_enabled": True,
    "fall_detection_enabled": True,
    "face_recognition_enabled": False,
    "auto_detection_enabled": True,  # Auto-record face detection to backend
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
    global camera, fall_detector, face_recognizer
    
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
        camera = HikvisionCamera(camera_configs[0])
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
    face_config = config.get('face_recognition', {})
    face_config['database_path'] = str(Path(__file__).parent / "data" / "faces_db.pkl")
    face_config['faces_folder'] = str(Path(__file__).parent / "data" / "faces")
    face_config['detection_interval'] = 5  # Process every 5 frames
    face_config['process_scale'] = 0.75  # Slightly lower resolution for speed
    face_config['threshold'] = 0.5  # Cosine similarity threshold (0.5 for embeddings)
    
    # Backend API configuration for auto-detection
    face_config['backend_url'] = config.get('backend', {}).get('url', 'http://localhost:5000')
    face_config['auto_detection_enabled'] = True
    face_config['min_face_size'] = 160  # Minimum face width (px) for auto-detection (~1m distance)
    face_config['camera_id'] = config.get('camera', {}).get('id', 'camera_01')
    face_config['location'] = config.get('camera', {}).get('location', 'Cổng chính')
    
    if USE_EMBEDDING:
        face_recognizer = FaceEmbedding(face_config)
    else:
        face_recognizer = FastFaceRecognition(face_config)
    
    logger.info(f"✅ Face Recognition initialized ({len(face_recognizer.registered_faces)} faces)")
    
    return True
    
    return True


def process_frames():
    """Background thread for processing frames"""
    global current_frame, raw_frame, is_running, stats
    
    frame_count = 0
    fps_start = time.time()
    error_count = 0
    max_errors = 10  # Max consecutive errors before reconnect
    
    while is_running:
        try:
            if camera is None:
                time.sleep(0.1)
                continue
            
            # IMPORTANT: Flush buffer to get latest frame and reduce latency
            # Read multiple frames quickly to skip buffered old frames
            for _ in range(2):  # Skip 2 buffered frames
                camera.cap.grab()
            
            ret, frame = camera.read()
            if not ret or frame is None:
                error_count += 1
                if error_count > max_errors:
                    logger.warning("Too many frame errors, attempting reconnect...")
                    camera.connect()
                    error_count = 0
                time.sleep(0.1)
                continue
            
            error_count = 0  # Reset on success
            frame_count += 1
            
            # Resize for processing
            process_frame = cv2.resize(frame, (1280, 720))
            display_frame = process_frame.copy()
            
            # Lưu raw frame (không có AI overlay) cho trang đăng ký
            with frame_lock:
                raw_frame = process_frame.copy()
            
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
                
                # Face Recognition
                if ai_settings["face_recognition_enabled"] and face_recognizer:
                    # Enable auto_record for automatic detection logging
                    auto_record = ai_settings.get("auto_detection_enabled", True)
                    face_result = face_recognizer.process_frame(display_frame, auto_record=auto_record)
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
                time.sleep(0.01)
                continue
            frame = current_frame.copy()
        
        # Lower quality for faster transmission
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        time.sleep(0.016)  # ~60 FPS for smoother stream


def generate_raw_mjpeg():
    """Generate RAW MJPEG stream without AI overlay (for registration page)"""
    while True:
        with frame_lock:
            if raw_frame is None:
                time.sleep(0.01)
                continue
            frame = raw_frame.copy()
        
        # Lower quality for faster transmission
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        time.sleep(0.016)  # ~60 FPS for smoother stream


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
    
    logger.info(f"Settings updated: {ai_settings}")
    return jsonify(ai_settings)


@app.route('/api/stats')
def get_stats():
    """Get current stats"""
    return jsonify(stats)


@app.route('/api/camera/status')
def camera_status():
    """Get camera connection status"""
    return jsonify({
        "connected": camera is not None and camera.is_connected if camera else False,
        "running": is_running,
        "settings": ai_settings,
        "stats": stats
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
    Register a new face - supports multiple images per person
    Supports: JPG, PNG, HEIC/HEIF
    
    Form data:
        - person_id: Mã y tế MAYTE (required)
        - person_name: Full name (required)
        - person_type: 'patient' or 'staff' (default: 'patient')
        - image: Image file (optional, uses current camera frame if not provided)
    """
    if face_recognizer is None:
        return jsonify({"error": "Face recognition not initialized"}), 503
    
    person_id = request.form.get('person_id')
    person_name = request.form.get('person_name')
    person_type = request.form.get('person_type', 'patient')
    
    if not person_id or not person_name:
        return jsonify({"error": "person_id and person_name are required"}), 400
    
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
    
    # Register face (supports adding multiple images per person)
    logger.info(f"👤 Registering face for {person_id} ({person_name})")
    success, message = face_recognizer.register_face(frame, person_id, person_name, person_type)
    logger.info(f"👤 Result: success={success}, message={message}")
    
    if success:
        # Get updated face info
        face_info = face_recognizer.get_face_info(person_id)
        return jsonify({
            "success": True,
            "message": message,
            "person_id": person_id,
            "person_name": person_name,
            "image_count": face_info.get('image_count', 1) if face_info else 1
        })
    else:
        return jsonify({"success": False, "error": message}), 400


@app.route('/api/faces/register-from-camera', methods=['POST'])
def register_from_camera():
    """
    Register face from current camera view
    
    JSON body:
        - person_id: Unique ID
        - person_name: Full name
        - person_type: 'patient' or 'staff'
    """
    if face_recognizer is None:
        return jsonify({"error": "Face recognition not initialized"}), 503
    
    data = request.json or {}
    person_id = data.get('person_id')
    person_name = data.get('person_name')
    person_type = data.get('person_type', 'patient')
    
    if not person_id or not person_name:
        return jsonify({"error": "person_id and person_name are required"}), 400
    
    # Get current camera frame
    with frame_lock:
        if current_frame is None:
            return jsonify({"error": "No camera frame available"}), 503
        frame = current_frame.copy()
    
    # Register face - save image to folder and register
    faces_folder = Path('data/faces') / person_id
    faces_folder.mkdir(parents=True, exist_ok=True)
    
    # Save image with timestamp
    import time
    timestamp = int(time.time())
    image_path = faces_folder / f"{person_id}_{timestamp}.jpg"
    cv2.imwrite(str(image_path), frame)
    
    # Register face feature
    success = face_recognizer.register_face(person_id, frame)
    
    if success:
        return jsonify({
            "success": True,
            "message": f"Face registered successfully for {person_name}",
            "person_id": person_id,
            "person_name": person_name
        })
    else:
        return jsonify({"success": False, "error": "Could not detect face in frame"}), 400


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
