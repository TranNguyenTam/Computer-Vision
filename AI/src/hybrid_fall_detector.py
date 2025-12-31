"""
Hybrid Fall Detection - Best of all approaches
Combines: Pose + Optical Flow + Heuristics

Strategy:
1. Use YOLO pose when available (normal cases)
2. Track optical flow when detection lost (during fall)
3. Detect sudden motion downward + detection loss = FALL
"""

import cv2
import numpy as np
import logging
from collections import deque
from dataclasses import dataclass
from typing import Optional, Tuple, List
from enum import Enum
from ultralytics import YOLO
import torch

logger = logging.getLogger(__name__)


class FallState(Enum):
    """Fall detection states"""
    STANDING = "standing"
    SITTING = "sitting"
    FALLING = "falling"
    LYING = "lying"
    UNKNOWN = "unknown"


@dataclass
class PersonTracker:
    """Track person across frames"""
    last_bbox: Optional[Tuple[float, float, float, float]] = None
    last_center_y: Optional[float] = None
    last_keypoints: Optional[np.ndarray] = None
    missing_frames: int = 0
    velocity_y: float = 0.0  # Vertical velocity
    last_state: FallState = FallState.UNKNOWN


@dataclass
class FallEvent:
    """Fall event data"""
    timestamp: float
    confidence: float
    location: Tuple[int, int]
    frame_data: bytes
    detection_method: str  # 'pose', 'flow', 'heuristic'


