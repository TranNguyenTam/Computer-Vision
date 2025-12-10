# face_embedding.py
# Deep Learning Face Recognition using DeepFace with Facenet512
# Accurate face recognition with 512-dimensional embeddings
# No custom ONNX models needed - uses pre-trained, verified models
# Supports loading embeddings from Backend API for auto-detection

import os
import pickle
import logging
import urllib.request
import requests
import base64
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set
from datetime import datetime, date
import numpy as np
import cv2

# Suppress TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

logger = logging.getLogger(__name__)

class FaceEmbedding:
    """
    Deep Learning Face Recognition using DeepFace library.
    Uses Facenet512 for accurate 512-dimensional face embeddings.
    
    Workflow:
    1. Detect faces using OpenCV DNN (SSD) - fast and accurate
    2. Extract 512-dim embedding using Facenet512 via DeepFace
    3. Compare embeddings using cosine similarity
    4. Match with registered faces in database
    
    Auto-Detection Mode:
    - Load embeddings from Backend API (SQL Server)
    - Auto-detect faces when person approaches camera
    - Record detection to history (one per person per day)
    """
    
    # Model URLs for face detector
    DETECTOR_MODELS = {
        'prototxt': 'https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt',
        'caffemodel': 'https://github.com/opencv/opencv_3rdparty/raw/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel'
    }
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.database_path = self.config.get('database_path', 'data/face_embeddings.pkl')
        # NOTE: faces_folder deprecated - faces are now stored in SQL Server
        self.model_dir = Path(self.config.get('model_dir', 'models'))
        self.detection_interval = self.config.get('detection_interval', 3)
        self.process_scale = self.config.get('process_scale', 0.5)
        
        # Backend API configuration
        self.backend_url = self.config.get('backend_url', 'http://localhost:5000')
        self.auto_detection_enabled = self.config.get('auto_detection_enabled', True)
        self.camera_id = self.config.get('camera_id', 'camera_01')
        self.location = self.config.get('location', 'Cổng chính')
        
        # Minimum face size for auto-detection (person must be close enough)
        # Face width >= min_face_size (pixels) = person is close
        self.min_face_size = self.config.get('min_face_size', 100)
        
        # Facenet512 threshold: distance < 0.4 = same person (verified)
        # Distance 0.4 corresponds to ~0.6 similarity
        self.threshold = self.config.get('threshold', 0.6)  # Similarity threshold
        self.embedding_size = 512  # Facenet512 uses 512-dim embeddings
        
        # Face database: person_id -> list of embeddings
        self.registered_faces: Dict[str, List[np.ndarray]] = {}
        self.face_detector = None
        self.deepface_available = False
        self.use_gpu = False
        self.frame_count = 0
        self.last_results = []
        
        # Auto-detection: track who has been detected today
        self.detected_today: Set[str] = set()
        self.detection_date: date = date.today()
        
        # Performance: cache last recognized person to avoid repeated processing
        self.last_recognized_id: Optional[str] = None
        self.last_recognized_time: float = 0
        self.recognition_cooldown: float = 3.0  # seconds between same person recognition
        
        # Performance: cache last face bbox to track if same face
        self.last_face_bbox: Optional[Tuple[int, int, int, int]] = None
        self.same_face_threshold: int = 50  # pixels - if face moved less than this, consider same
        
        # Performance: preloaded DeepFace model (disabled - using DeepFace.represent instead)
        self.deepface_model = None
        
        self._initialize_models()
        self._load_database()
    
    def _download_file(self, url: str, filepath: Path) -> bool:
        """Download file from URL"""
        try:
            logger.info(f"Downloading: {url}")
            urllib.request.urlretrieve(url, str(filepath))
            return True
        except Exception as e:
            logger.warning(f"Failed to download {url}: {e}")
            return False
    
    def _initialize_models(self):
        """Initialize face detection and embedding models"""
        self.model_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize face detector (OpenCV DNN SSD)
        self._init_face_detector()
        
        # Initialize DeepFace for embeddings
        self._init_deepface()
    
    def _init_face_detector(self):
        """Initialize OpenCV DNN face detector"""
        prototxt_path = self.model_dir / 'deploy.prototxt'
        caffemodel_path = self.model_dir / 'res10_300x300_ssd_iter_140000.caffemodel'
        
        # Download if not exists
        if not prototxt_path.exists():
            self._download_file(self.DETECTOR_MODELS['prototxt'], prototxt_path)
        
        if not caffemodel_path.exists():
            self._download_file(self.DETECTOR_MODELS['caffemodel'], caffemodel_path)
        
        try:
            self.face_detector = cv2.dnn.readNetFromCaffe(str(prototxt_path), str(caffemodel_path))
            logger.info("✅ Face Detector initialized (OpenCV DNN SSD)")
        except Exception as e:
            logger.error(f"Failed to load face detector: {e}")
            # Fallback to Haar Cascade
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            self.face_detector = cv2.CascadeClassifier(cascade_path)
            logger.info("✅ Face Detector initialized (Haar Cascade fallback)")
    
    def _init_deepface(self):
        """Initialize DeepFace with Facenet512 model - gracefully handle failures"""
        try:
            # Test import first to catch TensorFlow/Python version issues
            import tensorflow as tf
            from deepface import DeepFace
            from deepface.modules import verification
            
            # Pre-load Facenet512 model (this will download if needed)
            logger.info("Loading Facenet512 model (this may take a moment on first run)...")
            
            # Create a small dummy image to trigger model loading
            dummy_img = np.zeros((160, 160, 3), dtype=np.uint8)
            dummy_img[50:110, 50:110] = 128  # Add some content
            
            # Save temp image and run embedding to load model
            temp_path = self.model_dir / 'temp_init.jpg'
            cv2.imwrite(str(temp_path), dummy_img)
            
            try:
                # This will download and load the model
                DeepFace.represent(
                    img_path=str(temp_path),
                    model_name='Facenet512',
                    enforce_detection=False
                )
            except:
                pass  # May fail on dummy image, that's ok
            finally:
                if temp_path.exists():
                    temp_path.unlink()
            
            self.deepface_available = True
            
            # Check if GPU is available via TensorFlow
            try:
                import tensorflow as tf
                gpus = tf.config.list_physical_devices('GPU')
                self.use_gpu = len(gpus) > 0
                gpu_info = f"GPU ({gpus[0].name})" if self.use_gpu else "CPU"
            except:
                gpu_info = "CPU"
            
            logger.info(f"✅ Facenet512 initialized via DeepFace (dim=512, {gpu_info})")
            logger.info(f"   Similarity threshold: {self.threshold}")
            
        except ImportError:
            logger.warning("⚠️ DeepFace not installed, using simple histogram fallback")
            self.deepface_available = False
        except Exception as e:
            logger.warning(f"⚠️ DeepFace/TensorFlow error (Python version issue?): {type(e).__name__}")
            logger.warning("   Using simple histogram embedding instead (less accurate)")
            self.deepface_available = False
    
    def _detect_faces(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """Detect faces in image, returns list of (x, y, w, h)"""
        h, w = image.shape[:2]
        
        if hasattr(self.face_detector, 'forward'):
            # DNN detector
            blob = cv2.dnn.blobFromImage(image, 1.0, (300, 300), (104.0, 177.0, 123.0))
            self.face_detector.setInput(blob)
            detections = self.face_detector.forward()
            
            faces = []
            for i in range(detections.shape[2]):
                confidence = detections[0, 0, i, 2]
                if confidence > 0.5:
                    box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                    x1, y1, x2, y2 = box.astype(int)
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(w, x2), min(h, y2)
                    if x2 > x1 and y2 > y1:
                        faces.append((x1, y1, x2 - x1, y2 - y1))
            return faces
        else:
            # Haar Cascade
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
            return list(self.face_detector.detectMultiScale(gray, 1.1, 4, minSize=(30, 30)))
    
    def _extract_embedding(self, face_img: np.ndarray) -> Optional[np.ndarray]:
        """Extract face embedding using DeepFace Facenet512"""
        try:
            if self.deepface_available:
                from deepface import DeepFace
                
                # DeepFace.represent with skip detector (we already have face ROI)
                result = DeepFace.represent(
                    img_path=face_img,
                    model_name='Facenet512',
                    enforce_detection=False,
                    detector_backend='skip'
                )
                
                if result and len(result) > 0:
                    embedding = np.array(result[0]['embedding'])
                    # Normalize embedding (L2)
                    embedding = embedding / (np.linalg.norm(embedding) + 1e-6)
                    return embedding
            
            # Fallback to simple histogram embedding
            return self._extract_simple_embedding(face_img)
            
        except Exception as e:
            logger.warning(f"Embedding extraction failed: {e}")
            return self._extract_simple_embedding(face_img)
    
    def _extract_simple_embedding(self, face_img: np.ndarray) -> Optional[np.ndarray]:
        """Simple histogram-based embedding (fallback)"""
        try:
            gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY) if len(face_img.shape) == 3 else face_img
            face = cv2.resize(gray, (128, 128))
            face = cv2.equalizeHist(face)
            
            # Histogram
            hist = cv2.calcHist([face], [0], None, [64], [0, 256])
            hist = cv2.normalize(hist, hist).flatten()
            
            # Texture features
            gx = cv2.Sobel(face, cv2.CV_64F, 1, 0, ksize=3)
            gy = cv2.Sobel(face, cv2.CV_64F, 0, 1, ksize=3)
            magnitude = np.sqrt(gx**2 + gy**2)
            
            cell_h, cell_w = 32, 32
            texture = []
            for i in range(4):
                for j in range(4):
                    cell = magnitude[i*cell_h:(i+1)*cell_h, j*cell_w:(j+1)*cell_w]
                    texture.append(np.mean(cell))
            texture = np.array(texture)
            texture = texture / (np.max(texture) + 1e-6)
            
            # Pad to 512 dimensions to match Facenet512
            embedding = np.concatenate([hist, texture])
            embedding = np.pad(embedding, (0, 512 - len(embedding)), mode='constant')
            embedding = embedding / (np.linalg.norm(embedding) + 1e-6)
            return embedding
        except:
            return None
    
    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Compute cosine similarity between two embeddings"""
        if a is None or b is None:
            return 0.0
        
        # Ensure same size
        if len(a) != len(b):
            return 0.0
        
        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return float(dot / (norm_a * norm_b))
    
    def _load_database(self):
        """Load face database - PRIMARY from SQL Server via Backend API"""
        # First, try to load from Backend API (SQL Server) - PRIMARY SOURCE
        backend_loaded = self._load_from_backend()
        
        if not backend_loaded:
            # Fallback: load from local pickle file (cache)
            if os.path.exists(self.database_path):
                try:
                    with open(self.database_path, 'rb') as f:
                        self.registered_faces = pickle.load(f)
                    logger.info(f"✅ Loaded {len(self.registered_faces)} faces from local cache")
                except Exception as e:
                    logger.warning(f"Failed to load local cache: {e}")
                    self.registered_faces = {}
        
        # Load today's detections from backend
        self._load_detected_today()
    
    def _load_from_backend(self) -> bool:
        """Load embeddings from Backend API (SQL Server) - PRIMARY SOURCE"""
        try:
            response = requests.get(
                f"{self.backend_url}/api/face/embeddings",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('data'):
                    # Clear existing and load fresh from SQL Server
                    self.registered_faces = {}
                    count = 0
                    
                    for item in data['data']:
                        mayte = item.get('maYTe')
                        embeddings_list = item.get('embeddings', [])
                        
                        if not mayte or not embeddings_list:
                            continue
                        
                        # Load embeddings for this person
                        person_embeddings = []
                        for emb_data in embeddings_list:
                            vector = emb_data.get('vector')
                            if vector:
                                embedding = np.array(vector, dtype=np.float32)
                                # Normalize
                                embedding = embedding / (np.linalg.norm(embedding) + 1e-6)
                                person_embeddings.append(embedding)
                        
                        if person_embeddings:
                            self.registered_faces[mayte] = person_embeddings
                            count += 1
                    
                    logger.info(f"✅ Loaded {count} patients from SQL Server (Backend API)")
                    
                    # Save to local cache for offline fallback
                    self._save_database()
                    return True
                    
        except requests.exceptions.ConnectionError:
            logger.warning("⚠️ Backend API not available, will use local cache")
            return False
        except Exception as e:
            logger.warning(f"Failed to load from backend: {e}")
            return False
        
        return False
    
    def _load_detected_today(self):
        """Load list of people already detected today from Backend"""
        try:
            # Reset if new day
            if date.today() != self.detection_date:
                self.detected_today = set()
                self.detection_date = date.today()
            
            response = requests.get(
                f"{self.backend_url}/api/face/detections/today/mayte-list",
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('data'):
                    self.detected_today = set(data['data'])
                    logger.info(f"📋 Loaded {len(self.detected_today)} detections from today")
                    
        except Exception as e:
            logger.debug(f"Could not load today's detections: {e}")
    
    # DEPRECATED: No longer used - faces are now stored in SQL Server
    # Keeping for reference only
    def _load_from_folder_deprecated(self):
        """[DEPRECATED] Load faces from folder structure - NOT USED ANYMORE
        Faces are now stored in SQL Server via Backend API.
        This method is kept for reference only."""
        pass
    
    def _save_database(self):
        """Save face database to file"""
        try:
            os.makedirs(os.path.dirname(self.database_path), exist_ok=True)
            with open(self.database_path, 'wb') as f:
                pickle.dump(self.registered_faces, f)
            logger.debug("Database saved")
        except Exception as e:
            logger.warning(f"Failed to save database: {e}")
    
    def _record_detection(self, person_id: str, similarity: float) -> bool:
        """Record auto-detection to Backend API (once per person per day)"""
        try:
            # Check if new day, reset cache
            if date.today() != self.detection_date:
                self.detected_today = set()
                self.detection_date = date.today()
                self._load_detected_today()
            
            # Skip if already detected today
            if person_id in self.detected_today:
                return False
            
            # Call Backend API
            response = requests.post(
                f"{self.backend_url}/api/face/detection",
                json={
                    'maYTe': person_id,
                    'confidence': float(similarity),
                    'cameraId': self.camera_id,
                    'location': self.location
                },
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.detected_today.add(person_id)
                    patient_name = data.get('patientName', person_id)
                    already = data.get('alreadyRecorded', False)
                    
                    if not already:
                        logger.info(f"📝 Recorded detection: {patient_name} ({person_id})")
                        return True
                    else:
                        logger.debug(f"Already recorded today: {person_id}")
            
            return False
            
        except Exception as e:
            logger.warning(f"Failed to record detection: {e}")
            return False
    
    def save_embedding_to_backend(self, person_id: str, embedding: np.ndarray, 
                                   image_path: str = None) -> bool:
        """Save embedding to Backend API (SQL Server)"""
        try:
            response = requests.post(
                f"{self.backend_url}/api/face/embeddings",
                json={
                    'maYTe': person_id,
                    'embedding': embedding.tolist(),
                    'imagePath': image_path,
                    'modelName': 'Facenet512'
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    logger.info(f"✅ Saved embedding to backend: {person_id}")
                    return True
            
            return False
            
        except Exception as e:
            logger.warning(f"Failed to save embedding to backend: {e}")
            return False
    
    def _find_match(self, embedding: np.ndarray) -> Tuple[Optional[str], float]:
        """Find best matching person in database"""
        best_match = None
        best_similarity = 0.0
        
        for person_id, person_embeddings in self.registered_faces.items():
            for ref_embedding in person_embeddings:
                similarity = self._cosine_similarity(embedding, ref_embedding)
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match = person_id
        
        # Only return match if above threshold
        if best_similarity >= self.threshold:
            return best_match, best_similarity
        
        return None, best_similarity
    
    def register_face(self, person_id: str, face_img: np.ndarray, 
                       save_to_backend: bool = True) -> Tuple[bool, str]:
        """Register a new face for a person
        
        Args:
            person_id: Patient ID (MAYTE)
            face_img: Face image (BGR)
            save_to_backend: If True, also save image and embedding to Backend API (SQL Server)
            
        Returns:
            Tuple of (success: bool, message: str)
        """
        try:
            # Extract embedding
            embedding = self._extract_embedding(face_img)
            if embedding is None:
                return False, "Không thể trích xuất đặc trưng khuôn mặt"
            
            # Add to local cache (memory)
            if person_id not in self.registered_faces:
                self.registered_faces[person_id] = []
            
            self.registered_faces[person_id].append(embedding)
            self._save_database()  # Save to local pickle (cache)
            
            # Save to Backend API (SQL Server) - PRIMARY STORAGE
            if save_to_backend:
                success = self._register_face_to_backend(person_id, face_img, embedding)
                if success:
                    logger.info(f"✅ Registered face for {person_id} to SQL Server")
                    return True, f"Đã đăng ký khuôn mặt cho bệnh nhân {person_id}"
                else:
                    logger.warning(f"⚠️ Saved locally but failed to save to SQL Server")
                    return True, "Đã lưu cục bộ, nhưng không lưu được vào SQL Server"
            
            logger.info(f"✅ Registered face for person {person_id} (local only)")
            return True, f"Đã đăng ký khuôn mặt cho {person_id}"
        except Exception as e:
            logger.error(f"Failed to register face: {e}")
            return False, f"Lỗi: {str(e)}"
    
    def _register_face_to_backend(self, person_id: str, face_img: np.ndarray, 
                                   embedding: np.ndarray) -> bool:
        """Register face embedding to Backend API (SQL Server)
        NOTE: Chỉ lưu embedding, không lưu ảnh gốc để tiết kiệm dung lượng
        """
        try:
            # Call Backend API - chỉ gửi embedding, không gửi ảnh
            response = requests.post(
                f"{self.backend_url}/api/face/register",
                json={
                    'maYTe': person_id,
                    'embedding': embedding.tolist(),
                    'modelName': 'Facenet512'
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    logger.info(f"✅ Saved embedding to SQL Server: {person_id}, imageId: {data.get('imageId')}")
                    return True
                else:
                    logger.warning(f"Backend error: {data.get('message')}")
            else:
                logger.warning(f"Backend returned {response.status_code}: {response.text}")
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to register face to backend: {e}")
            return False
    
    def identify_faces(self, frame: np.ndarray, auto_record: bool = False) -> List[Dict]:
        """Identify all faces in frame
        
        Args:
            frame: Input image (BGR)
            auto_record: If True, automatically record detections to backend
                        (only for faces that are close enough)
        """
        import time as time_module
        results = []
        current_time = time_module.time()
        
        # Detect faces
        faces = self._detect_faces(frame)
        
        # Performance: if no faces, clear cache and return early
        if not faces:
            self.last_face_bbox = None
            return results
        
        # Performance: only process the largest face (closest person)
        if len(faces) > 1:
            faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)[:1]
        
        for x, y, w, h in faces:
            face_img = frame[y:y+h, x:x+w]
            
            # Check if face is large enough (person is close)
            is_close = w >= self.min_face_size
            
            # Performance: skip if face is too small (too far)
            if not is_close:
                results.append({
                    'bbox': (x, y, w, h),
                    'person_id': None,
                    'similarity': 0.0,
                    'status': 'too_far',
                    'is_close': False
                })
                continue
            
            # Performance: check if same face position (person hasn't moved)
            if self.last_face_bbox is not None:
                lx, ly, lw, lh = self.last_face_bbox
                dx = abs(x - lx)
                dy = abs(y - ly)
                # If face is in roughly same position and recently recognized
                if dx < self.same_face_threshold and dy < self.same_face_threshold:
                    time_since_last = current_time - self.last_recognized_time
                    if time_since_last < self.recognition_cooldown and self.last_recognized_id:
                        # Use cached result
                        results.append({
                            'bbox': (x, y, w, h),
                            'person_id': self.last_recognized_id,
                            'similarity': 0.95,  # High confidence for cache
                            'status': 'matched',
                            'is_close': True,
                            'cached': True
                        })
                        continue
            
            # Update face bbox cache
            self.last_face_bbox = (x, y, w, h)
            
            # Extract embedding
            embedding = self._extract_embedding(face_img)
            if embedding is None:
                results.append({
                    'bbox': (x, y, w, h),
                    'person_id': None,
                    'similarity': 0.0,
                    'status': 'unknown',
                    'is_close': is_close
                })
                continue
            
            # Find match
            person_id, similarity = self._find_match(embedding)
            
            result = {
                'bbox': (x, y, w, h),
                'person_id': person_id,
                'similarity': similarity,
                'status': 'matched' if person_id else 'unknown',
                'is_close': is_close
            }
            results.append(result)
            
            if person_id:
                # Update recognition cache
                self.last_recognized_id = person_id
                self.last_recognized_time = current_time
                
                logger.debug(f"🔍 Face match: {person_id} (similarity={similarity:.3f}, close={is_close})")
                
                # Auto-record detection if enabled and face is close enough
                if auto_record and self.auto_detection_enabled and is_close:
                    self._record_detection(person_id, similarity)
            else:
                # Unknown face - clear cache
                self.last_recognized_id = None
        
        return results
    
    def process_frame(self, frame: np.ndarray, auto_record: bool = False) -> Dict:
        """Process a video frame for face recognition
        
        Args:
            frame: Input video frame (BGR)
            auto_record: If True, automatically record detections to backend
        
        Returns dict compatible with camera_server.py:
        {
            'annotated_frame': np.ndarray,
            'faces': List[Dict],
            'recognized_count': int
        }
        """
        self.frame_count += 1
        
        # Only process every N frames for performance
        if self.frame_count % self.detection_interval != 0:
            # Use last results
            annotated = self._annotate_frame(frame, self.last_results)
            recognized = [f for f in self.last_results if f.get('person_id')]
            return {
                'annotated_frame': annotated,
                'faces': [self._convert_result(r) for r in recognized],  # Only recognized faces
                'recognized_count': len(recognized)
            }
        
        # Resize for faster processing
        h, w = frame.shape[:2]
        if self.process_scale < 1.0:
            small = cv2.resize(frame, None, fx=self.process_scale, fy=self.process_scale)
        else:
            small = frame
        
        # Identify faces (with auto-record if enabled)
        results = self.identify_faces(small, auto_record=auto_record)
        
        # Scale back coordinates if needed
        if self.process_scale < 1.0:
            scale = 1.0 / self.process_scale
            for r in results:
                x, y, w_box, h_box = r['bbox']
                r['bbox'] = (int(x * scale), int(y * scale), 
                            int(w_box * scale), int(h_box * scale))
        
        self.last_results = results
        
        # Annotate frame
        annotated = self._annotate_frame(frame, results)
        
        # Only return recognized faces (confidence >= threshold)
        recognized = [f for f in results if f.get('person_id')]
        return {
            'annotated_frame': annotated,
            'faces': [self._convert_result(r) for r in recognized],  # Only recognized faces
            'recognized_count': len(recognized)
        }
    
    def _convert_result(self, r: Dict) -> Dict:
        """Convert internal result to camera_server format"""
        return {
            'person_id': r.get('person_id'),
            'person_name': r.get('person_id'),  # Use ID as name for now
            'confidence': r.get('similarity', 0),
            'recognized': r.get('person_id') is not None,
            'bbox': r.get('bbox')
        }
    
    def _annotate_frame(self, frame: np.ndarray, results: List[Dict]) -> np.ndarray:
        """Draw face recognition results on frame
        Only show boxes for recognized faces (confidence >= threshold)
        """
        annotated = frame.copy()
        
        for r in results:
            x, y, w, h = r['bbox']
            person_id = r.get('person_id')
            similarity = r.get('similarity', 0)
            
            # Only draw box for recognized faces (confidence >= 80%)
            if person_id:
                # Matched - green box
                color = (0, 255, 0)
                label = f"{person_id} ({similarity*100:.0f}%)"
                
                # Draw box
                cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 2)
                
                # Draw label background
                (label_w, label_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                cv2.rectangle(annotated, (x, y - label_h - 10), (x + label_w, y), color, -1)
                
                # Draw label text
                cv2.putText(annotated, label, (x, y - 5), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            # Skip drawing for unknown/low confidence faces
        
        return annotated
    
    def reload_database(self):
        """Reload face database (call after adding new images)"""
        self.registered_faces = {}
        self._load_database()
        logger.info(f"🔄 Reloaded database: {len(self.registered_faces)} persons")
    
    def sync_with_backend(self):
        """Sync database with Backend API"""
        self._load_from_backend()
        self._load_detected_today()
        logger.info(f"🔄 Synced with backend: {len(self.registered_faces)} persons, "
                   f"{len(self.detected_today)} detected today")
    
    def reset_detected_today(self):
        """Reset detected today cache (for testing)"""
        self.detected_today = set()
        self.detection_date = date.today()
        logger.info("🔄 Reset detected today cache")
    
    def get_registered_persons(self) -> List[str]:
        """Get list of registered person IDs"""
        return list(self.registered_faces.keys())
    
    def list_registered(self) -> List[Dict]:
        """List all registered faces with details (for API compatibility)"""
        result = []
        for person_id, embeddings in self.registered_faces.items():
            result.append({
                'id': person_id,
                'person_id': person_id,
                'name': person_id,  # Use ID as name
                'face_count': len(embeddings),
                'embedding_count': len(embeddings)
            })
        return result
    
    def remove_person(self, person_id: str) -> bool:
        """Remove a person from database (SQL Server + local cache)"""
        removed = False
        
        # 1. Remove from memory (registered_faces dictionary)
        if person_id in self.registered_faces:
            del self.registered_faces[person_id]
            self._save_database()
            logger.info(f"🗑️ Removed person {person_id} from local cache")
            removed = True
        
        # 2. Delete from Backend API (SQL Server) - PRIMARY
        if self._delete_from_backend(person_id):
            logger.info(f"🗑️ Deleted {person_id} from SQL Server")
            removed = True
        
        return removed
    
    def _delete_from_backend(self, person_id: str) -> bool:
        """Delete face data from Backend API"""
        try:
            url = f"{self.backend_url}/api/face/patient/{person_id}"
            response = requests.delete(url, timeout=10)
            if response.status_code == 200:
                logger.info(f"🗑️ Deleted {person_id} from Backend database")
                return True
            else:
                logger.warning(f"Backend delete returned {response.status_code}")
                return False
        except Exception as e:
            logger.warning(f"Failed to delete from backend: {e}")
            return False
    
    def delete_face(self, person_id: str) -> bool:
        """Delete a face from database (alias for remove_person)"""
        return self.remove_person(person_id)


# Test function
def test_face_embedding():
    """Test FaceEmbedding functionality"""
    import time
    
    print("=" * 60)
    print("Testing FaceEmbedding with DeepFace Facenet512")
    print("=" * 60)
    
    # Initialize
    config = {
        'faces_folder': 'data/faces',
        'threshold': 0.6  # Cosine similarity threshold
    }
    
    print("\n1. Initializing FaceEmbedding...")
    start = time.time()
    fe = FaceEmbedding(config)
    print(f"   Init time: {time.time() - start:.2f}s")
    print(f"   DeepFace available: {fe.deepface_available}")
    print(f"   Registered persons: {fe.get_registered_persons()}")
    
    # Test with camera or image
    print("\n2. Testing face recognition...")
    
    # Load a test image from faces folder
    test_dirs = os.listdir('data/faces') if os.path.exists('data/faces') else []
    if test_dirs:
        test_dir = os.path.join('data/faces', test_dirs[0])
        test_images = [f for f in os.listdir(test_dir) if f.endswith('.jpg')]
        if test_images:
            test_path = os.path.join(test_dir, test_images[0])
            print(f"   Loading test image: {test_path}")
            
            img = cv2.imread(test_path)
            if img is not None:
                start = time.time()
                results = fe.identify_faces(img)
                print(f"   Recognition time: {time.time() - start:.3f}s")
                print(f"   Results: {results}")
    
    print("\n" + "=" * 60)
    print("Test complete!")
    print("=" * 60)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    test_face_embedding()
