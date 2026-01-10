"""
Download YOLOv8-Pose Models
Script để download các YOLOv8-pose models
"""

from ultralytics import YOLO
import sys

def download_model(model_name):
    """Download YOLOv8 pose model"""
    print(f"📥 Downloading {model_name}...")
    
    try:
        # Load model (sẽ tự động download nếu chưa có)
        model = YOLO(model_name)
        print(f"✅ Model {model_name} đã sẵn sàng!")
        
        # Test inference
        import numpy as np
        test_frame = np.zeros((640, 640, 3), dtype=np.uint8)
        results = model(test_frame, verbose=False)
        print(f"✅ Test inference thành công!")
        
        return True
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("YOLOv8-Pose Model Downloader")
    print("=" * 60)
    
    models = {
        '1': ('yolov8n-pose.pt', 'Nano - Nhanh nhất, yếu nhất (~3MB)'),
        '2': ('yolov8s-pose.pt', 'Small - Cân bằng (~11MB)'),
        '3': ('yolov8m-pose.pt', 'Medium - Chính xác, khuyến nghị (~26MB)'),
        '4': ('yolov8l-pose.pt', 'Large - Rất chính xác (~51MB)'),
        '5': ('yolov8x-pose.pt', 'XLarge - Tốt nhất nhưng chậm (~90MB)'),
    }
    
    print("\nCác model có sẵn:")
    for key, (name, desc) in models.items():
        print(f"  {key}. {name:20s} - {desc}")
    
    if len(sys.argv) > 1:
        choice = sys.argv[1]
    else:
        choice = input("\nChọn model (1-5) [3]: ").strip() or '3'
    
    if choice in models:
        model_name, desc = models[choice]
        print(f"\n✅ Đã chọn: {model_name}")
        print(f"   {desc}\n")
        
        if download_model(model_name):
            print(f"\n🎉 Hoàn thành! Model đã được lưu tại thư mục hiện tại.")
            print(f"   Cập nhật config.yaml với: model_path: \"{model_name}\"")
    else:
        print("❌ Lựa chọn không hợp lệ!")
