# Tài liệu chi tiết AI (Computer Vision)

## 1. Mục tiêu

Hệ thống AI chịu trách nhiệm:

- Đọc video từ camera Hikvision qua RTSP.
- Phát hiện té ngã (fall detection) bằng YOLOv8-Pose.
- Nhận diện khuôn mặt, map với MÃ Y TẾ/bệnh nhân.
- Gửi cảnh báo (FallAlert) và thông tin nhận diện về Backend (BE).
- Stream video + overlay kết quả AI cho FE qua HTTP/Socket.

---

## 2. Cấu trúc thư mục AI

```txt
AI/
├── Camera.md                 # Hướng dẫn cấu hình đầu ghi, camera Hikvision
├── camera_server.py          # Flask + SocketIO server (stream + AI overlay + API)
├── run_with_backend.py       # Script CLI: fall detection + gửi alert về BE
├── requirements.txt          # Danh sách packages Python
├── config/
│   └── config.yaml           # Cấu hình camera, AI, ngưỡng, v.v.
├── data/
│   ├── faces/
│   │   └── <MAYTE>/          # Ảnh khuôn mặt theo mã y tế
│   └── uploads/              # Ảnh upload từ FE
├── scripts/                  # Các script test, tiện ích (tuỳ bạn giữ lại gì)
└── src/
    ├── api_client.py         # Gọi BE API (FallAlert, patient,...)
    ├── camera_manager.py     # Quản lý kết nối camera Hikvision (RTSP)
    ├── fall_detection_module.py # Logic state machine té ngã
    ├── yolo_fall_detector.py # Wrapper YOLOv8-Pose cho fall detection
    ├── yolo8n-pose.pt        # Model YOLOv8n-Pose (nếu để trong src)
    └── __init__.py
```

Lưu ý: một số file `face_recognition_fast.py`, `face_recognition_gpu.py` có thể đã được xóa/bỏ bớt; nếu bạn thêm lại module face recognition, nên đặt trong `src/` theo pattern tương tự.

---

## 3. `config/config.yaml`

File này cấu hình toàn bộ AI:

- Thông tin camera (IP, user, password, channel, stream_type).
- Tham số model YOLO: đường dẫn model, device (cpu/cuda), conf_threshold, iou_threshold,...
- Tham số fall detection: thời gian giữ trạng thái, ngưỡng chuyển FALL, v.v.

Ví dụ (template đơn giản):

```yaml
camera:
  ip: "192.168.1.6"
  port: 554
  username: "admin"
  password: "test@2025"
  channel: 1
  stream_type: "main" # main/sub

fall_detection:
  model_path: "yolov8n-pose.pt"
  device: "cuda" # hoặc "cpu"
  conf_threshold: 0.25
  iou_threshold: 0.45
  fall_min_frames: 5 # số frame liên tiếp để xác nhận té ngã

face_recognition:
  enabled: false
  faces_dir: "data/faces"
```

---

## 4. `camera_manager.py`

### 4.1. Lớp `HikvisionCamera`

Chịu trách nhiệm kết nối và đọc frame từ camera Hikvision qua RTSP.

Chức năng chính:

- Khởi tạo với cấu hình: IP, port, username, password, channel, stream_type.
- `connect()`: build RTSP URL, mở `cv2.VideoCapture`.
- `read_frame()`: đọc một frame (trả về `np.ndarray` hoặc `None` nếu lỗi).
- `release()`: giải phóng `VideoCapture`.
- Cơ chế thử reconnect khi mất kết nối.

### 4.2. `load_camera_configs(path)`

- Đọc `config.yaml`, trả về danh sách cấu hình camera.
- Dùng chung cho `camera_server.py` và `run_with_backend.py`.

---

## 5. YOLOv8 Fall Detection

### 5.1. `yolo_fall_detector.py`

- Load model YOLOv8-Pose từ file `yolov8n-pose.pt`.
- Hàm chính (ví dụ): `detect(frame)`:
  - Resize/prepare frame, chạy `model(frame)`.
  - Lấy keypoints (skeleton) cho từng người.
  - Tính toán các đặc trưng (góc, tỉ lệ chiều cao/chiều ngang, v.v.) để suy luận tư thế.
  - Trả về danh sách:
    - bounding box
    - keypoints
    - pose/state (STANDING, SITTING, LYING, FALLING/FALL)

### 5.2. `fall_detection_module.py`

- Xây dựng state machine để tránh báo động giả:
  - Track mỗi người qua nhiều frame.
  - Nếu từ STANDING → FALLING → LYING trong một khoảng thời gian ngắn → đánh dấu FALL.
  - Có thể lưu timestamp bắt đầu FALL, đếm số lần fall, v.v.

Kết quả cuối cùng được dùng bởi:

- `camera_server.py` để vẽ overlay + gửi qua SocketIO.
- `run_with_backend.py` để quyết định khi nào gửi alert lên BE.

