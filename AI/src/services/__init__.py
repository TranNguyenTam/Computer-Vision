"""
AI Services for face recognition and embedding
"""

from .face_recognition_fast import FastFaceRecognition
from .face_embedding import FaceEmbedding

__all__ = [
    'FastFaceRecognition',
    'FaceEmbedding'
]
