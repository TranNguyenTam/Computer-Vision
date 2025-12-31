"""
Test Hybrid Fall Detection
"""

import cv2
import logging
import argparse
from pathlib import Path
import yaml
from src.hybrid_fall_detector import HybridFallDetector

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_config(config_path: str = 'config/config.yaml') -> dict:
    """Load configuration"""
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def test_video(video_path: str, save_output: bool = False, debug: bool = False):
    """Test hybrid fall detection on video"""
    
    if debug:
        logging.getLogger().setLevel(logging.DEBUG)
        logging.getLogger('src.hybrid_fall_detector').setLevel(logging.DEBUG)
    
    # Load config
    config = load_config()
    hybrid_config = config.get('hybrid_fall_detection', {})
    
    logger.info(f"🎥 Testing video: {video_path}")
    logger.info(f"📋 Config: {hybrid_config}")
    
    # Initialize detector
    detector = HybridFallDetector(hybrid_config)
    
    # Open video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error(f"❌ Cannot open video: {video_path}")
        return
    
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    logger.info(f"📊 Video: {width}x{height} @ {fps}fps, {total_frames} frames")
    
    # Setup output video
    output_writer = None
    if save_output:
        output_path = Path(video_path).stem + '_hybrid_output.mp4'
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        output_writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        logger.info(f"💾 Saving output to: {output_path}")
    
    # Process video
    frame_count = 0
    fall_count = 0
    fall_frames = []
    fall_methods = []
    
    print("\nControls:")
    print("  SPACE - Pause/Resume")
    print("  Q - Quit")
    print("  S - Save current frame\n")
    
    paused = False
    
    while True:
        if not paused:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_count += 1
            
            # Process frame
            result = detector.process_frame(frame)
            
            # Check for fall
            if result['fall_detected']:
                fall_count += 1
                fall_frames.append(frame_count)
                fall_methods.append(result['detection_method'])
                logger.warning(
                    f"🚨 FALL #{fall_count} detected at frame {frame_count} "
                    f"via {result['detection_method']}"
                )
                
                # Save fall image
                fall_image_path = f'data/uploads/fall_hybrid_{fall_count}_frame_{frame_count}.jpg'
                cv2.imwrite(fall_image_path, frame)
                logger.info(f"💾 Saved fall image: {fall_image_path}")
            
            annotated = result['annotated_frame']
            
            # Add frame counter
            cv2.putText(
                annotated,
                f"Frame: {frame_count}/{total_frames}",
                (10, height - 60),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2
            )
            
            # Add fall counter
            cv2.putText(
                annotated,
                f"Falls: {fall_count}",
                (10, height - 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 0, 255) if fall_count > 0 else (255, 255, 255),
                2
            )
            
            # Write to output
            if output_writer:
                output_writer.write(annotated)
            
            # Display
            cv2.imshow('Hybrid Fall Detection Test', annotated)
        else:
            # Just display last frame
            cv2.imshow('Hybrid Fall Detection Test', annotated)
        
        # Handle keyboard
        key = cv2.waitKey(1 if not paused else 0) & 0xFF
        
        if key == ord('q'):
            logger.info("🛑 Quit requested")
            break
        elif key == ord(' '):
            paused = not paused
            logger.info(f"{'⏸️ Paused' if paused else '▶️ Resumed'}")
        elif key == ord('s'):
            save_path = f'data/uploads/snapshot_frame_{frame_count}.jpg'
            cv2.imwrite(save_path, annotated)
            logger.info(f"💾 Saved snapshot: {save_path}")
    
    # Cleanup
    cap.release()
    if output_writer:
        output_writer.release()
    cv2.destroyAllWindows()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 DETECTION SUMMARY")
    print("=" * 50)
    print(f"Total frames: {frame_count}")
    print(f"Falls detected: {fall_count}")
    if fall_frames:
        print(f"Fall frames: {fall_frames}")
        print(f"Detection methods: {fall_methods}")
    print("=" * 50)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Test Hybrid Fall Detection')
    parser.add_argument('video_path', help='Path to test video')
    parser.add_argument('--save-output', action='store_true', help='Save output video')
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')
    
    args = parser.parse_args()
    
    test_video(args.video_path, args.save_output, args.debug)
