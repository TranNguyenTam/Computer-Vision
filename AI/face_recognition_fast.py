# face_recognition_fast.py
# Fast CPU-based Face Recognition using OpenCV DNN (no compile needed)
# Compatible with Python 3.13+

import os
import pickle
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import numpy as np
import cv2

logger = logging.getLogger(__name__)

class FastFaceRecognition:
    """
    Fast CPU-based face recognition using OpenCV DNN.
    Uses Haar Cascade for detection + histogram comparison for simple matching.
    No external compilation required - works out of the box.
    """
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.database_path = self.config.get('database_path', 'data/faces_db.pkl')
        self.faces_folder = self.config.get('faces_folder', 'data/faces')
        self.detection_interval = self.config.get('detection_interval', 5)
        self.process_scale = self.config.get('process_scale', 0.5)
        self.threshold = self.config.get('threshold', 0.6)
        
        self.registered_faces: Dict[str, List[np.ndarray]] = {}  # person_id -> list of face histograms
        self.face_detector = None
        self.frame_count = 0
        self.last_results = []
        
        self._initialize_models()
        self._load_database()
    
    def _initialize_models(self):
        """Initialize face detection using OpenCV Haar Cascade"""
        # Use OpenCV's built-in Haar Cascade - no compilation needed
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_detector = cv2.CascadeClassifier(cascade_path)
        
        if self.face_detector.empty():
            logger.error("❌ Failed to load Haar Cascade classifier")
        else:
            logger.info("✅ OpenCV Face Detection initialized (Haar Cascade)")
    
    def _load_database(self):
        """Load registered faces from database or folder"""
        # Try to load from pickle file first
        if os.path.exists(self.database_path):
            try:
                with open(self.database_path, 'rb') as f:
                    data = pickle.load(f)
                    self.registered_faces = data.get('faces', {})
                logger.info(f"📂 Loaded {len(self.registered_faces)} faces from database")
                return
            except Exception as e:
                logger.warning(f"Could not load database: {e}")
        
        # Otherwise, scan faces folder and build features
        self._scan_faces_folder()
    
    def _scan_faces_folder(self):
        """Scan faces folder and build face features for each person"""
        faces_path = Path(self.faces_folder)
        if not faces_path.exists():
            logger.warning(f"Faces folder not found: {self.faces_folder}")
            return
        
        for person_folder in faces_path.iterdir():
            if person_folder.is_dir():
                person_id = person_folder.name
                face_features = []
                
                # Process jpg and png files
                for ext in ['*.jpg', '*.png', '*.jpeg']:
                    for img_file in person_folder.glob(ext):
                        img = cv2.imread(str(img_file))
                        if img is not None:
                            feature = self._extract_face_feature(img)
                            if feature is not None:
                                face_features.append(feature)
                
                if face_features:
                    self.registered_faces[person_id] = face_features
                    logger.info(f"  ✅ Registered: {person_id} ({len(face_features)} images)")
        
        # Save database
        self._save_database()
    
    def _save_database(self):
        """Save registered faces to pickle file"""
        try:
            db_dir = os.path.dirname(self.database_path)
            if db_dir:
                os.makedirs(db_dir, exist_ok=True)
            with open(self.database_path, 'wb') as f:
                pickle.dump({'faces': self.registered_faces}, f)
            logger.info(f"💾 Saved database with {len(self.registered_faces)} faces")
        except Exception as e:
            logger.error(f"Could not save database: {e}")
    
    def _extract_face_feature(self, image: np.ndarray) -> Optional[np.ndarray]:
        """
        Extract face feature from image using histogram + LBP-like features.
        This is a simple but effective approach for face matching.
        """
        try:
            # Convert to grayscale
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image
            
            # Detect face in image
            faces = self.face_detector.detectMultiScale(gray, 1.1, 4, minSize=(30, 30))
            
            if len(faces) == 0:
                # If no face detected, use the whole image
                face_roi = gray
            else:
                # Use the largest face
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                face_roi = gray[y:y+h, x:x+w]
            
            # Resize to standard size for comparison
            face_resized = cv2.resize(face_roi, (128, 128))
            
            # Apply histogram equalization for lighting normalization
            face_eq = cv2.equalizeHist(face_resized)
            
            # Extract features:
            # 1. Histogram of pixel values
            hist = cv2.calcHist([face_eq], [0], None, [64], [0, 256])
            hist = cv2.normalize(hist, hist).flatten()
            
            # 2. Simple LBP-like texture features (gradient magnitudes)
            gx = cv2.Sobel(face_eq, cv2.CV_64F, 1, 0, ksize=3)
            gy = cv2.Sobel(face_eq, cv2.CV_64F, 0, 1, ksize=3)
            magnitude = np.sqrt(gx**2 + gy**2)
            
            # Divide into 4x4 grid and compute mean magnitude per cell
            cell_h, cell_w = magnitude.shape[0] // 4, magnitude.shape[1] // 4
            texture_features = []
            for i in range(4):
                for j in range(4):
                    cell = magnitude[i*cell_h:(i+1)*cell_h, j*cell_w:(j+1)*cell_w]
                    texture_features.append(np.mean(cell))
            texture_features = np.array(texture_features)
            texture_features = texture_features / (np.max(texture_features) + 1e-6)
            
            # Combine features
            feature = np.concatenate([hist, texture_features])
            return feature
            
        except Exception as e:
            logger.debug(f"Could not extract face feature: {e}")
            return None
    
    def process_frame(self, frame: np.ndarray) -> Dict:
        """
        Process a frame for face recognition.
        Returns dict with annotated frame and face detection results.
        """
        self.frame_count += 1
        
        # Only process every N frames for performance
        if self.frame_count % self.detection_interval != 0:
            # Return cached results with current frame
            annotated = self.draw_results(frame, self.last_results) if self.last_results else frame
            recognized = [f for f in self.last_results if f.get('is_known')]
            return {
                'annotated_frame': annotated,
                'faces': self._format_faces(self.last_results),
                'recognized_count': len(recognized),
                'total_count': len(self.last_results)
            }
        
        results = []
        
        # Resize for faster processing
        h, w = frame.shape[:2]
        scale = self.process_scale
        small_frame = cv2.resize(frame, (int(w * scale), int(h * scale)))
        
        # Convert to grayscale
        gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = self.face_detector.detectMultiScale(
            gray, 
            scaleFactor=1.1, 
            minNeighbors=5,
            minSize=(30, 30)
        )
        
        for (x, y, fw, fh) in faces:
            # Scale back to original size
            x1 = int(x / scale)
            y1 = int(y / scale)
            x2 = int((x + fw) / scale)
            y2 = int((y + fh) / scale)
            
            # Extract face ROI from original frame for recognition
            face_roi = frame[y1:y2, x1:x2]
            
            # Find matching identity
            identity = "Unknown"
            confidence = 0.0
            
            if self.registered_faces and face_roi.size > 0:
                feature = self._extract_face_feature(face_roi)
                if feature is not None:
                    identity, confidence = self._find_match(feature)
            
            results.append({
                'bbox': (x1, y1, x2, y2),
                'identity': identity,
                'confidence': confidence,
                'is_known': identity != "Unknown",
                'person_id': identity if identity != "Unknown" else None,
                'person_name': identity if identity != "Unknown" else None,
                'recognized': identity != "Unknown"
            })
        
        self.last_results = results
        
        # Draw results on frame
        annotated_frame = self.draw_results(frame, results)
        recognized = [f for f in results if f.get('is_known')]
        
        return {
            'annotated_frame': annotated_frame,
            'faces': self._format_faces(results),
            'recognized_count': len(recognized),
            'total_count': len(results)
        }
    
    def _format_faces(self, results: List[Dict]) -> List[Dict]:
        """Format face results for API response"""
        return [{
            'bbox': f['bbox'],
            'person_id': f.get('person_id') or f.get('identity'),
            'person_name': f.get('person_name') or f.get('identity'),
            'confidence': f['confidence'],
            'recognized': f.get('is_known', False)
        } for f in results]
    
    def _find_match(self, feature: np.ndarray) -> Tuple[str, float]:
        """Find matching identity from registered faces using histogram comparison"""
        best_match = "Unknown"
        best_score = 0.0
        
        for person_id, features_list in self.registered_faces.items():
            # Compare with all registered features for this person
            scores = []
            for registered_feature in features_list:
                # Use correlation coefficient for comparison
                if len(feature) == len(registered_feature):
                    # Histogram comparison
                    score = cv2.compareHist(
                        feature.astype(np.float32).reshape(-1, 1),
                        registered_feature.astype(np.float32).reshape(-1, 1),
                        cv2.HISTCMP_CORREL
                    )
                    scores.append(score)
            
            if scores:
                avg_score = np.mean(scores)
                if avg_score > best_score and avg_score > self.threshold:
                    best_score = avg_score
                    best_match = person_id
        
        return best_match, float(best_score)
    
    def list_registered(self) -> List[Dict]:
        """List all registered faces"""
        result = []
        for person_id, features in self.registered_faces.items():
            result.append({
                'id': person_id,
                'person_id': person_id,
                'name': person_id,  # Use ID as name if no separate name storage
                'image_count': len(features),
                'has_encoding': len(features) > 0
            })
        return result
    
    def delete_face(self, person_id: str) -> bool:
        """Delete a registered face"""
        if person_id in self.registered_faces:
            del self.registered_faces[person_id]
            self._save_database()
            logger.info(f"🗑️ Deleted face for {person_id}")
            return True
        return False
    
    def register_face(self, person_id: str, image: np.ndarray) -> bool:
        """Register a new face for a person"""
        feature = self._extract_face_feature(image)
        
        if feature is None:
            logger.warning(f"Could not extract feature for {person_id}")
            return False
        
        if person_id not in self.registered_faces:
            self.registered_faces[person_id] = []
        
        self.registered_faces[person_id].append(feature)
        
        self._save_database()
        logger.info(f"✅ Registered face for {person_id}")
        return True
    
    def draw_results(self, frame: np.ndarray, results: List[Dict]) -> np.ndarray:
        """Draw detection results on frame"""
        output = frame.copy()
        
        for face in results:
            x1, y1, x2, y2 = face['bbox']
            identity = face['identity']
            confidence = face['confidence']
            
            # Color: green for known, red for unknown
            color = (0, 255, 0) if face['is_known'] else (0, 0, 255)
            
            cv2.rectangle(output, (x1, y1), (x2, y2), color, 2)
            
            label = f"{identity}"
            if confidence > 0:
                label += f" ({confidence:.2f})"
            
            # Draw label background
            label_size, baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            cv2.rectangle(output, (x1, y1 - label_size[1] - 10), 
                         (x1 + label_size[0], y1), color, -1)
            cv2.putText(output, label, (x1, y1 - 5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        return output
