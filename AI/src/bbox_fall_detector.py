"""
Bounding Box Fall Detection
Detect falls based on bounding box changes, NOT keypoints
More reliable when person pose is deformed during fall
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
    FALLING = "falling"
    LYING = "lying"
    UNKNOWN = "unknown"


@dataclass
class BboxInfo:
    """Bounding box information"""
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    
    @property
    def center_x(self) -> float:
        return (self.x1 + self.x2) / 2
    
    @property
    def center_y(self) -> float:
        return (self.y1 + self.y2) / 2
    
    @property
    def width(self) -> float:
        return self.x2 - self.x1
    
    @property
    def height(self) -> float:
        return self.y2 - self.y1
    
    @property
    def area(self) -> float:
        return self.width * self.height
    
    @property
    def aspect_ratio(self) -> float:
        """Width/Height ratio. >1 = horizontal, <1 = vertical"""
        return self.width / self.height if self.height > 0 else 0


@dataclass
class FallEvent:
    """Fall event data"""
    timestamp: float
    confidence: float
    location: Tuple[int, int]
    bbox: BboxInfo
    frame_data: bytes


class BboxFallDetector:
    """
    Fall Detection based on Bounding Box tracking
    
    Key idea: Track how bbox changes when falling
    - center_y: drops suddenly (person falls down)
    - aspect_ratio: vertical → horizontal (standing → lying)
    - area: increases (person spreads out when lying)
    """
    
    def __init__(self, config: dict = None):
        self.config = config or {}
        
        # Load YOLOv8 object detection (NOT pose)
        model_path = self.config.get('model_path', 'yolov8s.pt')
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        
        logger.info(f"Loading YOLOv8 object detection: {model_path}")
        self.model = YOLO(model_path)
        
        # Detection settings
        self.conf_threshold = self.config.get('conf_threshold', 0.25)
        self.iou_threshold = self.config.get('iou_threshold', 0.45)
        self.half_precision = self.config.get('half_precision', True)
        
        # Bbox tracking history
        self.bbox_history: deque = deque(maxlen=30)  # 30 frames ~ 1s
        self.timestamp_history: deque = deque(maxlen=30)
        
        # Fall detection thresholds
        self.vertical_drop_threshold = self.config.get('vertical_drop_threshold', 0.15)  # 15% of frame height
        self.aspect_ratio_threshold = self.config.get('aspect_ratio_threshold', 1.2)  # horizontal when > 1.2
        self.area_increase_threshold = self.config.get('area_increase_threshold', 1.3)  # 30% larger
        
        # State tracking
        self.current_state = FallState.UNKNOWN
        self.last_fall_time = 0
        self.cooldown_seconds = self.config.get('cooldown_seconds', 5)
        self.fall_confirmed = False
        
        # Missing detection handling
        self.missing_frames = 0
        self.max_missing_frames = self.config.get('max_missing_frames', 15)
        self.last_valid_bbox: Optional[BboxInfo] = None
        
        # Frame counter for logging
        self.frame_count = 0
        self.log_interval = 30  # Log every 30 frames
        
        logger.info("✅ Bbox Fall Detector initialized")
        logger.info(f"   Device: {self.device}")
        logger.info(f"   Conf threshold: {self.conf_threshold}")
        logger.info(f"   Vertical drop threshold: {self.vertical_drop_threshold}")
        logger.info(f"   Aspect ratio threshold: {self.aspect_ratio_threshold}")
    
    def _detect_person(self, frame: np.ndarray) -> Optional[BboxInfo]:
        """Detect person bounding box using YOLOv8"""
        results = self.model(
            frame,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            device=self.device,
            half=self.half_precision,
            classes=[0],  # class 0 = person
            verbose=False
        )
        
        if len(results) == 0 or len(results[0].boxes) == 0:
            logger.debug(f"No person detected (frame {self.frame_count})")
            return None
        
        # Get first person detection (highest confidence)
        box = results[0].boxes[0]
        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
        conf = float(box.conf[0].cpu().numpy())
        
        return BboxInfo(x1, y1, x2, y2, conf)
    
    def _calculate_vertical_displacement(self, frame_height: int) -> float:
        """Calculate vertical displacement (normalized 0-1)"""
        if len(self.bbox_history) < 2:
            return 0.0
        
        # Compare with 5 frames ago (if available)
        lookback = min(5, len(self.bbox_history) - 1)
        current_bbox = self.bbox_history[-1]
        prev_bbox = self.bbox_history[-lookback - 1]
        
        if current_bbox is None or prev_bbox is None:
            return 0.0
        
        # Positive = moving down
        displacement = current_bbox.center_y - prev_bbox.center_y
        normalized = displacement / frame_height
        
        return normalized
    
    def _calculate_aspect_ratio_change(self) -> float:
        """Calculate aspect ratio change"""
        if len(self.bbox_history) < 2:
            return 0.0
        
        lookback = min(5, len(self.bbox_history) - 1)
        current_bbox = self.bbox_history[-1]
        prev_bbox = self.bbox_history[-lookback - 1]
        
        if current_bbox is None or prev_bbox is None:
            return 0.0
        
        current_ratio = current_bbox.aspect_ratio
        prev_ratio = prev_bbox.aspect_ratio
        
        if prev_ratio == 0:
            return 0.0
        
        # >1 = becoming more horizontal
        return current_ratio / prev_ratio
    
    def _calculate_area_change(self) -> float:
        """Calculate area change ratio"""
        if len(self.bbox_history) < 2:
            return 1.0
        
        lookback = min(5, len(self.bbox_history) - 1)
        current_bbox = self.bbox_history[-1]
        prev_bbox = self.bbox_history[-lookback - 1]
        
        if current_bbox is None or prev_bbox is None or prev_bbox.area == 0:
            return 1.0
        
        return current_bbox.area / prev_bbox.area
    
    def _determine_state(self, bbox: BboxInfo, frame_height: int, vertical_disp: float) -> FallState:
        """Determine current state based on bbox properties"""
        
        # LYING: horizontal + in lower part of frame
        center_y_normalized = bbox.center_y / frame_height
        if bbox.aspect_ratio > self.aspect_ratio_threshold and center_y_normalized > 0.6:
            return FallState.LYING
        
        # FALLING: sudden vertical drop + transitioning to horizontal
        if vertical_disp > self.vertical_drop_threshold and bbox.aspect_ratio > 1.0:
            return FallState.FALLING
        
        # STANDING: vertical + upper part
        if bbox.aspect_ratio < 0.8 and center_y_normalized < 0.7:
            return FallState.STANDING
        
        return FallState.UNKNOWN
    
    def _check_fall_pattern(self, current_time: float, frame_height: int) -> bool:
        """Check if bbox changes indicate a fall"""
        
        if len(self.bbox_history) < 5:
            return False
        
        current_bbox = self.bbox_history[-1]
        if current_bbox is None:
            return False
        
        # Calculate metrics
        vertical_disp = self._calculate_vertical_displacement(frame_height)
        aspect_change = self._calculate_aspect_ratio_change()
        area_change = self._calculate_area_change()
        
        # Fall pattern detection
        # 1. Sudden downward movement
        sudden_drop = vertical_disp > self.vertical_drop_threshold
        
        # 2. Becoming horizontal (vertical → horizontal)
        becoming_horizontal = (
            aspect_change > 1.3 and  # Aspect ratio increased 30%
            current_bbox.aspect_ratio > 1.0  # Now horizontal
        )
        
        # 3. Area increase (person spreads out)
        area_increased = area_change > self.area_increase_threshold
        
        # Fall detected if at least 2 patterns match
        patterns_matched = sum([sudden_drop, becoming_horizontal, area_increased])
        
        if patterns_matched >= 2:
            logger.warning(
                f"🚨 Fall pattern detected! "
                f"Drop: {vertical_disp:.3f}, "
                f"Aspect: {current_bbox.aspect_ratio:.2f} (Δ{aspect_change:.2f}), "
                f"Area: Δ{area_change:.2f}"
            )
            return True
        
        return False
    
    def process_frame(self, frame: np.ndarray) -> dict:
        """Process frame and detect falls"""
        self.frame_count += 1
        current_time = cv2.getTickCount() / cv2.getTickFrequency()
        frame_height = frame.shape[0]
        
        fall_detected = False
        fall_event = None
        annotated_frame = frame.copy()
        
        # Detect person bbox
        bbox = self._detect_person(frame)
        
        if bbox is None:
            self.missing_frames += 1
            self.bbox_history.append(None)
            self.timestamp_history.append(current_time)
            
            # Periodic logging
            if self.frame_count % self.log_interval == 0:
                logger.warning(f"Frame {self.frame_count}: No person detected ({self.missing_frames} missing)")
            
            # Handle missing detection
            if self.missing_frames > self.max_missing_frames:
                self.current_state = FallState.UNKNOWN
            
            return {
                'fall_detected': False,
                'fall_event': None,
                'annotated_frame': annotated_frame,
                'state': self.current_state,
                'missing_frames': self.missing_frames,
            }
        
        # Successful detection
        self.missing_frames = 0
        self.last_valid_bbox = bbox
        self.bbox_history.append(bbox)
        self.timestamp_history.append(current_time)
        
        # Periodic logging
        if self.frame_count % self.log_interval == 0:
            logger.debug(
                f"Frame {self.frame_count}: Person detected | "
                f"Aspect: {bbox.aspect_ratio:.2f}, "
                f"Conf: {bbox.confidence:.2f}"
            )
        
        # Calculate metrics
        vertical_disp = self._calculate_vertical_displacement(frame_height)
        
        # Determine state
        previous_state = self.current_state
        new_state = self._determine_state(bbox, frame_height, vertical_disp)
        self.current_state = new_state
        
        # Log state changes
        if new_state != previous_state:
            logger.info(
                f"🔄 State: {previous_state.value} → {new_state.value} | "
                f"Aspect: {bbox.aspect_ratio:.2f}, "
                f"Drop: {vertical_disp:.3f}"
            )
        
        # Check for fall
        if new_state == FallState.FALLING:
            if not self.fall_confirmed and current_time - self.last_fall_time >= self.cooldown_seconds:
                # Additional verification with pattern check
                if self._check_fall_pattern(current_time, frame_height):
                    self.fall_confirmed = True
                    self.last_fall_time = current_time
                    fall_detected = True
                    
                    # Create fall event
                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_data = buffer.tobytes()
                    
                    fall_event = FallEvent(
                        timestamp=current_time,
                        confidence=0.9,
                        location=(int(bbox.center_x), int(bbox.center_y)),
                        bbox=bbox,
                        frame_data=frame_data
                    )
                    
                    logger.error(f"🚨 FALL DETECTED! Confidence: 0.9")
        else:
            # Reset fall tracking
            if new_state == FallState.STANDING:
                self.fall_confirmed = False
        
        # Draw bbox and info
        x1, y1, x2, y2 = int(bbox.x1), int(bbox.y1), int(bbox.x2), int(bbox.y2)
        
        # Color based on state
        color = {
            FallState.STANDING: (0, 255, 0),  # Green
            FallState.FALLING: (0, 0, 255),   # Red
            FallState.LYING: (0, 165, 255),   # Orange
            FallState.UNKNOWN: (255, 255, 0), # Yellow
        }.get(new_state, (255, 255, 255))
        
        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
        
        # Draw state text
        cv2.putText(
            annotated_frame,
            f"{new_state.value.upper()}",
            (x1, y1 - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            color,
            2
        )
        
        # Draw metrics
        cv2.putText(
            annotated_frame,
            f"Aspect: {bbox.aspect_ratio:.2f}",
            (x1, y2 + 20),
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
            'bbox': bbox,
            'vertical_displacement': vertical_disp,
            'aspect_ratio': bbox.aspect_ratio,
        }


if __name__ == "__main__":
    # Simple test
    logging.basicConfig(level=logging.INFO)
    
    detector = BboxFallDetector()
    
    cap = cv2.VideoCapture(0)
    print("Press 'q' to quit")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        result = detector.process_frame(frame)
        cv2.imshow('Bbox Fall Detection', result['annotated_frame'])
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
