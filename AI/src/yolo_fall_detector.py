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
        
        # NEW: Advanced tracking for better fall detection
        self.velocity_history: deque = deque(maxlen=self.history_size)  # Track velocities
        self.acceleration_history: deque = deque(maxlen=10)  # Track accelerations
        self.stability_scores: deque = deque(maxlen=self.history_size)  # Track balance
        
        self.current_state = PoseState.UNKNOWN
        self.fall_start_time: Optional[float] = None
        self.last_fall_time: float = 0
        self.fall_confirmed = False
        
        # Missing detection tracking
        self.missing_frames = 0
        self.max_missing_frames = config.get('max_missing_frames', 10)  # Số frame cho phép mất detection
        self.last_valid_center: Optional[Tuple[float, float]] = None
        self.last_valid_angle: Optional[float] = None
        self.last_valid_speed: float = 0.0
        self.last_valid_acceleration: float = 0.0  # NEW
        self.was_falling_before_missing = False
        self.frames_in_falling_state = 0  # Đếm số frame ở trạng thái FALLING
        
        # CRITICAL: Motion-based detection (không cần bounding box)
        self.prev_frame = None  # Frame trước đó
        self.frame_diff_history: deque = deque(maxlen=10)  # Lịch sử frame difference
        self.motion_detected_frames = 0  # Số frame liên tiếp có motion lớn
        self.motion_threshold = config.get('motion_threshold', 0.15)  # Ngưỡng phát hiện motion lớn
        self.use_motion_fallback = config.get('use_motion_fallback', True)  # Enable motion-based detection
        
        logger.info("YOLOv8 Fall Detection Module initialized")
        if self.use_motion_fallback:
            logger.info("✅ Motion-based fallback detection ENABLED")
    
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
    
    def _calculate_vertical_speed(self, frame_height: Optional[int] = None) -> float:
        """Calculate vertical movement speed (normalized, 0-1)
        
        Positive = moving down, Negative = moving up
        Normalized by frame height for consistency across resolutions
        """
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
            speed_pixels = total_dy / total_dt  # Positive = moving down
            
            # Normalize by frame height if provided
            if frame_height and frame_height > 0:
                return speed_pixels / frame_height  # 0-1 range
            return speed_pixels / 1000.0  # Fallback normalization
        return 0.0
    
    def _calculate_acceleration(self, current_speed: float, current_time: float) -> float:
        """Calculate vertical acceleration (change in speed)
        
        High acceleration = sudden movement change (potential fall)
        """
        if len(self.velocity_history) < 2 or len(self.timestamp_history) < 2:
            return 0.0
        
        # Get previous speed and time
        if len(self.velocity_history) > 0:
            prev_speed = self.velocity_history[-1]
            if len(self.timestamp_history) > 1:
                prev_time = self.timestamp_history[-2]
                dt = current_time - prev_time
                
                if dt > 0:
                    acceleration = (current_speed - prev_speed) / dt
                    return acceleration
        
        return 0.0
    
    def _calculate_stability_score(self, keypoints: np.ndarray, conf: np.ndarray) -> float:
        """Calculate pose stability score (0-1)
        
        Higher score = more stable/balanced
        Lower score = unstable/losing balance
        
        Factors:
        - Base of support (distance between feet)
        - Center of mass position
        - Upper body sway
        """
        try:
            # Get ankle positions (base of support)
            left_ankle = keypoints[self.LEFT_ANKLE]
            right_ankle = keypoints[self.RIGHT_ANKLE]
            left_ankle_conf = conf[self.LEFT_ANKLE]
            right_ankle_conf = conf[self.RIGHT_ANKLE]
            
            stability = 1.0  # Start with max stability
            
            # Factor 1: Base of support
            if left_ankle_conf > 0.5 and right_ankle_conf > 0.5:
                feet_distance = np.linalg.norm(left_ankle - right_ankle)
                # Wider base = more stable (normalize to 0-1)
                base_score = min(feet_distance / 200, 1.0)  # 200px = max normal width
                stability *= (0.3 + 0.7 * base_score)  # Weight: 30% base + 70% from width
            else:
                stability *= 0.5  # Penalty if can't see both feet
            
            # Factor 2: Upper body sway (shoulders movement)
            if len(self.center_history) >= 5:
                recent_centers = list(self.center_history)[-5:]
                # Calculate standard deviation of positions
                if all(c is not None for c in recent_centers):
                    x_positions = [c[0] for c in recent_centers]
                    sway = np.std(x_positions)
                    sway_score = max(0, 1.0 - sway / 50)  # More sway = less stable
                    stability *= sway_score
            
            return max(0.0, min(1.0, stability))
            
        except (IndexError, TypeError):
            return 0.5  # Neutral score if calculation fails
    
    def _calculate_fall_confidence(self, angle: Optional[float], vertical_speed: float, 
                                    acceleration: float, stability: float, 
                                    center_y_norm: Optional[float] = None) -> float:
        """Calculate fall confidence score (0-1) using multiple factors
        
        Returns probability that a fall is occurring
        """
        if angle is None:
            return 0.0
        
        score = 0.0
        
        # Factor 1: Angle (30% weight)
        angle_score = 0.0
        if angle > 30:
            angle_score = min((angle - 30) / 60, 1.0)  # 30-90° range
        score += angle_score * 0.30
        
        # Factor 2: Downward velocity (25% weight)
        speed_score = 0.0
        if vertical_speed > 0:  # Moving down
            speed_score = min(vertical_speed / self.vertical_speed_threshold, 1.0)
        score += speed_score * 0.25
        
        # Factor 3: Acceleration (20% weight)
        # High positive acceleration = suddenly moving down faster
        accel_score = 0.0
        if acceleration > 0.5:  # Sudden downward acceleration
            accel_score = min(acceleration / 2.0, 1.0)
        score += accel_score * 0.20
        
        # Factor 4: Instability (15% weight)
        instability_score = 1.0 - stability  # Low stability = high fall risk
        score += instability_score * 0.15
        
        # Factor 5: Vertical position (10% weight)
        if center_y_norm is not None:
            # If already near ground with high angle, likely falling/fallen
            if center_y_norm > 0.7 and angle > 60:
                score += 0.10
            elif center_y_norm < 0.4:  # Still high up
                score *= 0.8  # Reduce confidence if person is high up
        
        return max(0.0, min(1.0, score))
    
    def _detect_motion_magnitude(self, current_frame: np.ndarray) -> float:
        """Detect motion magnitude using frame differencing
        
        CRITICAL: Hoạt động KHÔNG CẦN bounding box
        Phát hiện sudden large motion = potential fall
        
        Returns:
            Motion magnitude (0-1), cao = motion lớn
        """
        if self.prev_frame is None:
            self.prev_frame = cv2.cvtColor(current_frame, cv2.COLOR_BGR2GRAY)
            return 0.0
        
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(current_frame, cv2.COLOR_BGR2GRAY)
            
            # Apply Gaussian blur to reduce noise - GI���M từ 21x21 → 11x11
            gray = cv2.GaussianBlur(gray, (11, 11), 0)
            prev_gray = cv2.GaussianBlur(self.prev_frame, (11, 11), 0)
            
            # Compute absolute difference
            frame_diff = cv2.absdiff(prev_gray, gray)
            
            # Threshold to get binary image - GIẢM từ 25 → 15 để nhạy hơn
            _, thresh = cv2.threshold(frame_diff, 15, 255, cv2.THRESH_BINARY)
            
            # Calculate percentage of changed pixels
            total_pixels = thresh.shape[0] * thresh.shape[1]
            changed_pixels = np.count_nonzero(thresh)
            motion_ratio = changed_pixels / total_pixels
            
            # Focus on lower half of frame (where falls happen)
            lower_half = thresh[thresh.shape[0]//2:, :]
            lower_changed = np.count_nonzero(lower_half)
            lower_ratio = lower_changed / (lower_half.shape[0] * lower_half.shape[1])
            
            # Weighted average: lower half more important
            motion_magnitude = (motion_ratio * 0.3) + (lower_ratio * 0.7)
            
            # Update prev frame
            self.prev_frame = gray
            
            # LOG ALWAYS for debugging (không filter)
            logger.info(f"🌊 Motion: {motion_magnitude:.3f} (thresh: {self.motion_threshold:.3f})")
            
            return min(motion_magnitude, 1.0)
            
        except Exception as e:
            logger.error(f"Motion detection error: {e}")
            return 0.0
    
    def _analyze_motion_pattern(self, motion_mag: float, current_time: float) -> bool:
        """Analyze motion pattern to detect fall
        
        Returns True if motion pattern indicates fall
        """
        self.frame_diff_history.append(motion_mag)
        
        # GIẢM từ 5 → 2 frames để nhanh hơn
        if len(self.frame_diff_history) < 2:
            return False
        
        recent_motion = list(self.frame_diff_history)[-5:] if len(self.frame_diff_history) >= 5 else list(self.frame_diff_history)
        avg_motion = np.mean(recent_motion)
        max_motion = np.max(recent_motion)
        
        # CRITICAL: Chỉ phát hiện SUDDEN SPIKE, KHÔNG phải sustained motion
        # Sustained motion = đi bộ bình thường, Sudden spike = té ngã
        
        # Tính CHANGE RATE (motion tăng đột ngột hay không)
        motion_change = 0
        if len(recent_motion) >= 2:
            prev_motion = recent_motion[-2] if len(recent_motion) >= 2 else 0
            motion_change = motion_mag - prev_motion
        
        # LOG for debugging - chỉ log khi có spike
        if motion_mag > self.motion_threshold * 0.8 or motion_change > self.motion_threshold * 0.5:
            logger.info(f"⚡ Motion spike: current={motion_mag:.3f}, prev={prev_motion:.3f}, change={motion_change:.3f}")
        
        # Pattern 1: SUDDEN SPIKE (tăng đột ngột) - QUAN TRỌNG NHẤT
        # Motion tăng nhanh = té ngã, không phải sustained high motion
        if motion_change > self.motion_threshold * 0.6:
            logger.warning(f"💥 SUDDEN motion spike: change={motion_change:.3f}")
            return True
        
        # Pattern 2: Very high single spike (té rất nhanh, 1 frame)
        if motion_mag > self.motion_threshold * 1.5:
            logger.warning(f"🔴 Very high spike: {motion_mag:.3f}")
            return True
        
        # Pattern 3: High spike with low previous motion (từ đứng yên → chuyển động nhanh)
        if motion_mag > self.motion_threshold * 1.0 and prev_motion < self.motion_threshold * 0.5:
            logger.warning(f"⚡ High spike from low motion: {prev_motion:.3f} → {motion_mag:.3f}")
            return True
        
        return False
    
    def _determine_pose_state(self, angle: Optional[float], vertical_speed: float, 
                              acceleration: float, stability: float,
                              center_y: Optional[float] = None, frame_height: Optional[int] = None) -> PoseState:
        """Determine current pose state using advanced multi-factor analysis
        
        Key improvements:
        - Uses fall confidence score instead of simple thresholds
        - Considers acceleration (sudden movements)
        - Considers stability (balance)
        - Better separation of cúi người vs té ngã
        """
        if angle is None:
            return PoseState.UNKNOWN
        
        # Normalize center_y position (0=top, 1=bottom)
        normalized_y = None
        if center_y is not None and frame_height is not None and frame_height > 0:
            normalized_y = center_y / frame_height
        
        # Calculate fall confidence score (0-1)
        fall_confidence = self._calculate_fall_confidence(
            angle, vertical_speed, acceleration, stability, normalized_y
        )
        
        # IMPROVED LOGIC: Use confidence threshold
        # Confidence > 0.6 = High probability of falling
        # Confidence > 0.8 = Very high probability
        
        if fall_confidence > 0.6:
            # Additional check: must be actually moving down OR very unstable
            if vertical_speed > self.vertical_speed_threshold * 0.3 or stability < 0.3:
                return PoseState.FALLING
        
        # Check for lying position - require low position in frame
        if angle > 70:
            # IMPORTANT: Distinguish bending vs lying on ground
            if normalized_y is not None:
                if normalized_y > 0.7:  # Near ground
                    return PoseState.LYING
                elif normalized_y > 0.5:  # Mid position
                    return PoseState.SITTING
                else:  # Still high - just bending
                    return PoseState.SITTING
            return PoseState.LYING  # Fallback
        
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
        
        # Run YOLOv8-pose detection with GPU optimization and advanced settings
        imgsz = self.config.get('imgsz', 640)
        max_det = self.config.get('max_det', 10)
        
        # 1. MOTION DETECTION (luôn chạy trước - không phụ thuộc YOLO)
        motion_magnitude = 0.0
        if self.use_motion_fallback:
            motion_magnitude = self._detect_motion_magnitude(frame)
            # Store for pattern analysis (deque auto-manages size with maxlen)
            self.frame_diff_history.append(motion_magnitude)
        
        # 2. YOLO POSE DETECTION
        results = self.model(
            frame, 
            conf=self.confidence_threshold,
            iou=self.iou_threshold,
            device=self.device,
            half=self.half_precision,  # FP16 for faster GPU inference
            imgsz=imgsz,  # Input resolution
            max_det=max_det,  # Max detections
            verbose=False
        )
        
        if len(results) == 0 or len(results[0]) == 0:
            self.missing_frames += 1
            return self._handle_missing_detection(current_time, annotated_frame)
        
        result = results[0]
        
        # Get keypoints
        keypoints = self._get_keypoints(result)
        confidence = self._get_keypoint_confidence(result)
        
        if keypoints is None or confidence is None:
            self.missing_frames += 1
            return self._handle_missing_detection(current_time, annotated_frame)
        
        # Reset missing frames counter when detection is successful
        self.missing_frames = 0
        
        # Calculate body metrics
        center = self._get_body_center(keypoints, confidence)
        angle = self._get_body_angle(keypoints, confidence)
        
        # Store last valid data
        if center is not None:
            self.last_valid_center = center
        if angle is not None:
            self.last_valid_angle = angle
        
        # Update history
        self.center_history.append(center)
        self.angle_history.append(angle)
        self.timestamp_history.append(current_time)
        
        # Calculate vertical speed (normalized by frame height)
        frame_height = frame.shape[0]
        vertical_speed = self._calculate_vertical_speed(frame_height)
        self.velocity_history.append(vertical_speed)  # Store for acceleration calc
        self.last_valid_speed = vertical_speed
        
        # NEW: Calculate acceleration (change in speed)
        acceleration = self._calculate_acceleration(vertical_speed, current_time)
        self.acceleration_history.append(acceleration)
        self.last_valid_acceleration = acceleration
        
        # NEW: Calculate stability score
        stability = self._calculate_stability_score(keypoints, confidence)
        self.stability_scores.append(stability)
        
        # Determine pose state with new advanced metrics
        center_y = center[1] if center is not None else None
        new_state = self._determine_pose_state(angle, vertical_speed, acceleration, 
                                               stability, center_y, frame_height)
        previous_state = self.current_state
        
        # Track frames in falling state for momentum tracking
        if new_state == PoseState.FALLING:
            self.frames_in_falling_state += 1
        else:
            self.frames_in_falling_state = 0
        
        # Track if was falling before potential missing detection
        # Quan trọng: Chỉ set True nếu thực sự đang trong quá trình falling (nhiều frame)
        if new_state == PoseState.FALLING and self.frames_in_falling_state >= 2:
            self.was_falling_before_missing = True
        elif self.fall_start_time is not None and new_state != PoseState.STANDING:
            self.was_falling_before_missing = True
        else:
            self.was_falling_before_missing = False
        
        # Debug log state changes
        if new_state != previous_state:
            angle_str = f"{angle:.1f}°" if angle is not None else "N/A"
            logger.info(f"🔄 State changed: {previous_state.value} → {new_state.value} | Angle: {angle_str} | Speed: {vertical_speed:.2f}")
        
        # Fall detection logic
        if new_state == PoseState.FALLING:
            if self.fall_start_time is None:
                self.fall_start_time = current_time
            
            fall_duration = current_time - self.fall_start_time
            
            # TRIGGER NGAY khi có FALLING state (không cần duration)
            # Vì FALLING state mất rất nhanh (1-2 frames)
            if not self.fall_confirmed:
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
                    
                    logger.warning(f"🚨 Fall detected! State: FALLING, Duration: {fall_duration:.2f}s, Speed: {vertical_speed:.2f}")
        
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
        
        # CRITICAL: CHECK MOTION-BASED FALL (ngay cả khi có bounding box)
        if not fall_detected and self.use_motion_fallback and motion_magnitude > 0:
            motion_fall_detected = self._analyze_motion_pattern(motion_magnitude, current_time)
            
            # Log motion ALWAYS
            if motion_magnitude > 0.05:
                logger.info(f"🌊 Motion: {motion_magnitude:.3f} | Threshold: {self.motion_threshold:.3f} | State: {new_state.value}")
            
            if motion_magnitude > self.motion_threshold * 0.5:
                logger.warning(f"⚠️ HIGH MOTION: {motion_magnitude:.3f}")
            
            if motion_fall_detected:
                logger.warning(f"🔴 MOTION PATTERN DETECTED! Cooldown check: {current_time - self.last_fall_time:.1f}s")
            
            # Trigger motion-based fall
            if motion_fall_detected and current_time - self.last_fall_time >= self.cooldown_seconds:
                # CHẶT CHẼ context check - chỉ trigger khi THẬT SỰ có dấu hiệu té
                context_valid = (
                    new_state == PoseState.FALLING or  # Đang falling
                    self.was_falling_before_missing or  # Vừa falling trước đó
                    acceleration > 0.3 or  # Acceleration CAO (không phải 0.2)
                    (stability < 0.4 and vertical_speed > 0.05)  # Mất cân bằng + đang di chuyển xuống
                )
                
                logger.info(f"⚙️ Context: valid={context_valid}, state={new_state.value}, accel={acceleration:.3f}, stab={stability:.2f}, speed={vertical_speed:.3f}")
                
                # Chỉ bypass nếu motion RẤT lớn (1.5x, không phải 0.8x)
                if context_valid or motion_magnitude > self.motion_threshold * 1.5:
                    confidence = 0.75 + (motion_magnitude * 0.15)
                    logger.error(f"🚨 MOTION-BASED FALL! Motion={motion_magnitude:.3f}, Confidence={confidence:.2f}")
                    
                    self.fall_confirmed = True
                    self.last_fall_time = current_time
                    fall_detected = True
                    
                    location = center if center else (frame.shape[1]//2, frame.shape[0]//2)
                    location = (int(location[0]), int(location[1]))
                    
                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_data = buffer.tobytes()
                    
                    fall_event = FallEvent(
                        timestamp=current_time,
                        confidence=confidence,
                        location=location,
                        previous_state=previous_state,
                        duration=current_time - (self.fall_start_time or current_time),
                        frame_data=frame_data
                    )
        
        self.current_state = new_state
        
        # Draw annotations
        annotated_frame = self._draw_annotations(annotated_frame, result, new_state, angle, vertical_speed)
        
        # Build result dictionary with pose info for debugging
        pose_info = []
        if center is not None and angle is not None:
            center_y_normalized = center[1] / frame_height if frame_height > 0 else 0
            # NEW: Include all advanced metrics
            pose_info.append({
                'center': center,
                'center_y_normalized': center_y_normalized,
                'angle': angle,
                'vertical_speed': vertical_speed,
                'acceleration': acceleration,  # NEW
                'stability': stability,  # NEW
                'fall_confidence': self._calculate_fall_confidence(  # NEW
                    angle, vertical_speed, acceleration, stability, center_y_normalized
                ),
            })
        
        result_dict = {
            'fall_detected': fall_detected,
            'fall_event': fall_event,
            'annotated_frame': annotated_frame,
            'state': new_state,
            'confidence': 0.95 if fall_detected else 0.0,
            'angle': angle,
            'speed': vertical_speed,
            'acceleration': acceleration,  # NEW
            'stability': stability,  # NEW
            'motion_magnitude': motion_magnitude,  # NEW: motion-based metric
            'poses': pose_info,
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
    
    def _handle_missing_detection(self, current_time: float, frame: np.ndarray) -> dict:
        """
        CRITICAL: Xử lý trường hợp mất bounding box
        
        NEW: Sử dụng MOTION DETECTION thay vì chỉ dựa vào last state
        """
        fall_detected = False
        fall_event = None
        
        # NEW: MOTION-BASED DETECTION (không cần bounding box)
        motion_magnitude = 0.0
        motion_fall_detected = False
        
        if self.use_motion_fallback:
            motion_magnitude = self._detect_motion_magnitude(frame)
            motion_fall_detected = self._analyze_motion_pattern(motion_magnitude, current_time)
            
            # Log motion for debugging - ALWAYS LOG
            if motion_magnitude > 0.05:
                logger.info(f"🌊 Motion: {motion_magnitude:.3f} | Threshold: {self.motion_threshold:.3f} | Missing: {self.missing_frames}")
            
            if motion_magnitude > self.motion_threshold * 0.5:
                logger.warning(f"⚠️ HIGH MOTION: {motion_magnitude:.3f}")
            
            # Nếu phát hiện motion lớn + (đang falling hoặc unstable trước đó)
            if motion_fall_detected:
                logger.warning(f"🔴 MOTION FALL DETECTED! Checking cooldown... (last: {current_time - self.last_fall_time:.1f}s ago)")
            
            if motion_fall_detected and current_time - self.last_fall_time >= self.cooldown_seconds:
                # Context check - RẤT NỚI LỎNG để catch sudden falls
                context_valid = (
                    self.was_falling_before_missing or 
                    self.last_valid_acceleration > 0.2 or  # Giảm từ 0.3 → 0.2
                    (hasattr(self, 'stability_scores') and len(self.stability_scores) > 0 and self.stability_scores[-1] < 0.6) or  # Tăng từ 0.5 → 0.6
                    self.missing_frames >= 2 or  # Giảm từ 3 → 2
                    motion_magnitude > self.motion_threshold * 1.0  # NEW: Motion rất lớn = bỏ qua context
                )
                
                logger.info(f"⚙️ Context check: valid={context_valid}, was_falling={self.was_falling_before_missing}, accel={self.last_valid_acceleration:.3f}, missing={self.missing_frames}")
                
                # Giảm threshold bypass từ 1.2x → 0.8x để RẤT dễ trigger
                if context_valid or motion_magnitude > self.motion_threshold * 0.8:
                    confidence = 0.7 + (motion_magnitude * 0.2)  # 0.7-0.9
                    logger.warning(f"🚨 MOTION-BASED FALL DETECTED! Motion: {motion_magnitude:.3f}, Missing: {self.missing_frames} frames")
                    
                    self.fall_confirmed = True
                    self.last_fall_time = current_time
                    fall_detected = True
                    
                    location = self.last_valid_center if self.last_valid_center else (frame.shape[1]//2, frame.shape[0]//2)
                    location = (int(location[0]), int(location[1]))
                    
                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_data = buffer.tobytes()
                    
                    fall_event = FallEvent(
                        timestamp=current_time,
                        confidence=confidence,
                        location=location,
                        previous_state=self.current_state,
                        duration=current_time - (self.fall_start_time or current_time),
                        frame_data=frame_data
                    )
        
        # Fallback: Pose-based detection (như trước)
        if not fall_detected and (self.was_falling_before_missing and 
            self.missing_frames <= 15 and
            self.last_valid_speed > self.vertical_speed_threshold * 0.5 and
            self.last_valid_speed > 0 and
            current_time - self.last_fall_time >= self.cooldown_seconds):
            
            confidence = 0.85 - (self.missing_frames / 15) * 0.3
            logger.warning(f"⚠️ Pose-based fall (disappearance). Missing {self.missing_frames} frames")
            
            self.fall_confirmed = True
            self.last_fall_time = current_time
            fall_detected = True
            
            location = self.last_valid_center if self.last_valid_center else (0, 0)
            location = (int(location[0]), int(location[1]))
            
            _, buffer = cv2.imencode('.jpg', frame)
            frame_data = buffer.tobytes()
            
            fall_event = FallEvent(
                timestamp=current_time,
                confidence=confidence,
                location=location,
                previous_state=self.current_state,
                duration=current_time - (self.fall_start_time or current_time),
                frame_data=frame_data
            )
        
        # Tình huống 2: Missing trong thời gian ngắn - maintain state
        if self.missing_frames <= self.max_missing_frames:
            # Vẽ warning lên frame
            warning_color = (0, 140, 255) if self.was_falling_before_missing else (0, 0, 255)
            warning_text = "TRACKING LOST - FALLING?" if self.was_falling_before_missing else "TRACKING LOST"
            cv2.putText(frame, f"{warning_text} ({self.missing_frames}/{self.max_missing_frames})", 
                       (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, warning_color, 2)
            
            if self.last_valid_center:
                cv2.circle(frame, 
                          (int(self.last_valid_center[0]), int(self.last_valid_center[1])), 
                          30, (0, 0, 255), 2)
                cv2.putText(frame, "Last known position", 
                           (int(self.last_valid_center[0]) - 50, int(self.last_valid_center[1]) - 40),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
            
            return {
                'fall_detected': fall_detected,
                'fall_event': fall_event,
                'annotated_frame': frame,
                'state': self.current_state,  # Maintain last state
                'confidence': 0.0,
                'angle': self.last_valid_angle,
                'speed': self.last_valid_speed,
                'missing_frames': self.missing_frames,
            }
        
        # Tình huống 3: Missing quá lâu - reset state
        else:
            logger.info(f"Lost tracking for {self.missing_frames} frames, resetting state")
            self.current_state = PoseState.UNKNOWN
            self.fall_start_time = None
            self.fall_confirmed = False
            self.was_falling_before_missing = False
            
            # cv2.putText(frame, "NO PERSON DETECTED", 
            #            (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            
            return {
                'fall_detected': False,
                'fall_event': None,
                'annotated_frame': frame,
                'state': PoseState.UNKNOWN,
                'confidence': 0.0,
                'angle': None,
                'speed': 0.0,
                'missing_frames': self.missing_frames,
            }
    
    def reset(self):
        """Reset tracking state"""
        self.pose_history.clear()
        self.center_history.clear()
        self.angle_history.clear()
        self.timestamp_history.clear()
        # NEW: Clear advanced tracking histories
        self.velocity_history.clear()
        self.acceleration_history.clear()
        self.stability_scores.clear()
        
        self.current_state = PoseState.UNKNOWN
        self.missing_frames = 0
        self.last_valid_center = None
        self.last_valid_angle = None
        self.last_valid_speed = 0.0
        self.last_valid_acceleration = 0.0  # NEW
        self.was_falling_before_missing = False
        self.frames_in_falling_state = 0
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
