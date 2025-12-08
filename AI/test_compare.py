"""Compare two different people to verify Facenet512 works correctly"""
from deepface import DeepFace
import os

# Test giữa 2 người khác nhau
img1 = 'data/faces/180003466/1.jpg'  # Nguoi 1

# Tim file cua 180003467
dir_467 = 'data/faces/180003467'
files = os.listdir(dir_467)
print(f'Files in 180003467: {files}')

if files:
    img2 = os.path.join(dir_467, files[0])
    print(f'Comparing:')
    print(f'  Person 1: {img1}')
    print(f'  Person 2: {img2}')
    
    # So sanh 2 nguoi khac nhau
    result = DeepFace.verify(img1, img2, model_name='Facenet512', enforce_detection=False)
    print(f'\nResult:')
    print(f'  Distance: {result["distance"]:.4f}')
    print(f'  Similarity: {1 - result["distance"]:.4f}')
    print(f'  Verified (same person?): {result["verified"]}')
    print(f'  Threshold: {result["threshold"]}')
    
    if result["verified"]:
        print('\n⚠️ WARNING: Model thinks these are the SAME person!')
        print('   This may indicate the images look similar or lighting/angle issues')
    else:
        print('\n✅ Good: Model correctly identifies these as DIFFERENT people')
