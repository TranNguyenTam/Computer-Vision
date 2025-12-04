"""
Fall Detection Module
Detect falls using MediaPipe pose estimation
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
    import mediapipe as mp
except ImportError:
    print("Warning: mediapipe not installed. Using mock mode.")
    mp = None

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


class FallDetectionModule:
    """
    Fall Detection Module using MediaPipe Pose
    
    Features:
    - Detect human skeleton/keypoints using MediaPipe
    - Track posture, speed, and orientation
    - Detect sudden changes indicating a fall
    - Configurable thresholds to reduce false positives
    """
    
    # Key landmark indices for fall detection
    NOSE = 0
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_HIP = 23
    RIGHT_HIP = 24
    LEFT_KNEE = 25
    RIGHT_KNEE = 26
    LEFT_ANKLE = 27
    RIGHT_ANKLE = 28
    
    def __init__(self, config: dict):
        """
        Initialize Fall Detection Module
        
        Args:
            config: Configuration dictionary with fall detection settings
        """
        self.config = config
        self.model_complexity = config.get('model_complexity', 1)
        self.min_detection_confidence = config.get('min_detection_confidence', 0.7)
        self.min_tracking_confidence = config.get('min_tracking_confidence', 0.5)
        
        # Fall detection thresholds
        threshold_config = config.get('fall_threshold', {})
        self.vertical_speed_threshold = threshold_config.get('vertical_speed', 0.5)
        self.angle_threshold = threshold_config.get('angle_threshold', 45)
        self.duration_threshold = threshold_config.get('duration_threshold', 0.5)
        self.cooldown_seconds = config.get('cooldown_seconds', 5)
        
        # Initialize MediaPipe Pose
        if mp is not None:
            self.mp_pose = mp.solutions.pose
            self.mp_drawing = mp.solutions.drawing_utils
            self.mp_drawing_styles = mp.solutions.drawing_styles
            self.pose = self.mp_pose.Pose(
                model_complexity=self.model_complexity,
                min_detection_confidence=self.min_detection_confidence,
                min_tracking_confidence=self.min_tracking_confidence,
                enable_segmentation=False
            )
        else:
            self.pose = None
        
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
        
        logger.info("Fall Detection Module initialized")
    
    def _get_body_center(self, landmarks) -> Optional[Tuple[float, float]]:
        """Calculate body center from hip landmarks"""
        try:
            left_hip = landmarks[self.LEFT_HIP]
            right_hip = landmarks[self.RIGHT_HIP]
            
            if left_hip.visibility > 0.5 and right_hip.visibility > 0.5:
                return (
                    (left_hip.x + right_hip.x) / 2,
                    (left_hip.y + right_hip.y) / 2
                )
        except (IndexError, AttributeError):
            pass
        return None
    
    def _get_body_angle(self, landmarks) -> Optional[float]:
        """
        Calculate body angle from vertical
        Returns angle in degrees (0 = upright, 90 = horizontal)
        """
        try:
            # Get shoulder center
            left_shoulder = landmarks[self.LEFT_SHOULDER]
            right_shoulder = landmarks[self.RIGHT_SHOULDER]
            
            # Get hip center
            left_hip = landmarks[self.LEFT_HIP]
            right_hip = landmarks[self.RIGHT_HIP]
            
            # Check visibility
            if (left_shoulder.visibility > 0.5 and right_shoulder.visibility > 0.5 and
                left_hip.visibility > 0.5 and right_hip.visibility > 0.5):
                
                shoulder_center = np.array([
                    (left_shoulder.x + right_shoulder.x) / 2,
                    (left_shoulder.y + right_shoulder.y) / 2
                ])
                
                hip_center = np.array([
                    (left_hip.x + right_hip.x) / 2,
                    (left_hip.y + right_hip.y) / 2
                ])
                
                # Calculate angle from vertical
                # In image coordinates, y increases downward
                body_vector = shoulder_center - hip_center
                vertical_vector = np.array([0, -1])  # Pointing up
                
                # Calculate angle
                dot = np.dot(body_vector, vertical_vector)
                mag1 = np.linalg.norm(body_vector)
                mag2 = np.linalg.norm(vertical_vector)
                
                if mag1 > 0 and mag2 > 0:
                    cos_angle = np.clip(dot / (mag1 * mag2), -1, 1)
                    angle = np.degrees(np.arccos(cos_angle))
                    return angle
        except (IndexError, AttributeError):
            pass
        return None
    
    def _calculate_vertical_speed(self) -> float:
        """Calculate vertical movement speed (pixels per second)"""
        if len(self.center_history) < 2 or len(self.timestamp_history) < 2:
            return 0.0
        
        # Get recent positions and timestamps
        recent_centers = list(self.center_history)[-5:]
        recent_times = list(self.timestamp_history)[-5:]
        
        if len(recent_centers) < 2:
            return 0.0
        
        # Calculate average vertical speed
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
    
    def _determine_pose_state(self, angle: Optional[float]) -> PoseState:
        """Determine current pose state based on body angle"""
        if angle is None:
            return PoseState.UNKNOWN
        
        if angle < 30:
            return PoseState.STANDING
        elif angle < 60:
            return PoseState.SITTING
        else:
            return PoseState.LYING
    
    def _check_fall_conditions(self, current_time: float) -> Tuple[bool, float]:
        """
        Check if fall conditions are met
        
        Returns:
            Tuple of (is_falling, confidence)
        """
        # Check cooldown
        if current_time - self.last_fall_time < self.cooldown_seconds:
            return False, 0.0
        
        # Need enough history
        if len(self.angle_history) < 5:
            return False, 0.0
        
        # Get recent angles
        recent_angles = [a for a in list(self.angle_history)[-10:] if a is not None]
        
        if len(recent_angles) < 3:
            return False, 0.0
        
        # Calculate angle change
        angle_change = recent_angles[-1] - recent_angles[0] if len(recent_angles) >= 2 else 0
        
        # Get vertical speed
        vertical_speed = self._calculate_vertical_speed()
        
        # Current angle
        current_angle = recent_angles[-1] if recent_angles else 0
        
        # Fall detection logic
        is_falling = False
        confidence = 0.0
        
        # Condition 1: Rapid angle change + downward movement
        if angle_change > 30 and vertical_speed > self.vertical_speed_threshold:
            is_falling = True
            confidence = min(1.0, (angle_change / 60) * (vertical_speed / self.vertical_speed_threshold))
        
        # Condition 2: Currently lying + was recently standing
        if current_angle > self.angle_threshold:
            # Check if was standing recently
            old_angles = [a for a in list(self.angle_history)[:5] if a is not None]
            if old_angles and np.mean(old_angles) < 30:
                is_falling = True
                confidence = max(confidence, 0.7)
        
        # Condition 3: Very rapid downward movement
        if vertical_speed > self.vertical_speed_threshold * 2:
            is_falling = True
            confidence = max(confidence, 0.8)
        
        return is_falling, confidence
    
    def process_frame(self, frame: np.ndarray) -> dict:
        """
        Process a frame for fall detection
        
        Args:
            frame: BGR image from OpenCV
            
        Returns:
            Dictionary with detection results
        """
        current_time = time.time()
        result = {
            'fall_detected': False,
            'fall_alert': False,
            'confidence': 0.0,
            'pose_state': PoseState.UNKNOWN,
            'landmarks': None,
            'body_angle': None,
            'message': ''
        }
        
        if self.pose is None:
            result['message'] = 'MediaPipe not available'
            return result
        
        # Convert to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Process frame
        pose_results = self.pose.process(rgb_frame)
        
        if not pose_results.pose_landmarks:
            result['message'] = 'No pose detected'
            self.current_state = PoseState.UNKNOWN
            return result
        
        landmarks = pose_results.pose_landmarks.landmark
        result['landmarks'] = pose_results.pose_landmarks
        
        # Calculate body metrics
        body_center = self._get_body_center(landmarks)
        body_angle = self._get_body_angle(landmarks)
        
        # Update history
        self.center_history.append(body_center)
        self.angle_history.append(body_angle)
        self.timestamp_history.append(current_time)
        
        result['body_angle'] = body_angle
        
        # Determine pose state
        pose_state = self._determine_pose_state(body_angle)
        previous_state = self.current_state
        self.current_state = pose_state
        result['pose_state'] = pose_state
        
        # Check for fall
        is_falling, confidence = self._check_fall_conditions(current_time)
        
        if is_falling:
            if self.fall_start_time is None:
                self.fall_start_time = current_time
                result['fall_detected'] = True
                result['confidence'] = confidence
                result['message'] = 'Potential fall detected'
            else:
                fall_duration = current_time - self.fall_start_time
                
                # Confirm fall if duration exceeds threshold
                if fall_duration >= self.duration_threshold and not self.fall_confirmed:
                    self.fall_confirmed = True
                    self.last_fall_time = current_time
                    result['fall_alert'] = True
                    result['fall_detected'] = True
                    result['confidence'] = min(1.0, confidence + 0.2)
                    result['message'] = f'FALL CONFIRMED! Duration: {fall_duration:.2f}s'
                    
                    logger.warning(f"Fall detected! Confidence: {confidence:.2f}")
        else:
            # Reset fall detection state
            if pose_state in [PoseState.STANDING, PoseState.SITTING]:
                self.fall_start_time = None
                self.fall_confirmed = False
        
        return result
    
    def draw_results(self, frame: np.ndarray, result: dict) -> np.ndarray:
        """
        Draw pose landmarks and fall detection results on frame
        
        Args:
            frame: BGR image from OpenCV
            result: Detection result from process_frame
            
        Returns:
            Frame with annotations
        """
        annotated = frame.copy()
        
        if mp is None:
            return annotated
        
        # Draw pose landmarks
        if result.get('landmarks'):
            self.mp_drawing.draw_landmarks(
                annotated,
                result['landmarks'],
                self.mp_pose.POSE_CONNECTIONS,
                landmark_drawing_spec=self.mp_drawing_styles.get_default_pose_landmarks_style()
            )
        
        # Draw status
        h, w = frame.shape[:2]
        
        # Pose state
        state_text = f"State: {result['pose_state'].value}"
        cv2.putText(annotated, state_text, (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        
        # Body angle
        if result.get('body_angle') is not None:
            angle_text = f"Angle: {result['body_angle']:.1f}°"
            cv2.putText(annotated, angle_text, (10, 60),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        
        # Fall alert
        if result.get('fall_alert'):
            # Draw red overlay
            overlay = annotated.copy()
            cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 255), -1)
            annotated = cv2.addWeighted(overlay, 0.3, annotated, 0.7, 0)
            
            # Draw alert text
            alert_text = "FALL DETECTED!"
            text_size = cv2.getTextSize(alert_text, cv2.FONT_HERSHEY_SIMPLEX, 2, 3)[0]
            text_x = (w - text_size[0]) // 2
            text_y = (h + text_size[1]) // 2
            
            cv2.putText(annotated, alert_text, (text_x, text_y),
                       cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 255), 3)
        
        elif result.get('fall_detected'):
            # Potential fall warning
            cv2.putText(annotated, "Warning: Potential fall", (10, 90),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 165, 255), 2)
        
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
        logger.info("Fall detection state reset")
    
    def get_fall_alert(self) -> bool:
        """
        Get current fall alert status
        
        Returns:
            True if fall is currently detected
        """
        return self.fall_confirmed


class MultiPersonFallDetector:
    """
    Fall detector that handles multiple people in frame
    Uses MediaPipe Pose for single person, tracks multiple via bounding boxes
    """
    
    def __init__(self, config: dict):
        self.config = config
        self.trackers: Dict[int, FallDetectionModule] = {}
        self.next_id = 0
        
        # For simple tracking without external detector
        self.prev_centers: Dict[int, Tuple[float, float]] = {}
        self.max_distance = 100  # Max pixel distance for same person
        
        logger.info("Multi-person fall detector initialized")
    
    def process_frame(self, frame: np.ndarray, 
                      person_bboxes: Optional[List[Tuple[int, int, int, int]]] = None) -> List[dict]:
        """
        Process frame for multiple people
        
        Args:
            frame: BGR image
            person_bboxes: Optional list of (x1, y1, x2, y2) bounding boxes
            
        Returns:
            List of detection results per person
        """
        results = []
        
        if person_bboxes is None:
            # Single person mode
            if 0 not in self.trackers:
                self.trackers[0] = FallDetectionModule(self.config)
            
            result = self.trackers[0].process_frame(frame)
            result['person_id'] = 0
            results.append(result)
        else:
            # Multi-person mode
            for i, bbox in enumerate(person_bboxes):
                x1, y1, x2, y2 = bbox
                person_frame = frame[y1:y2, x1:x2]
                
                if person_frame.size == 0:
                    continue
                
                if i not in self.trackers:
                    self.trackers[i] = FallDetectionModule(self.config)
                
                result = self.trackers[i].process_frame(person_frame)
                result['person_id'] = i
                result['bbox'] = bbox
                results.append(result)
        
        return results
