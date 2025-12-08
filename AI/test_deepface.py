"""Test DeepFace Facenet512 model"""
from deepface import DeepFace
import cv2
import os
import numpy as np

# Load 2 faces from same person
faces_dir = 'data/faces/180003466'
images = sorted([f for f in os.listdir(faces_dir) if f.lower().endswith(('.jpg', '.png', '.jpeg', '.heic'))])
print(f'Found {len(images)} images in {faces_dir}')

if len(images) >= 2:
    img1_path = os.path.join(faces_dir, images[0])
    img2_path = os.path.join(faces_dir, images[1])
    
    print(f'\nTesting with Facenet512 model...')
    print(f'Image 1: {images[0]}')
    print(f'Image 2: {images[1]}')
    
    # Same person - should have HIGH similarity
    try:
        result = DeepFace.verify(img1_path, img2_path, model_name='Facenet512', enforce_detection=False)
        print(f'\nSame person:')
        print(f'  Distance: {result["distance"]:.4f}')
        print(f'  Similarity: {1 - result["distance"]:.4f}')
        print(f'  Verified: {result["verified"]}')
        print(f'  Threshold: {result["threshold"]}')
    except Exception as e:
        print(f'Error: {e}')
    
    # Different person - check with another folder
    other_dirs = [d for d in os.listdir('data/faces') if d != '180003466' and os.path.isdir(os.path.join('data/faces', d))]
    if other_dirs:
        other_dir = os.path.join('data/faces', other_dirs[0])
        other_images = [f for f in os.listdir(other_dir) if f.lower().endswith(('.jpg', '.png', '.jpeg', '.heic'))]
        if other_images:
            img3_path = os.path.join(other_dir, other_images[0])
            print(f'\n\nDifferent person test:')
            print(f'  Person 1: {images[0]} (folder: 180003466)')
            print(f'  Person 2: {other_images[0]} (folder: {other_dirs[0]})')
            
            try:
                result = DeepFace.verify(img1_path, img3_path, model_name='Facenet512', enforce_detection=False)
                print(f'\nDifferent person:')
                print(f'  Distance: {result["distance"]:.4f}')
                print(f'  Similarity: {1 - result["distance"]:.4f}')
                print(f'  Verified: {result["verified"]}')
                print(f'  Threshold: {result["threshold"]}')
            except Exception as e:
                print(f'Error: {e}')

    # Test with random noise (should be VERY different)
    print('\n\nTest with random noise:')
    random_img = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
    cv2.imwrite('temp_random.jpg', random_img)
    try:
        result = DeepFace.verify(img1_path, 'temp_random.jpg', model_name='Facenet512', enforce_detection=False)
        print(f'  Random noise:')
        print(f'  Distance: {result["distance"]:.4f}')
        print(f'  Similarity: {1 - result["distance"]:.4f}')
        print(f'  Verified: {result["verified"]}')
    except Exception as e:
        print(f'Error: {e}')
    finally:
        if os.path.exists('temp_random.jpg'):
            os.remove('temp_random.jpg')
