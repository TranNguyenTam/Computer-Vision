"""
Path configurations for Hospital Vision AI module
"""

from pathlib import Path

# Root directory
AI_ROOT = Path(__file__).parent.parent

# Config
CONFIG_DIR = AI_ROOT / "config"
CONFIG_FILE = CONFIG_DIR / "config.yaml"

# Data
DATA_DIR = AI_ROOT / "data"
FACES_DIR = DATA_DIR / "faces"
FACES_DB = DATA_DIR / "faces_db.pkl"
UPLOADS_DIR = DATA_DIR / "uploads"

# Models
MODELS_DIR = AI_ROOT / "models"
YOLO_MODEL = MODELS_DIR / "yolov8m-pose.pt"
FACE_DETECTOR_PROTO = MODELS_DIR / "deploy.prototxt"
FACE_DETECTOR_MODEL = MODELS_DIR / "res10_300x300_ssd_iter_140000.caffemodel"
# Note: Face recognition sử dụng DeepFace + Facenet512 (auto-download)
# Không cần arcface.onnx hay face_embedding.onnx

# Outputs
OUTPUTS_DIR = AI_ROOT / "outputs"
FALL_DETECTIONS_DIR = OUTPUTS_DIR / "fall_detections"

# Logs
LOGS_DIR = AI_ROOT / "logs"

# Create directories if not exist
for directory in [DATA_DIR, FACES_DIR, UPLOADS_DIR, MODELS_DIR, 
                  OUTPUTS_DIR, FALL_DETECTIONS_DIR, LOGS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)
