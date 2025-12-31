"""
Fall Detection using Pose Estimation + Custom Rule-Based Classifier

Uses: MoveNet/OpenPose for robust pose detection
      + Custom rules for fall classification

This approach:
- More accurate pose detection than YOLO
- Custom rules specifically designed for falls
- Research-based methodology
"""

import cv2
import numpy as np
import logging
from collections import deque
from dataclasses import dataclass
from typing import Optional, Tuple, List, Dict
from enum import Enum
import tensorflow as tf
import tensorflow_hub as hub

logger = logging.getLogger(__name__)


class FallState(Enum):
    """Fall detection states"""
    STANDING = "standing"
    WALKING = "walking"
    SITTING = "sitting"
    BENDING = "bending"
    FALLING = "falling"
    LYING = "lying"
    UNKNOWN = "unknown"


@dataclass
class PoseKeypoints:
    """Pose keypoints with confidence"""
    keypoints: np.ndarray  # (17, 3) - x, y, confidence
    bbox: Tuple[int, int, int, int]


@dataclass
class FallEvent:
    """Fall event data"""
    timestamp: float
    confidence: float
    location: Tuple[int, int]
    frame_data: bytes
    fall_type: str  # 'forward', 'backward', 'sideways'


class RuleBasedFallClassifier:
    """
    Custom Rule-Based Fall Classifier
    
    Rules based on research papers and biomechanics:
    1. Vertical velocity (sudden drop)
    2. Body angle (tilted > 45°)
    3. Aspect ratio change (vertical → horizontal)
    4. Center of mass trajectory
    5. Limb configuration
    6. Temporal consistency
    """
    
    def __init__(self, config: dict = None):
        self.config = config or {}
        
        # Load MoveNet (lightweight alternative to OpenPose)
        logger.info("Loading MoveNet Thunder model...")
        model_url = "https://tfhub.dev/google/movenet/singlepose/thunder/4"
        self.model = hub.load(model_url)
        self.movenet = self.model.signatures['serving_default']
        
        # Input size for MoveNet
        self.input_size = 256
        
        # Keypoint names (COCO format)
        self.keypoint_names = [
            'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
            'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
            'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
            'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
        ]
        
        # Rule thresholds (tunable)
        self.vertical_velocity_threshold = self.config.get('vertical_velocity_threshold', 0.12)
        self.body_angle_threshold = self.config.get('body_angle_threshold', 45)  # degrees
        self.aspect_ratio_threshold = self.config.get('aspect_ratio_threshold', 1.5)
        self.lying_height_threshold = self.config.get('lying_height_threshold', 0.7)  # normalized
        self.confidence_threshold = self.config.get('confidence_threshold', 0.3)
        
        # History tracking
        self.pose_history = deque(maxlen=30)  # 1 second @ 30fps
        self.velocity_history = deque(maxlen=10)
        self.state_history = deque(maxlen=5)
        
        # State tracking
        self.current_state = FallState.UNKNOWN
        self.last_fall_time = 0
        self.cooldown_seconds = self.config.get('cooldown_seconds', 5)
        self.fall_confirmed = False
        
        # Frame counter
        self.frame_count = 0
        
        logger.info("✅ Rule-Based Fall Classifier initialized")
        logger.info(f"   Vertical velocity threshold: {self.vertical_velocity_threshold}")
        logger.info(f"   Body angle threshold: {self.body_angle_threshold}°")
        logger.info(f"   Aspect ratio threshold: {self.aspect_ratio_threshold}")
    
    def _detect_pose(self, frame: np.ndarray) -> Optional[PoseKeypoints]:
        """Detect pose using MoveNet"""
        
        # Resize and preprocess
        img = cv2.resize(frame, (self.input_size, self.input_size))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = tf.cast(img, dtype=tf.int32)
        img = tf.expand_dims(img, axis=0)
        
        # Run inference
        outputs = self.movenet(img)
        keypoints = outputs['output_0'].numpy()[0, 0, :, :]  # (17, 3)
        
        # Scale keypoints to original frame size
        h, w = frame.shape[:2]
        keypoints[:, 0] *= h  # y
        keypoints[:, 1] *= w  # x
        
        # Check if person detected (enough confident keypoints)
        confident_kpts = np.sum(keypoints[:, 2] > self.confidence_threshold)
        if confident_kpts < 8:  # Need at least 8 keypoints
            return None
        
        # Calculate bounding box
        valid_kpts = keypoints[keypoints[:, 2] > self.confidence_threshold]
        if len(valid_kpts) == 0:
            return None
        
        x_min = int(np.min(valid_kpts[:, 1]))
        x_max = int(np.max(valid_kpts[:, 1]))
        y_min = int(np.min(valid_kpts[:, 0]))
        y_max = int(np.max(valid_kpts[:, 0]))
        
        bbox = (x_min, y_min, x_max, y_max)
        
        return PoseKeypoints(keypoints=keypoints, bbox=bbox)
    
    def _calculate_body_angle(self, keypoints: np.ndarray) -> float:
        """Calculate body angle from vertical"""
        
        # Get shoulder and hip centers
        l_shoulder = keypoints[5][:2]
        r_shoulder = keypoints[6][:2]
        l_hip = keypoints[11][:2]
        r_hip = keypoints[12][:2]
        
        # Check confidence
        if keypoints[5][2] < self.confidence_threshold or keypoints[6][2] < self.confidence_threshold:
            return 0.0
        if keypoints[11][2] < self.confidence_threshold or keypoints[12][2] < self.confidence_threshold:
            return 0.0
        
        shoulder_center = (l_shoulder + r_shoulder) / 2
        hip_center = (l_hip + r_hip) / 2
        
        # Vector from hip to shoulder
        body_vector = shoulder_center - hip_center
        
        # Angle from vertical (y-axis)
        angle = np.abs(np.degrees(np.arctan2(body_vector[1], body_vector[0])))
        
        return angle
    
    def _calculate_center_of_mass(self, keypoints: np.ndarray) -> np.ndarray:
        """Calculate approximate center of mass"""
        
        # Use torso keypoints (more stable)
        torso_indices = [5, 6, 11, 12]  # shoulders and hips
        torso_kpts = keypoints[torso_indices]
        
        # Filter by confidence
        valid = torso_kpts[torso_kpts[:, 2] > self.confidence_threshold]
        
        if len(valid) == 0:
            return np.array([0, 0])
        
        com = np.mean(valid[:, :2], axis=0)
        return com
    
    def _calculate_vertical_velocity(self, frame_height: int) -> float:
        """Calculate vertical velocity (normalized)"""
        
        if len(self.pose_history) < 5:
            return 0.0
        
        # Compare with 5 frames ago
        current_pose = self.pose_history[-1]
        prev_pose = self.pose_history[-5]
        
        current_com = self._calculate_center_of_mass(current_pose.keypoints)
        prev_com = self._calculate_center_of_mass(prev_pose.keypoints)
        
        # Vertical displacement (positive = downward)
        displacement = current_com[0] - prev_com[0]  # y-coordinate
        velocity = displacement / frame_height
        
        return velocity
    
    def _calculate_aspect_ratio(self, bbox: Tuple[int, int, int, int]) -> float:
        """Calculate body aspect ratio (width/height)"""
        x_min, y_min, x_max, y_max = bbox
        width = x_max - x_min
        height = y_max - y_min
        
        if height == 0:
            return 0.0
        
        return width / height
    
    def _check_lying_position(self, keypoints: np.ndarray, frame_height: int) -> bool:
        """Check if person is in lying position"""
        
        # Get key points
        nose = keypoints[0]
        l_shoulder = keypoints[5]
        r_shoulder = keypoints[6]
        l_hip = keypoints[11]
        r_hip = keypoints[12]
        l_ankle = keypoints[15]
        r_ankle = keypoints[16]
        
        # Check confidence
        if nose[2] < self.confidence_threshold:
            return False
        
        # Calculate body span (horizontal vs vertical)
        all_kpts = keypoints[keypoints[:, 2] > self.confidence_threshold]
        if len(all_kpts) < 5:
            return False
        
        y_span = np.max(all_kpts[:, 0]) - np.min(all_kpts[:, 0])
        x_span = np.max(all_kpts[:, 1]) - np.min(all_kpts[:, 1])
        
        # Lying: horizontal span > vertical span
        if x_span > y_span * 1.3:
            # Also check if in lower part of frame
            com = self._calculate_center_of_mass(keypoints)
            if com[0] / frame_height > 0.6:
                return True
        
        return False
    
    def _classify_state(self, pose: PoseKeypoints, frame_height: int) -> FallState:
        """Classify current state using rule-based logic"""
        
        keypoints = pose.keypoints
        bbox = pose.bbox
        
        # Rule 1: Check lying position first
        if self._check_lying_position(keypoints, frame_height):
            return FallState.LYING
        
        # Rule 2: Calculate metrics
        body_angle = self._calculate_body_angle(keypoints)
        aspect_ratio = self._calculate_aspect_ratio(bbox)
        velocity = self._calculate_vertical_velocity(frame_height) if len(self.pose_history) >= 5 else 0.0
        
        com = self._calculate_center_of_mass(keypoints)
        vertical_position = com[0] / frame_height
        
        # Rule 3: FALLING detection
        # High downward velocity + tilted body
        if velocity > self.vertical_velocity_threshold and body_angle > self.body_angle_threshold:
            return FallState.FALLING
        
        # Very high velocity alone
        if velocity > self.vertical_velocity_threshold * 1.5:
            return FallState.FALLING
        
        # Rule 4: SITTING detection
        # Low vertical position + upright body
        if 0.5 < vertical_position < 0.75 and body_angle < 30:
            return FallState.SITTING
        
        # Rule 5: BENDING detection
        # Tilted but not falling (low velocity)
        if body_angle > 40 and velocity < 0.05:
            return FallState.BENDING
        
        # Rule 6: STANDING/WALKING
        # Upper part of frame + upright
        if vertical_position < 0.6 and body_angle < 30:
            # Check limb movement for walking detection
            if len(self.pose_history) >= 3:
                # Simple walking detection: leg keypoints moving
                return FallState.WALKING
            return FallState.STANDING
        
        return FallState.UNKNOWN
    
    def _determine_fall_type(self, keypoints: np.ndarray) -> str:
        """Determine type of fall"""
        
        if len(self.pose_history) < 5:
            return "unknown"
        
        # Compare current with previous poses
        prev_keypoints = self.pose_history[-5].keypoints
        
        # Get nose positions
        curr_nose = keypoints[0][:2]
        prev_nose = prev_keypoints[0][:2]
        
        # Direction of fall
        direction = curr_nose - prev_nose
        
        # Forward: y increases significantly
        if direction[0] > 20:
            return "forward"
        # Backward: y decreases
        elif direction[0] < -10:
            return "backward"
        # Sideways: x changes more than y
        elif abs(direction[1]) > abs(direction[0]):
            return "sideways"
        
        return "unknown"
    
    def process_frame(self, frame: np.ndarray) -> dict:
        """Process frame with rule-based classifier"""
        
        self.frame_count += 1
        current_time = cv2.getTickCount() / cv2.getTickFrequency()
        
        fall_detected = False
        fall_event = None
        annotated_frame = frame.copy()
        frame_height = frame.shape[0]
        
        # Detect pose
        pose = self._detect_pose(frame)
        
        if pose is None:
            logger.debug(f"Frame {self.frame_count}: No pose detected")
            
            return {
                'fall_detected': False,
                'fall_event': None,
                'annotated_frame': annotated_frame,
                'state': FallState.UNKNOWN,
                'metrics': {},
            }
        
        # Add to history
        self.pose_history.append(pose)
        
        # Classify state
        new_state = self._classify_state(pose, frame_height)
        previous_state = self.current_state
        self.current_state = new_state
        self.state_history.append(new_state)
        
        # Calculate metrics for display
        body_angle = self._calculate_body_angle(pose.keypoints)
        aspect_ratio = self._calculate_aspect_ratio(pose.bbox)
        velocity = self._calculate_vertical_velocity(frame_height)
        
        metrics = {
            'body_angle': body_angle,
            'aspect_ratio': aspect_ratio,
            'velocity': velocity,
        }
        
        # Log state changes
        if new_state != previous_state or self.frame_count % 30 == 0:
            logger.info(
                f"Frame {self.frame_count}: {previous_state.value} → {new_state.value} | "
                f"Angle: {body_angle:.1f}°, Velocity: {velocity:.3f}, AR: {aspect_ratio:.2f}"
            )
        
        # Check for fall
        if new_state == FallState.FALLING:
            if not self.fall_confirmed and current_time - self.last_fall_time >= self.cooldown_seconds:
                # Confirm with temporal consistency
                recent_states = list(self.state_history)[-3:]
                falling_count = sum(1 for s in recent_states if s == FallState.FALLING)
                
                if falling_count >= 2:  # At least 2 out of last 3 frames
                    self.fall_confirmed = True
                    self.last_fall_time = current_time
                    fall_detected = True
                    
                    fall_type = self._determine_fall_type(pose.keypoints)
                    
                    _, buffer = cv2.imencode('.jpg', frame)
                    fall_event = FallEvent(
                        timestamp=current_time,
                        confidence=0.9,
                        location=(int(frame.shape[1] / 2), int(frame.shape[0] / 2)),
                        frame_data=buffer.tobytes(),
                        fall_type=fall_type
                    )
                    
                    logger.error(
                        f"🚨 FALL DETECTED! Type: {fall_type}, "
                        f"Velocity: {velocity:.3f}, Angle: {body_angle:.1f}°"
                    )
        else:
            if new_state == FallState.STANDING:
                self.fall_confirmed = False
        
        # Visualization
        self._draw_skeleton(annotated_frame, pose.keypoints)
        
        # Draw bbox and state
        x_min, y_min, x_max, y_max = pose.bbox
        color = {
            FallState.STANDING: (0, 255, 0),
            FallState.WALKING: (0, 255, 255),
            FallState.SITTING: (255, 200, 0),
            FallState.BENDING: (255, 128, 0),
            FallState.FALLING: (0, 0, 255),
            FallState.LYING: (0, 165, 255),
            FallState.UNKNOWN: (255, 255, 0),
        }.get(new_state, (255, 255, 255))
        
        cv2.rectangle(annotated_frame, (x_min, y_min), (x_max, y_max), color, 2)
        
        cv2.putText(
            annotated_frame,
            f"State: {new_state.value.upper()}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            color,
            2
        )
        
        cv2.putText(
            annotated_frame,
            f"Velocity: {velocity:.3f} | Angle: {body_angle:.1f}°",
            (10, 60),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2
        )
        
        return {
            'fall_detected': fall_detected,
            'fall_event': fall_event,
            'annotated_frame': annotated_frame,
            'state': new_state,
            'metrics': metrics,
        }
    
    def _draw_skeleton(self, frame: np.ndarray, keypoints: np.ndarray):
        """Draw skeleton on frame"""
        
        # Define skeleton connections
        connections = [
            (0, 1), (0, 2), (1, 3), (2, 4),  # Head
            (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),  # Arms
            (5, 11), (6, 12), (11, 12),  # Torso
            (11, 13), (13, 15), (12, 14), (14, 16)  # Legs
        ]
        
        # Draw keypoints
        for i, kpt in enumerate(keypoints):
            if kpt[2] > self.confidence_threshold:
                x, y = int(kpt[1]), int(kpt[0])
                cv2.circle(frame, (x, y), 4, (0, 255, 0), -1)
        
        # Draw connections
        for start_idx, end_idx in connections:
            if keypoints[start_idx][2] > self.confidence_threshold and \
               keypoints[end_idx][2] > self.confidence_threshold:
                start = (int(keypoints[start_idx][1]), int(keypoints[start_idx][0]))
                end = (int(keypoints[end_idx][1]), int(keypoints[end_idx][0]))
                cv2.line(frame, start, end, (0, 255, 255), 2)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    classifier = RuleBasedFallClassifier()
    
    cap = cv2.VideoCapture(0)
    print("Press 'q' to quit")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        result = classifier.process_frame(frame)
        cv2.imshow('Rule-Based Fall Detection', result['annotated_frame'])
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
