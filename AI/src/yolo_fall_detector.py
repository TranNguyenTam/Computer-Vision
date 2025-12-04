"""
Fall Detection Module using YOLOv8-Pose
Detect falls using YOLOv8 pose estimation (compatible with Python 3.13)
"""

import time
import logging
from typing import Dict, List, Optional, Tuple
from collections import deque
from dataclasses import dataclass
from enum import Enum
import numpy as np
import cv2

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    print("Warning: ultralytics not installed.")
    YOLO_AVAILABLE = False

logger = logging.getLogger(__name__)


class PoseState(Enum):
    """Possible pose states"""
    STANDING = "standing"
    SITTING = "sitting"
    LYING = "lying"
    FALLING = "falling"
    UNKNOWN = "unknown"


@dataclass
class FallEvent:
    """Represents a fall detection event"""
    timestamp: float
    confidence: float
    location: Tuple[int, int]  # x, y in frame
    previous_state: PoseState
    duration: float  # Time from start of fall
    frame_data: Optional[bytes] = None


class YOLOFallDetector:
    """
    Fall Detection Module using YOLOv8-Pose
    
    Features:
    - Detect human skeleton/keypoints using YOLOv8-pose
    - Track posture, speed, and orientation
    - Detect sudden changes indicating a fall
    - Configurable thresholds to reduce false positives
    """
    
    # YOLOv8 Pose keypoint indices (COCO format)
    NOSE = 0
    LEFT_EYE = 1
    RIGHT_EYE = 2
    LEFT_EAR = 3
    RIGHT_EAR = 4
    LEFT_SHOULDER = 5
    RIGHT_SHOULDER = 6
    LEFT_ELBOW = 7
    RIGHT_ELBOW = 8
    LEFT_WRIST = 9
    RIGHT_WRIST = 10
    LEFT_HIP = 11
    RIGHT_HIP = 12
    LEFT_KNEE = 13
    RIGHT_KNEE = 14
    LEFT_ANKLE = 15
    RIGHT_ANKLE = 16
    
    def __init__(self, config: dict = None):
        """
        Initialize Fall Detection Module
        
        Args:
            config: Configuration dictionary with fall detection settings
        """
        config = config or {}
        self.config = config
        
        # GPU settings
        self.use_gpu = config.get('use_gpu', True)
        self.device = config.get('device', 'cuda:0' if self.use_gpu else 'cpu')
        self.half_precision = config.get('half_precision', True)  # FP16 for faster GPU inference
        
        # Load YOLOv8-pose model
        model_path = config.get('model_path', 'yolov8n-pose.pt')
        if YOLO_AVAILABLE:
            self.model = YOLO(model_path)
            
            # Check GPU availability
            import torch
            if self.use_gpu and torch.cuda.is_available():
                self.device = 'cuda:0'
                gpu_name = torch.cuda.get_device_name(0)
                gpu_mem = torch.cuda.get_device_properties(0).total_memory / 1024**3
                logger.info(f"🎮 GPU detected: {gpu_name} ({gpu_mem:.1f}GB)")
                logger.info(f"   Using device: {self.device}, FP16: {self.half_precision}")
            else:
                self.device = 'cpu'
                self.half_precision = False
                logger.info("💻 Using CPU for inference")
            
            logger.info(f"Loaded YOLOv8-pose model: {model_path}")
        else:
            self.model = None
            logger.warning("YOLO not available, using mock mode")
        
        # Detection settings
        self.confidence_threshold = config.get('conf_threshold', config.get('confidence_threshold', 0.5))
        self.iou_threshold = config.get('iou_threshold', 0.45)
        
        # Fall detection thresholds
        threshold_config = config.get('fall_threshold', {})
        self.vertical_speed_threshold = threshold_config.get('vertical_speed', 0.3)
        self.angle_threshold = threshold_config.get('angle_threshold', 50)  # degrees from vertical
        self.duration_threshold = threshold_config.get('duration_threshold', 0.3)  # seconds
        self.cooldown_seconds = config.get('cooldown_seconds', 5)
        
        # Tracking state
        self.history_size = 30  # Number of frames to keep
        self.pose_history: deque = deque(maxlen=self.history_size)
        self.center_history: deque = deque(maxlen=self.history_size)
        self.angle_history: deque = deque(maxlen=self.history_size)
        self.timestamp_history: deque = deque(maxlen=self.history_size)
        
        self.current_state = PoseState.UNKNOWN
        self.fall_start_time: Optional[float] = None
        self.last_fall_time: float = 0
        self.fall_confirmed = False
        
        logger.info("YOLOv8 Fall Detection Module initialized")
    
    def _get_keypoints(self, result) -> Optional[np.ndarray]:
        """Extract keypoints from YOLO result"""
        if result.keypoints is None or len(result.keypoints) == 0:
            return None
        
        # Get first person's keypoints
        kpts = result.keypoints[0]
        if kpts.xy is None or len(kpts.xy) == 0:
            return None
        
        return kpts.xy[0].cpu().numpy()  # Shape: (17, 2)
    
    def _get_keypoint_confidence(self, result) -> Optional[np.ndarray]:
        """Extract keypoint confidence from YOLO result"""
        if result.keypoints is None or len(result.keypoints) == 0:
            return None
        
        kpts = result.keypoints[0]
        if kpts.conf is None or len(kpts.conf) == 0:
            return None
        
        return kpts.conf[0].cpu().numpy()
    
    def _get_body_center(self, keypoints: np.ndarray, conf: np.ndarray) -> Optional[Tuple[float, float]]:
        """Calculate body center from hip landmarks"""
        try:
            left_hip = keypoints[self.LEFT_HIP]
            right_hip = keypoints[self.RIGHT_HIP]
            left_conf = conf[self.LEFT_HIP]
            right_conf = conf[self.RIGHT_HIP]
            
            if left_conf > 0.5 and right_conf > 0.5:
                return (
                    (left_hip[0] + right_hip[0]) / 2,
                    (left_hip[1] + right_hip[1]) / 2
                )
        except (IndexError, TypeError):
            pass
        return None
    
    def _get_body_angle(self, keypoints: np.ndarray, conf: np.ndarray) -> Optional[float]:
        """
        Calculate body angle from vertical
        Returns angle in degrees (0 = upright, 90 = horizontal)
        """
        try:
            # Get shoulders
            left_shoulder = keypoints[self.LEFT_SHOULDER]
            right_shoulder = keypoints[self.RIGHT_SHOULDER]
            
            # Get hips
            left_hip = keypoints[self.LEFT_HIP]
            right_hip = keypoints[self.RIGHT_HIP]
            
            # Check confidence
            if (conf[self.LEFT_SHOULDER] > 0.5 and conf[self.RIGHT_SHOULDER] > 0.5 and
                conf[self.LEFT_HIP] > 0.5 and conf[self.RIGHT_HIP] > 0.5):
                
                shoulder_center = np.array([
                    (left_shoulder[0] + right_shoulder[0]) / 2,
                    (left_shoulder[1] + right_shoulder[1]) / 2
                ])
                
                hip_center = np.array([
                    (left_hip[0] + right_hip[0]) / 2,
                    (left_hip[1] + right_hip[1]) / 2
                ])
                
                # Calculate angle from vertical
                body_vector = shoulder_center - hip_center
                vertical_vector = np.array([0, -1])  # Pointing up
                
                mag1 = np.linalg.norm(body_vector)
                mag2 = np.linalg.norm(vertical_vector)
                
                if mag1 > 0 and mag2 > 0:
                    dot = np.dot(body_vector, vertical_vector)
                    cos_angle = np.clip(dot / (mag1 * mag2), -1, 1)
                    angle = np.degrees(np.arccos(cos_angle))
                    return angle
        except (IndexError, TypeError):
            pass
        return None
    
    def _calculate_vertical_speed(self) -> float:
        """Calculate vertical movement speed (pixels per second)"""
        if len(self.center_history) < 2 or len(self.timestamp_history) < 2:
            return 0.0
        
        recent_centers = list(self.center_history)[-5:]
        recent_times = list(self.timestamp_history)[-5:]
        
        if len(recent_centers) < 2:
            return 0.0
        
        total_dy = 0
        total_dt = 0
        
        for i in range(1, len(recent_centers)):
            if recent_centers[i] is not None and recent_centers[i-1] is not None:
                dy = recent_centers[i][1] - recent_centers[i-1][1]
                dt = recent_times[i] - recent_times[i-1]
                if dt > 0:
                    total_dy += dy
                    total_dt += dt
        
        if total_dt > 0:
            return total_dy / total_dt  # Positive = moving down
        return 0.0
    
    def _determine_pose_state(self, angle: Optional[float], vertical_speed: float) -> PoseState:
        """Determine current pose state based on angle and speed"""
        if angle is None:
            return PoseState.UNKNOWN
        
        # Check for falling (rapid downward movement with tilting)
        if vertical_speed > self.vertical_speed_threshold and angle > 30:
            return PoseState.FALLING
        
        # Check body angle for lying position
        if angle > 70:
            return PoseState.LYING
        elif angle > 40:
            return PoseState.SITTING
        else:
            return PoseState.STANDING
    
    def process_frame(self, frame: np.ndarray) -> dict:
        """
        Process a video frame for fall detection
        
        Args:
            frame: BGR image from camera
            
        Returns:
            Dictionary with keys:
                - fall_detected: bool
                - fall_event: Optional[FallEvent]
                - annotated_frame: np.ndarray
                - state: PoseState
                - confidence: float
                - angle: Optional[float]
                - speed: float
        """
        current_time = time.time()
        fall_detected = False
        fall_event = None
        annotated_frame = frame.copy()
        
        result_dict = {
            'fall_detected': False,
            'fall_event': None,
            'annotated_frame': annotated_frame,
            'state': PoseState.UNKNOWN,
            'confidence': 0.0,
            'angle': None,
            'speed': 0.0,
        }
        
        if self.model is None:
            return result_dict
        
        # Run YOLOv8-pose detection with GPU optimization
        results = self.model(
            frame, 
            conf=self.confidence_threshold,
            iou=self.iou_threshold,
            device=self.device,
            half=self.half_precision,  # FP16 for faster GPU inference
            verbose=False
        )
        
        if len(results) == 0 or len(results[0]) == 0:
            return result_dict
        
        result = results[0]
        
        # Get keypoints
        keypoints = self._get_keypoints(result)
        confidence = self._get_keypoint_confidence(result)
        
        if keypoints is None or confidence is None:
            return result_dict
        
        # Calculate body metrics
        center = self._get_body_center(keypoints, confidence)
        angle = self._get_body_angle(keypoints, confidence)
        
        # Update history
        self.center_history.append(center)
        self.angle_history.append(angle)
        self.timestamp_history.append(current_time)
        
        # Calculate vertical speed
        vertical_speed = self._calculate_vertical_speed()
        
        # Determine pose state
        new_state = self._determine_pose_state(angle, vertical_speed)
        previous_state = self.current_state
        
        # Debug log state changes
        if new_state != previous_state:
            angle_str = f"{angle:.1f}°" if angle is not None else "N/A"
            logger.info(f"🔄 State changed: {previous_state.value} → {new_state.value} | Angle: {angle_str} | Speed: {vertical_speed:.2f}")
        
        # Fall detection logic
        if new_state == PoseState.FALLING:
            if self.fall_start_time is None:
                self.fall_start_time = current_time
            
            fall_duration = current_time - self.fall_start_time
            
            if fall_duration >= self.duration_threshold and not self.fall_confirmed:
                # Check cooldown
                if current_time - self.last_fall_time >= self.cooldown_seconds:
                    self.fall_confirmed = True
                    self.last_fall_time = current_time
                    fall_detected = True
                    
                    # Create fall event
                    location = (int(center[0]), int(center[1])) if center else (0, 0)
                    
                    # Encode frame as JPEG
                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_data = buffer.tobytes()
                    
                    fall_event = FallEvent(
                        timestamp=current_time,
                        confidence=0.9,
                        location=location,
                        previous_state=previous_state,
                        duration=fall_duration,
                        frame_data=frame_data
                    )
                    
                    logger.warning(f"Fall detected! Confidence: 0.9, Duration: {fall_duration:.2f}s")
        
        elif new_state == PoseState.LYING and previous_state == PoseState.FALLING:
            # Confirm fall if transitioning from falling to lying
            if not self.fall_confirmed and current_time - self.last_fall_time >= self.cooldown_seconds:
                self.fall_confirmed = True
                self.last_fall_time = current_time
                fall_detected = True
                
                location = (int(center[0]), int(center[1])) if center else (0, 0)
                _, buffer = cv2.imencode('.jpg', frame)
                frame_data = buffer.tobytes()
                
                fall_event = FallEvent(
                    timestamp=current_time,
                    confidence=0.95,
                    location=location,
                    previous_state=previous_state,
                    duration=current_time - (self.fall_start_time or current_time),
                    frame_data=frame_data
                )
        else:
            # Reset fall tracking if person is standing/sitting normally
            if new_state in [PoseState.STANDING, PoseState.SITTING]:
                self.fall_start_time = None
                self.fall_confirmed = False
        
        self.current_state = new_state
        
        # Draw annotations
        annotated_frame = self._draw_annotations(annotated_frame, result, new_state, angle, vertical_speed)
        
        # Build result dictionary
        result_dict = {
            'fall_detected': fall_detected,
            'fall_event': fall_event,
            'annotated_frame': annotated_frame,
            'state': new_state,
            'confidence': 0.95 if fall_detected else 0.0,
            'angle': angle,
            'speed': vertical_speed,
        }
        
        return result_dict
    
    def _draw_annotations(self, frame: np.ndarray, result, state: PoseState, 
                          angle: Optional[float], speed: float) -> np.ndarray:
        """Draw pose skeleton and status on frame"""
        # Draw YOLO pose results
        annotated = result.plot()
        
        # Add status text
        status_color = (0, 255, 0)  # Green
        if state == PoseState.FALLING:
            status_color = (0, 0, 255)  # Red
        elif state == PoseState.LYING:
            status_color = (0, 165, 255)  # Orange
        
        # Draw status
        cv2.putText(annotated, f"State: {state.value}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, status_color, 2)
        
        if angle is not None:
            cv2.putText(annotated, f"Angle: {angle:.1f}°", (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        cv2.putText(annotated, f"Speed: {speed:.2f}", (10, 90),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        return annotated
    
    def reset(self):
        """Reset tracking state"""
        self.pose_history.clear()
        self.center_history.clear()
        self.angle_history.clear()
        self.timestamp_history.clear()
        self.current_state = PoseState.UNKNOWN
        self.fall_start_time = None
        self.fall_confirmed = False


# Simple test
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    # Initialize detector
    detector = YOLOFallDetector()
    
    # Open webcam
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Cannot open camera")
        exit()
    
    print("Press 'q' to quit")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Process frame
        fall_detected, fall_event, annotated_frame = detector.process_frame(frame)
        
        if fall_detected:
            print(f"FALL DETECTED! Event: {fall_event}")
        
        # Show frame
        cv2.imshow('Fall Detection', annotated_frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
