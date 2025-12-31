"""
Action Recognition Fall Detection using X3D
Analyzes temporal sequences to detect falling action
More robust than pose/bbox - recognizes the ACTION of falling
"""

import cv2
import numpy as np
import torch
import torch.nn.functional as F
import logging
from collections import deque
from dataclasses import dataclass
from typing import Optional, Tuple, List
from enum import Enum
import torchvision.transforms as transforms
from torchvision.models.video import r3d_18, R3D_18_Weights

logger = logging.getLogger(__name__)


class FallState(Enum):
    """Fall detection states"""
    NORMAL = "normal"
    FALLING = "falling"
    FALLEN = "fallen"
    UNKNOWN = "unknown"


@dataclass
class FallEvent:
    """Fall event data"""
    timestamp: float
    confidence: float
    location: Tuple[int, int]
    frame_data: bytes
    action_scores: dict


class ActionFallDetector:
    """
    Fall Detection using Action Recognition (Video Classification)
    
    Uses 3D CNN (R3D-18) to analyze temporal sequences
    - Looks at SEQUENCE of frames (not single frame)
    - Recognizes MOTION patterns
    - Works even when person shape is deformed
    """
    
    def __init__(self, config: dict = None):
        self.config = config or {}
        
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        logger.info(f"Device: {self.device}")
        
        # Model settings
        self.clip_length = self.config.get('clip_length', 16)  # 16 frames per clip
        self.input_size = self.config.get('input_size', 112)  # 112x112 for R3D
        self.stride = self.config.get('stride', 4)  # Process every 4 frames
        
        # Load pretrained R3D-18 model
        logger.info("Loading R3D-18 action recognition model...")
        weights = R3D_18_Weights.KINETICS400_V1
        self.model = r3d_18(weights=weights)
        self.model.to(self.device)
        self.model.eval()
        
        # Get class names
        self.class_names = weights.meta["categories"]
        
        # Map relevant Kinetics classes to fall detection
        # These classes indicate potential falls or fallen states
        self.fall_related_classes = {
            'falling off a bike': 1.0,
            'falling off a chair': 1.0,
            'faceplanting': 1.0,
            'somersaulting': 0.7,
            'tumbling': 0.7,
            'cartwheeling': 0.5,
            'tripping': 0.8,
            'slipping': 0.8,
            'collapsing': 1.0,
            'laying down': 0.6,  # Might be fallen state
        }
        
        # Find indices of fall-related classes
        self.fall_class_indices = []
        for class_name in self.class_names:
            for fall_class, weight in self.fall_related_classes.items():
                if fall_class.lower() in class_name.lower():
                    idx = self.class_names.index(class_name)
                    self.fall_class_indices.append((idx, weight))
                    logger.info(f"   Fall-related class: {class_name} (weight: {weight})")
        
        # Preprocessing transform
        self.transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((self.input_size, self.input_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.43216, 0.394666, 0.37645],
                               std=[0.22803, 0.22145, 0.216989])
        ])
        
        # Frame buffer for temporal analysis
        self.frame_buffer = deque(maxlen=self.clip_length)
        
        # Detection thresholds
        self.fall_threshold = self.config.get('fall_threshold', 0.3)  # Combined fall score
        self.confidence_threshold = self.config.get('confidence_threshold', 0.1)
        
        # State tracking
        self.current_state = FallState.NORMAL
        self.last_fall_time = 0
        self.cooldown_seconds = self.config.get('cooldown_seconds', 5)
        self.fall_confirmed = False
        
        # Frame counter
        self.frame_count = 0
        self.process_every_n = self.stride
        
        logger.info("✅ Action Fall Detector initialized")
        logger.info(f"   Clip length: {self.clip_length} frames")
        logger.info(f"   Input size: {self.input_size}x{self.input_size}")
        logger.info(f"   Fall threshold: {self.fall_threshold}")
        logger.info(f"   Found {len(self.fall_class_indices)} fall-related classes")
    
    def _preprocess_frame(self, frame: np.ndarray) -> torch.Tensor:
        """Preprocess single frame for model input"""
        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Apply transforms
        tensor = self.transform(frame_rgb)
        return tensor
    
    def _prepare_clip(self) -> Optional[torch.Tensor]:
        """Prepare clip tensor from frame buffer"""
        if len(self.frame_buffer) < self.clip_length:
            return None
        
        # Stack frames: (C, T, H, W)
        clip = torch.stack(list(self.frame_buffer), dim=1)
        
        # Add batch dimension: (1, C, T, H, W)
        clip = clip.unsqueeze(0)
        
        return clip
    
    def _calculate_fall_score(self, predictions: torch.Tensor) -> Tuple[float, dict]:
        """
        Calculate fall probability from model predictions
        Returns: (fall_score, action_scores)
        """
        # Apply softmax to get probabilities
        probs = F.softmax(predictions[0], dim=0).cpu().numpy()
        
        # Get top 5 predictions
        top5_indices = np.argsort(probs)[-5:][::-1]
        action_scores = {}
        for idx in top5_indices:
            action_scores[self.class_names[idx]] = float(probs[idx])
        
        # Calculate weighted fall score
        fall_score = 0.0
        for class_idx, weight in self.fall_class_indices:
            fall_score += probs[class_idx] * weight
        
        return fall_score, action_scores
    
    def _determine_state(self, fall_score: float, action_scores: dict) -> FallState:
        """Determine fall state from action scores"""
        
        # Check for lying/fallen state
        lying_keywords = ['laying', 'lying', 'sleeping', 'crawling']
        lying_score = 0.0
        for action, score in action_scores.items():
            for keyword in lying_keywords:
                if keyword in action.lower():
                    lying_score += score
        
        if lying_score > 0.2:
            return FallState.FALLEN
        
        # Check for falling action
        if fall_score > self.fall_threshold:
            return FallState.FALLING
        
        return FallState.NORMAL
    
    def process_frame(self, frame: np.ndarray) -> dict:
        """Process frame and detect falls"""
        self.frame_count += 1
        current_time = cv2.getTickCount() / cv2.getTickFrequency()
        
        fall_detected = False
        fall_event = None
        annotated_frame = frame.copy()
        
        # Add frame to buffer
        frame_tensor = self._preprocess_frame(frame)
        self.frame_buffer.append(frame_tensor)
        
        # Process every N frames (skip frames for speed)
        if self.frame_count % self.process_every_n != 0:
            return {
                'fall_detected': False,
                'fall_event': None,
                'annotated_frame': annotated_frame,
                'state': self.current_state,
                'fall_score': 0.0,
                'action_scores': {},
            }
        
        # Prepare clip
        clip = self._prepare_clip()
        if clip is None:
            logger.debug(f"Frame {self.frame_count}: Buffering... ({len(self.frame_buffer)}/{self.clip_length})")
            return {
                'fall_detected': False,
                'fall_event': None,
                'annotated_frame': annotated_frame,
                'state': FallState.UNKNOWN,
                'fall_score': 0.0,
                'action_scores': {},
            }
        
        # Run inference
        with torch.no_grad():
            clip = clip.to(self.device)
            predictions = self.model(clip)
        
        # Calculate fall score
        fall_score, action_scores = self._calculate_fall_score(predictions)
        
        # Determine state
        previous_state = self.current_state
        new_state = self._determine_state(fall_score, action_scores)
        self.current_state = new_state
        
        # Log state changes and top actions
        if new_state != previous_state or self.frame_count % 30 == 0:
            top_action = list(action_scores.keys())[0] if action_scores else "none"
            top_score = list(action_scores.values())[0] if action_scores else 0.0
            logger.info(
                f"Frame {self.frame_count}: {previous_state.value} → {new_state.value} | "
                f"Fall score: {fall_score:.3f} | "
                f"Top: {top_action} ({top_score:.3f})"
            )
        
        # Check for fall
        if new_state == FallState.FALLING:
            if not self.fall_confirmed and current_time - self.last_fall_time >= self.cooldown_seconds:
                self.fall_confirmed = True
                self.last_fall_time = current_time
                fall_detected = True
                
                # Create fall event
                _, buffer = cv2.imencode('.jpg', frame)
                frame_data = buffer.tobytes()
                
                fall_event = FallEvent(
                    timestamp=current_time,
                    confidence=fall_score,
                    location=(frame.shape[1] // 2, frame.shape[0] // 2),
                    frame_data=frame_data,
                    action_scores=action_scores
                )
                
                logger.error(f"🚨 FALL DETECTED! Score: {fall_score:.3f}, Actions: {action_scores}")
        else:
            if new_state == FallState.NORMAL:
                self.fall_confirmed = False
        
        # Draw visualization
        # State indicator
        color = {
            FallState.NORMAL: (0, 255, 0),      # Green
            FallState.FALLING: (0, 0, 255),     # Red
            FallState.FALLEN: (0, 165, 255),    # Orange
            FallState.UNKNOWN: (255, 255, 0),   # Yellow
        }.get(new_state, (255, 255, 255))
        
        cv2.putText(
            annotated_frame,
            f"State: {new_state.value.upper()}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            color,
            2
        )
        
        # Fall score
        cv2.putText(
            annotated_frame,
            f"Fall Score: {fall_score:.3f}",
            (10, 60),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2
        )
        
        # Top action
        if action_scores:
            top_action = list(action_scores.keys())[0]
            top_score = list(action_scores.values())[0]
            cv2.putText(
                annotated_frame,
                f"{top_action}: {top_score:.2f}",
                (10, 90),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (255, 255, 255),
                1
            )
        
        return {
            'fall_detected': fall_detected,
            'fall_event': fall_event,
            'annotated_frame': annotated_frame,
            'state': new_state,
            'fall_score': fall_score,
            'action_scores': action_scores,
        }


if __name__ == "__main__":
    # Simple test
    logging.basicConfig(level=logging.INFO)
    
    detector = ActionFallDetector()
    
    cap = cv2.VideoCapture(0)
    print("Press 'q' to quit")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        result = detector.process_frame(frame)
        cv2.imshow('Action Fall Detection', result['annotated_frame'])
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
