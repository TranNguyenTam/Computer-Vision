"""
Test Fall Detection với Video MP4
Sử dụng: python test_fall_detection.py <đường_dẫn_video.mp4> [--debug] [--save-output]

Options:
  --debug         Hiển thị thông tin debug chi tiết
  --save-output   Lưu video kết quả với annotation
"""

import cv2
import sys
import time
from pathlib import Path
import argparse
from datetime import datetime
import os
import yaml
import logging

# CRITICAL: Setup logging FIRST
logging.basicConfig(
    level=logging.DEBUG,  # Set to DEBUG to see all motion detection logs
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from yolo_fall_detector import YOLOFallDetector


def load_config():
    """Load configuration from YAML"""
    config_path = Path(__file__).parent / "config" / "config.yaml"
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def test_fall_detection(video_path, debug=False, save_output=False):
    """Test fall detection với video file"""
    
    # Kiểm tra file tồn tại
    if not Path(video_path).exists():
        print(f"❌ Không tìm thấy video: {video_path}")
        return
    
    # Tạo thư mục lưu ảnh té ngã
    fall_images_dir = Path("fall_images")
    fall_images_dir.mkdir(exist_ok=True)
    
    print(f"📹 Đang mở video: {video_path}")
    print(f"📁 Ảnh té ngã sẽ được lưu tại: {fall_images_dir.absolute()}")
    
    # Mở video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("❌ Không thể mở video!")
        return
    
    # Lấy thông tin video
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"✅ Video: {width}x{height} @ {fps}fps, Tổng {total_frames} frames")
    if debug:
        print(f"🐛 DEBUG MODE: Enabled")
    
    # Load config từ YAML
    print("📋 Đang load config từ config.yaml...")
    config = load_config()
    fall_config = config.get('fall_detection', {})
    
    # Khởi tạo fall detector
    print("🔧 Đang khởi tạo Fall Detector...")
    fall_detector = YOLOFallDetector(fall_config)
    print("✅ Fall Detector đã sẵn sàng!")
    
    if debug:
        print("\n📊 THÔNG SỐ CẤU HÌNH (từ config.yaml):")
        print(f"  • Confidence threshold: {fall_config.get('conf_threshold', 0.5)}")
        print(f"  • Vertical speed threshold: {fall_config.get('fall_threshold', {}).get('vertical_speed', 0.3)}")
        print(f"  • Angle threshold: {fall_config.get('fall_threshold', {}).get('angle_threshold', 50)}°")
        print(f"  • Duration threshold: {fall_config.get('fall_threshold', {}).get('duration_threshold', 0.3)}s")
        print(f"  • Cooldown: {fall_config.get('cooldown_seconds', 10)}s")
        print(f"  • Max missing frames: {fall_config.get('max_missing_frames', 10)} frames")
    
    # Video writer nếu cần save
    out = None
    if save_output:
        output_path = f"output_{Path(video_path).stem}.mp4"
        # Thử H.264 codec (tốt hơn mp4v), fallback về XVID nếu không có
        fourcc = cv2.VideoWriter_fourcc(*'H264')  # hoặc 'avc1', 'x264'
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        # Kiểm tra nếu không mở được, thử XVID
        if not out.isOpened():
            print("⚠️  H264 không khả dụng, đang thử XVID...")
            fourcc = cv2.VideoWriter_fourcc(*'XVID')
            output_path = f"output_{Path(video_path).stem}.avi"
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        print(f"💾 Sẽ lưu output tại: {output_path}")
    
    # Stats
    frame_count = 0
    fall_count = 0
    fall_frames = []  # Lưu các frame phát hiện té ngã
    start_time = time.time()
    
    print("\n▶️  Bắt đầu xử lý video...")
    print("Nhấn 'q' để thoát, 'SPACE' để tạm dừng, 'd' để toggle debug info")
    print("-" * 60)
    
    paused = False
    show_debug = debug
    
    while True:
        if not paused:
            ret, frame = cap.read()
            if not ret:
                print("\n✅ Đã xử lý xong video!")
                break
            
            frame_count += 1
            
            # Process frame với fall detector
            result = fall_detector.process_frame(frame)
            annotated_frame = result.get('annotated_frame', frame)
            state = result.get('state', 'unknown')
            
            # Hiển thị state
            if hasattr(state, 'value'):
                state = state.value
            
            # Lấy thêm thông tin từ result
            poses = result.get('poses', [])
            motion_magnitude = result.get('motion_magnitude', 0.0)  # NEW: motion metric
            
            # Kiểm tra fall detected
            if result.get('fall_detected'):
                fall_count += 1
                fall_frames.append(frame_count)
                
                # Lưu ảnh té ngã
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                video_name = Path(video_path).stem
                image_filename = f"{video_name}_fall{fall_count}_{timestamp}_frame{frame_count}.jpg"
                image_path = fall_images_dir / image_filename
                
                cv2.imwrite(str(image_path), annotated_frame)
                
                # Kiểm tra nếu là motion-based detection
                detection_type = "POSE" if poses else "MOTION"
                
                print(f"🚨 TÉ NGÃ #{fall_count} [{detection_type}] tại frame {frame_count} ({frame_count/fps:.2f}s)")
                print(f"   💾 Đã lưu ảnh: {image_filename}")
                
                if debug:
                    if poses:
                        pose = poses[0]
                        angle = pose.get('angle', 0)
                        vertical_speed = pose.get('vertical_speed', 0)
                        print(f"   📐 Góc: {angle:.1f}°, Tốc độ: {vertical_speed:.3f}")
                    if motion_magnitude > 0:
                        print(f"   🌊 Motion: {motion_magnitude:.3f}")
            
            # Thêm thông tin lên frame
            y_offset = 30
            cv2.putText(annotated_frame, f"Frame: {frame_count}/{total_frames} ({frame_count/fps:.1f}s)", 
                       (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            y_offset += 30
            
            # State với màu tương ứng
            state_color = (0, 255, 255)  # Yellow
            if state == 'laying':
                state_color = (0, 0, 255)  # Red
            elif state == 'standing':
                state_color = (0, 255, 0)  # Green
                
            cv2.putText(annotated_frame, f"State: {state}", 
                       (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, state_color, 2)
            y_offset += 30
            
            cv2.putText(annotated_frame, f"Falls Detected: {fall_count}", 
                       (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            y_offset += 30
            
            # Hiển thị missing frames nếu có
            missing_frames = result.get('missing_frames', 0)
            if missing_frames > 0:
                cv2.putText(annotated_frame, f"Missing: {missing_frames} frames", 
                           (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
                y_offset += 30
            
            # Debug info
            if show_debug and poses:
                pose = poses[0]
                angle = pose.get('angle', 0)
                vertical_speed = pose.get('vertical_speed', 0)
                acceleration = pose.get('acceleration', 0)
                stability = pose.get('stability', 0)
                fall_conf = pose.get('fall_confidence', 0)
                center_y = pose.get('center', [0, 0])[1]
                center_y_norm = pose.get('center_y_normalized', 0)
                
                # Display metrics
                cv2.putText(annotated_frame, f"Angle: {angle:.1f} deg", 
                           (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
                y_offset +=  25
                cv2.putText(annotated_frame, f"V.Speed: {vertical_speed:.3f}", 
                           (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
                y_offset += 25
                cv2.putText(annotated_frame, f"Accel: {acceleration:.3f}", 
                           (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
                y_offset += 25
                cv2.putText(annotated_frame, f"Stability: {stability:.2f}", 
                           (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
                y_offset += 25
                
                # Fall confidence with color coding
                conf_color = (0, 255, 0) if fall_conf < 0.4 else (0, 255, 255) if fall_conf < 0.6 else (0, 165, 255) if fall_conf < 0.8 else (0, 0, 255)
                cv2.putText(annotated_frame, f"Fall Risk: {fall_conf:.2f}", 
                           (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, conf_color, 2)
                y_offset += 25
                
                cv2.putText(annotated_frame, f"Center Y: {center_y:.0f} ({center_y_norm:.2f})", 
                           (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
                y_offset += 25
                
                # Position indicator
                position_text = "HIGH" if center_y_norm < 0.5 else "MID" if center_y_norm < 0.7 else "LOW (ground)"
                position_color = (0, 255, 0) if center_y_norm < 0.5 else (0, 255, 255) if center_y_norm < 0.7 else (0, 165, 255)
                cv2.putText(annotated_frame, f"Position: {position_text}", 
                           (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, position_color, 1)
                y_offset += 25
            
            # NEW: Always show motion magnitude (works without bounding box)
            if show_debug and motion_magnitude > 0:
                motion_color = (0, 255, 0) if motion_magnitude < 0.1 else (0, 255, 255) if motion_magnitude < 0.2 else (0, 0, 255)
                cv2.putText(annotated_frame, f"Motion: {motion_magnitude:.3f}", 
                           (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, motion_color, 2)
                y_offset += 25
            
            # Lưu video nếu cần
            if out is not None:
                out.write(annotated_frame)
            
            # Hiển thị frame
            cv2.imshow('Fall Detection Test (Press \'h\' for help)', annotated_frame)
        
        # Keyboard controls
        key = cv2.waitKey(1 if not paused else 0) & 0xFF
        if key == ord('q'):
            print("\n⏹️  Dừng bởi người dùng")
            break
        elif key == ord(' '):
            paused = not paused
            if paused:
                print(f"⏸️  Tạm dừng tại frame {frame_count}")
            else:
                print("▶️  Tiếp tục")
        elif key == ord('d'):
            show_debug = not show_debug
            print(f"🐛 Debug info: {'ON' if show_debug else 'OFF'}")
        elif key == ord('h'):
            print("\n⌨️  PHÍM TẮT:")
            print("  SPACE - Tạm dừng/Tiếp tục")
            print("  d     - Bật/Tắt debug info")
            print("  q     - Thoát")
            print("  h     - Hiển thị help\n")
    
    # Cleanup
    cap.release()
    if out is not None:
        out.release()
        print(f"💾 Đã lưu video output!")
    cv2.destroyAllWindows()
    
    # Summary
    elapsed = time.time() - start_time
    print("\n" + "=" * 60)
    print("📊 KẾT QUẢ TEST:")
    print(f"  • Tổng frames xử lý: {frame_count}")
    print(f"  • Số lần phát hiện té ngã: {fall_count}")
    if fall_frames:
        print(f"  • Các frame phát hiện: {fall_frames}")
        print(f"  • Thời điểm (giây): {[f'{f/fps:.2f}s' for f in fall_frames]}")
    print(f"  • Thời gian xử lý: {elapsed:.2f}s")
    print(f"  • FPS trung bình: {frame_count/elapsed:.2f}")
    print("=" * 60)
    
    # Hiển thị config đã dùng và gợi ý
    config = load_config()
    fall_config_used = config.get('fall_detection', {})
    
    if fall_count == 0:
        print("\n⚠️  KHÔNG PHÁT HIỆN TÉ NGÃ NÀO!")
        print("💡 Gợi ý điều chỉnh trong config.yaml:")
        current_speed = fall_config_used.get('fall_threshold', {}).get('vertical_speed', 0.3)
        current_angle = fall_config_used.get('fall_threshold', {}).get('angle_threshold', 50)
        print(f"  - Giảm vertical_speed (hiện tại: {current_speed})")
        print(f"  - Tăng angle_threshold (hiện tại: {current_angle}°)")
        print("  - Chạy lại với --debug để xem chi tiết")
    elif fall_count > 1:
        print("\n⚠️  PHÁT HIỆN NHIỀU LẦN!")
        print("💡 Gợi ý điều chỉnh trong config.yaml:")
        current_cooldown = fall_config_used.get('cooldown_seconds', 10)
        current_speed = fall_config_used.get('fall_threshold', {}).get('vertical_speed', 0.3)
        print(f"  - Tăng cooldown_seconds (hiện tại: {current_cooldown}s)")
        print(f"  - Tăng vertical_speed (hiện tại: {current_speed})")
  

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Test Fall Detection với video MP4',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  python test_fall_detection.py video.mp4
  python test_fall_detection.py video.mp4 --debug
  python test_fall_detection.py video.mp4 --debug --save-output
  
Phím tắt khi chạy:
  SPACE - Tạm dừng/Tiếp tục
  d     - Bật/Tắt debug info
  q     - Thoát
  h     - Hiển thị help
        """
    )
    
    parser.add_argument('video', help='Đường dẫn đến file video MP4')
    parser.add_argument('--debug', action='store_true', 
                       help='Hiển thị thông tin debug chi tiết (góc nghiêng, tốc độ, ...)')
    parser.add_argument('--save-output', action='store_true',
                       help='Lưu video kết quả với annotation')
    
    args = parser.parse_args()
    
    test_fall_detection(args.video, debug=args.debug, save_output=args.save_output)