class HybridFallDetector:
    """
    Hybrid Fall Detection - Multiple strategies
    
    Primary: YOLO pose detection
    Fallback 1: Optical flow tracking
    Fallback 2: Detection loss heuristic
    """
    
    def __init__(self, config: dict = None):
        self.config = config or {}
        
        # Load YOLOv8 pose model
        model_path = self.config.get('model_path', 'yolov8s-pose.pt')
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        
        logger.info(f"Loading YOLOv8 pose: {model_path}")
        self.model = YOLO(model_path)
        
        # Detection settings
        self.conf_threshold = self.config.get('conf_threshold', 0.25)
        self.iou_threshold = self.config.get('iou_threshold', 0.45)
        
        # Pose-based thresholds
        self.vertical_speed = self.config.get('vertical_speed', 0.08)
        self.angle_threshold = self.config.get('angle_threshold', 70)
        
        # Flow-based settings
        self.use_optical_flow = self.config.get('use_optical_flow', True)
        self.flow_threshold = self.config.get('flow_threshold', 5.0)  # Pixels/frame
        
        # Heuristic settings
        self.sudden_loss_threshold = self.config.get('sudden_loss_threshold', 3)  # Frames
        self.min_velocity_for_fall = self.config.get('min_velocity_for_fall', 0.05)  # Normalized
        
        # State tracking
        self.tracker = PersonTracker()
        self.current_state = FallState.UNKNOWN
        self.last_fall_time = 0
        self.cooldown_seconds = self.config.get('cooldown_seconds', 5)
        self.fall_confirmed = False
        
        # Frame history
        self.prev_gray = None
        self.position_history = deque(maxlen=30)
        self.velocity_history = deque(maxlen=10)
        
        # Frame counter
        self.frame_count = 0
        self.log_interval = 30
        
        logger.info("✅ Hybrid Fall Detector initialized")
        logger.info(f"   Device: {self.device}")
        logger.info(f"   Conf threshold: {self.conf_threshold}")
        logger.info(f"   Optical flow: {self.use_optical_flow}")
        logger.info(f"   Vertical speed threshold: {self.vertical_speed}")
    
    def _detect_pose(self, frame: np.ndarray) -> Optional[dict]:
        """Detect person pose using YOLO"""
        results = self.model(
            frame,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            device=self.device,
            verbose=False
        )
        
        if len(results) == 0 or len(results[0].boxes) == 0:
            return None
        
        # Get first person
        result = results[0]
        box = result.boxes[0]
        keypoints = result.keypoints[0] if hasattr(result, 'keypoints') else None
        
        if keypoints is None:
            return None
        
        kpts = keypoints.data[0].cpu().numpy()  # (17, 3)
        bbox = box.xyxy[0].cpu().numpy()
        conf = float(box.conf[0].cpu().numpy())
        
        return {
            'bbox': bbox,
            'keypoints': kpts,
            'confidence': conf
        }
    
    def _calculate_optical_flow(self, frame: np.ndarray, prev_gray: np.ndarray) -> float:
        """Calculate average downward optical flow"""
        if prev_gray is None:
            return 0.0
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Calculate dense optical flow
        flow = cv2.calcOpticalFlowFarneback(
            prev_gray, gray,
            None,
            pyr_scale=0.5,
            levels=3,
            winsize=15,
            iterations=3,
            poly_n=5,
            poly_sigma=1.2,
            flags=0
        )
        
        # Get average vertical flow (positive = downward)
        avg_flow_y = np.mean(flow[:, :, 1])
        
        return avg_flow_y
    
    def _analyze_pose_state(self, keypoints: np.ndarray, frame_height: int) -> Tuple[FallState, float]:
        """Analyze pose keypoints to determine state and vertical speed"""
        
        # Extract key points (COCO format)
        nose = keypoints[0][:2]
        left_shoulder = keypoints[5][:2]
        right_shoulder = keypoints[6][:2]
        left_hip = keypoints[11][:2]
        right_hip = keypoints[12][:2]
        
        # Check confidence
        confidences = [keypoints[i][2] for i in [0, 5, 6, 11, 12]]
        if np.mean(confidences) < 0.3:
            return FallState.UNKNOWN, 0.0
        
        # Calculate body angle
        shoulder_center = (left_shoulder + right_shoulder) / 2
        hip_center = (left_hip + right_hip) / 2
        
        body_vector = hip_center - shoulder_center
        angle = np.abs(np.degrees(np.arctan2(body_vector[0], body_vector[1])))
        
        # Calculate vertical speed
        current_center_y = (shoulder_center[1] + hip_center[1]) / 2
        velocity = 0.0
        
        if self.tracker.last_center_y is not None:
            velocity = (current_center_y - self.tracker.last_center_y) / frame_height
            self.velocity_history.append(velocity)
        
        self.tracker.last_center_y = current_center_y
        
        # Determine state
        # FALLING: high downward speed + tilted angle
        if velocity > self.vertical_speed and angle > self.angle_threshold:
            return FallState.FALLING, velocity
        
        # LYING: body horizontal
        if angle > 70:
            y_normalized = current_center_y / frame_height
            if y_normalized > 0.6:  # In lower part of frame
                return FallState.LYING, velocity
        
        # SITTING: moderate height, upright
        y_normalized = current_center_y / frame_height
        if 0.5 < y_normalized < 0.8 and angle < 30:
            return FallState.SITTING, velocity
        
        # STANDING: upper part, upright
        if y_normalized < 0.7 and angle < 30:
            return FallState.STANDING, velocity
        
        return FallState.UNKNOWN, velocity
    
    def _detect_fall_by_heuristic(self) -> Tuple[bool, str]:
        """
        Detect fall by heuristic: sudden detection loss + prior downward velocity
        This catches falls when YOLO loses tracking
        """
        
        # Need sufficient missing frames
        if self.tracker.missing_frames < self.sudden_loss_threshold:
            return False, ""
        
        # Check if we had downward velocity before losing detection
        if len(self.velocity_history) < 3:
            return False, ""
        
        # Average velocity in last frames before loss
        recent_velocities = list(self.velocity_history)[-3:]
        avg_velocity = np.mean(recent_velocities)
        
        # Sudden detection loss + downward motion = likely fall
        if avg_velocity > self.min_velocity_for_fall:
            confidence = min(avg_velocity / self.vertical_speed, 1.0)
            logger.warning(
                f"🔍 HEURISTIC FALL: Lost detection after {self.tracker.missing_frames} frames, "
                f"prior velocity: {avg_velocity:.3f}"
            )
            return True, f"heuristic (v={avg_velocity:.3f})"
        
        return False, ""
    
    def process_frame(self, frame: np.ndarray) -> dict:
        """Process frame with hybrid approach"""
        self.frame_count += 1
        current_time = cv2.getTickCount() / cv2.getTickFrequency()
        frame_height = frame.shape[0]
        
        fall_detected = False
        fall_event = None
        detection_method = None
        annotated_frame = frame.copy()
        
        # Convert to grayscale for optical flow
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Calculate optical flow if enabled
        flow_magnitude = 0.0
        if self.use_optical_flow and self.prev_gray is not None:
            flow_magnitude = self._calculate_optical_flow(frame, self.prev_gray)
        
        self.prev_gray = gray.copy()
        
        # Try pose detection
        pose_result = self._detect_pose(frame)
        
        if pose_result is not None:
            # Successful pose detection
            self.tracker.missing_frames = 0
            self.tracker.last_bbox = pose_result['bbox']
            self.tracker.last_keypoints = pose_result['keypoints']
            
            # Analyze pose
            new_state, velocity = self._analyze_pose_state(pose_result['keypoints'], frame_height)
            previous_state = self.current_state
            self.current_state = new_state
            self.tracker.velocity_y = velocity
            
            # Log state changes
            if new_state != previous_state or self.frame_count % self.log_interval == 0:
                logger.info(
                    f"Frame {self.frame_count}: {previous_state.value} → {new_state.value} | "
                    f"Velocity: {velocity:.3f}, Flow: {flow_magnitude:.2f}"
                )
            
            # Check for fall (pose-based)
            if new_state == FallState.FALLING:
                if not self.fall_confirmed and current_time - self.last_fall_time >= self.cooldown_seconds:
                    self.fall_confirmed = True
                    self.last_fall_time = current_time
                    fall_detected = True
                    detection_method = "pose"
                    
                    _, buffer = cv2.imencode('.jpg', frame)
                    fall_event = FallEvent(
                        timestamp=current_time,
                        confidence=0.9,
                        location=(int(frame.shape[1] / 2), int(frame.shape[0] / 2)),
                        frame_data=buffer.tobytes(),
                        detection_method="pose"
                    )
                    
                    logger.error(f"🚨 FALL DETECTED (POSE)! Velocity: {velocity:.3f}")
            else:
                if new_state == FallState.STANDING:
                    self.fall_confirmed = False
            
            # Draw pose visualization
            kpts = pose_result['keypoints']
            for i in range(len(kpts)):
                if kpts[i][2] > 0.3:  # Confidence threshold
                    x, y = int(kpts[i][0]), int(kpts[i][1])
                    cv2.circle(annotated_frame, (x, y), 3, (0, 255, 0), -1)
            
            # Draw bbox
            x1, y1, x2, y2 = pose_result['bbox'].astype(int)
            color = {
                FallState.STANDING: (0, 255, 0),
                FallState.FALLING: (0, 0, 255),
                FallState.LYING: (0, 165, 255),
                FallState.SITTING: (255, 200, 0),
                FallState.UNKNOWN: (255, 255, 0),
            }.get(new_state, (255, 255, 255))
            
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
        
        else:
            # Detection lost - use heuristics
            self.tracker.missing_frames += 1
            
            if self.frame_count % self.log_interval == 0 or self.tracker.missing_frames == self.sudden_loss_threshold:
                logger.warning(
                    f"Frame {self.frame_count}: No detection ({self.tracker.missing_frames} missing), "
                    f"Flow: {flow_magnitude:.2f}"
                )
            
            # Check heuristic fall detection
            if not self.fall_confirmed:
                heuristic_fall, method = self._detect_fall_by_heuristic()
                
                if heuristic_fall and current_time - self.last_fall_time >= self.cooldown_seconds:
                    self.fall_confirmed = True
                    self.last_fall_time = current_time
                    fall_detected = True
                    detection_method = method
                    
                    _, buffer = cv2.imencode('.jpg', frame)
                    fall_event = FallEvent(
                        timestamp=current_time,
                        confidence=0.7,
                        location=(int(frame.shape[1] / 2), int(frame.shape[0] / 2)),
                        frame_data=buffer.tobytes(),
                        detection_method=method
                    )
                    
                    logger.error(f"🚨 FALL DETECTED ({method.upper()})!")
            
            # Reset after too many missing frames
            if self.tracker.missing_frames > 30:
                self.current_state = FallState.UNKNOWN
                self.fall_confirmed = False
        
        # Draw state and metrics
        cv2.putText(
            annotated_frame,
            f"State: {self.current_state.value.upper()}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 255),
            2
        )
        
        cv2.putText(
            annotated_frame,
            f"Velocity: {self.tracker.velocity_y:.3f}",
            (10, 60),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2
        )
        
        if self.tracker.missing_frames > 0:
            cv2.putText(
                annotated_frame,
                f"Missing: {self.tracker.missing_frames}",
                (10, 90),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 0, 255),
                2
            )
        
        return {
            'fall_detected': fall_detected,
            'fall_event': fall_event,
            'annotated_frame': annotated_frame,
            'state': self.current_state,
            'velocity': self.tracker.velocity_y,
            'missing_frames': self.tracker.missing_frames,
            'detection_method': detection_method,
        }


if __name__ == "__main__":
    # Simple test
    logging.basicConfig(level=logging.INFO)
    
    detector = HybridFallDetector()
    
    cap = cv2.VideoCapture(0)
    print("Press 'q' to quit")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        result = detector.process_frame(frame)
        cv2.imshow('Hybrid Fall Detection', result['annotated_frame'])
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