---

## 6. `camera_server.py` – Flask + SocketIO Server

### 6.1. Chức năng

- Chạy server Flask phục vụ:
  - Stream MJPEG: cho phép FE/hoặc trình duyệt xem video realtime.
  - WebSocket (SocketIO): push frame + metadata AI (fall, face) cho FE.
  - REST API: upload ảnh, bật/tắt AI, lấy stats.

### 6.2. Global state

- `camera`: đối tượng `HikvisionCamera`.
- `fall_detector`: đối tượng `YOLOFallDetector`.
- `face_recognizer`: module nhận diện khuôn mặt (nếu bật).
- `ai_settings`: dict bật/tắt `ai_enabled`, `fall_detection_enabled`, `face_recognition_enabled`.
- `stats`: fps, số lần té ngã, số khuôn mặt nhận diện, state hiện tại,...

### 6.3. Vòng lặp xử lý frame

1. Đọc frame từ `camera`.
2. Nếu `ai_enabled` và `fall_detection_enabled`:
   - Chạy `fall_detector` để phát hiện người + tư thế.
3. Nếu `face_recognition_enabled`:
   - Chạy module face recognition trên frame.
4. Vẽ overlay: box, skeleton, label tư thế, tên bệnh nhân.
5. Cập nhật `stats`.
6. Đẩy frame ra:
   - MJPEG stream.
   - hoặc encode base64 gửi qua SocketIO cùng với JSON metadata.

---

## 7. `run_with_backend.py` – Fall Detection + BE API

### 7.1. Mục đích

- Chạy thuần túy trên console, không cần Flask.
- Dùng để test nhanh luồng AI ↔ BE: khi té ngã thì gửi alert POST về BE.

### 7.2. Quy trình

1. Kiểm tra BE có chạy không (gọi `/api/alerts/active`).
2. Load cấu hình từ `config/config.yaml`.
3. Tạo `HikvisionCamera` và `YOLOFallDetector`.
4. Loop đọc frame:
   - Chạy fall detection.
   - Nếu phát hiện té ngã với `confidence` đủ lớn:
     - Encode frame sang JPG, base64.
     - Gọi `send_fall_alert()`:
       - POST tới `http://localhost:5000/api/fall-alert`.
       - Body gồm: `patientId`, `location`, `confidence`, `frameData`, `cameraId`.

---

## 8. Face Recognition (nếu tích hợp)

### 8.1. Tổ chức dữ liệu

- Thư mục `data/faces/<MAYTE>/`:
  - `MAYTE` là mã y tế của bệnh nhân.
  - Mỗi thư mục chứa nhiều ảnh khuôn mặt của cùng một bệnh nhân.

### 8.2. Quy trình nhận diện

1. Khởi động hệ thống, module face recognition sẽ:
   - Duyệt `data/faces`, trích xuất embedding cho mỗi ảnh.
   - Lưu index embedding trong memory (kèm theo MÃ Y TẾ).
2. Khi có frame mới:
   - Detect face, crop ảnh.
   - Tính embedding.
   - So sánh với index để tìm nearest neighbor.
   - Nếu similarity > threshold → coi như nhận diện thành công → lấy `MaYTe` tương ứng.
3. Gọi BE:
   - `FaceController.ValidateMaYTe` để kiểm tra trong `TT_BENHNHAN`.
   - Nếu hợp lệ, có thể lưu `FaceImage` và hiển thị thông tin bệnh nhân trên FE.

---

## 9. Tích hợp AI ↔ BE

### 9.1. Fall Alert

- AI (qua `run_with_backend.py` hoặc `camera_server.py`) gửi POST tới BE:
  - Endpoint: `/api/fall-alert`.
  - Payload: thông tin camera, thời gian, độ tin cậy, ảnh.
- BE lưu vào bảng `FallAlerts` và phát event SignalR.

### 9.2. Face Recognition

- AI nhận diện khuôn mặt → lấy `MaYTe`.
- Gọi BE:
  - Validate và trả về thông tin bệnh nhân (`BenhNhanController`, `FaceController`).
- FE hiển thị tên, tuổi, thông tin bệnh nhân tương ứng.

---

## 10. Cách chạy nhanh phần AI

### 10.1. Chuẩn bị môi trường

```powershell
cd "D:\Intern\Computer Vision\AI"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 10.2. Chạy camera server

```powershell
cd "D:\Intern\Computer Vision\AI"
.venv\Scripts\activate
python camera_server.py
```

### 10.3. Chạy fall detection + backend

```powershell
cd "D:\Intern\Computer Vision\AI"
.venv\Scripts\activate
python run_with_backend.py
```

Nếu bạn muốn, tôi có thể bổ sung thêm phần "Troubleshooting" (lỗi thường gặp với camera, RTSP, CUDA, model YOLO) vào file này.
