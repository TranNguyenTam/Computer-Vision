# Tài liệu tổng quan BE & AI

## 1. BE (Backend)

### 1.1. Cấu trúc chính

- `BE/Database/`
  - `schema_sqlserver.sql`: script tạo các bảng logic mới (Patients, Doctors, Rooms, Appointments, FallAlerts, DetectionEvents) cho hệ thống Hospital Vision (dùng khi triển khai mới).
  - `schema_postgresql.sql`: phiên bản schema cho PostgreSQL (nếu triển khai bằng PostgreSQL).
- `BE/HospitalVision.API/`
  - `Program.cs`: cấu hình ASP.NET Core Web API, DI, logging, CORS, SignalR, DbContext.
  - `appsettings.json`, `appsettings.Development.json`: cấu hình kết nối database (SqlServer, QmsDatabase, PostgreSQL), logging, CORS,...
  - `Controllers/`
    - `DashboardController.cs`: API tổng hợp thống kê cho dashboard (số bệnh nhân, alert, v.v.).
    - `AlertController.cs`: quản lý Fall Alerts (list, tạo alert mới, cập nhật trạng thái...).
    - `PatientController.cs`: API cho AI module lấy thông tin bệnh nhân logic (bảng Patients trong schema mới).
    - `BenhNhanController.cs`: API truy vấn trực tiếp bảng `TT_BENHNHAN` trong DB HIS thật (`PRODUCT_HIS`) – dùng cho tích hợp với HIS.
    - `FaceController.cs`: API liên quan đến lưu ảnh khuôn mặt, validate MÃ Y TẾ trong bảng `TT_BENHNHAN`, quản lý `FaceImage`.
  - `Data/`
    - `HospitalDbContext.cs`: DbContext chính, map bảng `TT_BENHNHAN` và các bảng logic (Patients, FallAlerts,...).
    - `QmsDbContext.cs`: DbContext kết nối hệ thống QMS (xếp hàng khám).
  - `Models/`
    - `BenhNhan.cs`: entity map bảng `TT_BENHNHAN` trong DB `PRODUCT_HIS` (đầy đủ cột HIS).
    - `Entities.cs`: model cho các bảng logic như `Patient`, `FallAlert`, `DetectionEvent`,... (schema mới).
    - `FaceImage.cs`: model lưu metadata ảnh khuôn mặt (Id, PatientId, FilePath, CreatedAt, HasEncoding...).
    - `DTOs.cs`: các DTO trả ra cho FE (DashboardStats, FallAlertDto, PatientInfoDto...).
  - `Services/`
    - `AlertService.cs`: nghiệp vụ xử lý FallAlert (tạo alert, cập nhật trạng thái, truy vấn lịch sử...).
    - `NotificationService.cs`: push notification qua SignalR tới FE khi có alert / sự kiện mới.
    - `PatientService.cs`: nghiệp vụ liên quan tới bảng `Patients` và map với HIS nếu cần.
  - `Hubs/`
    - `AlertHub.cs`: SignalR Hub dùng để realtime gửi alert té ngã / cập nhật dashboard tới FE.

### 1.2. Vai trò của BE

- Cung cấp REST API cho FE (dashboard, danh sách alert, lịch sử, thông tin bệnh nhân...).
- Cung cấp API cho AI (AI gửi Fall Alert, AI query thông tin bệnh nhân sau khi nhận diện mặt).
- Realtime update qua SignalR cho FE (Alert mới, cập nhật trạng thái, thống kê).
- Truy vấn trực tiếp DB HIS qua bảng `TT_BENHNHAN` để tận dụng dữ liệu bệnh viện sẵn có.

---

## 2. AI (Computer Vision) – **Quan trọng nhất**

### 2.1. Cấu trúc thư mục

- `AI/Camera.md`
  - Tài liệu cấu hình đầu ghi và camera Hikvision (IP, account, password, hướng dẫn setup).
  - Phần mô tả FastAPI backend là tài liệu tham khảo, không liên quan trực tiếp tới project hiện tại.
- `AI/requirements.txt`
  - Danh sách Python packages cho AI: `opencv-python`, `flask`, `flask-socketio`, `flask-cors`, `torch`, `ultralytics` (YOLOv8), `face-recognition`, v.v.
- `AI/config/config.yaml`
  - Cấu hình camera, RTSP, tham số YOLO, ngưỡng té ngã, tuỳ chọn GPU/CPU...
- `AI/data/`
  - `faces/<MAYTE>/`: thư mục chứa ảnh khuôn mặt theo mã y tế (folder name = MÃ Y TẾ).
  - `uploads/`: nơi lưu ảnh upload từ FE (đăng ký / cập nhật khuôn mặt).
- `AI/src/`
  - `camera_manager.py`: lớp `HikvisionCamera`, quản lý kết nối RTSP, đọc frame, reconnect,...
  - `yolo_fall_detector.py`: lớp `YOLOFallDetector` dùng YOLOv8-Pose để detect người và tư thế, xác định té ngã.
  - `fall_detection_module.py`: logic xử lý luồng té ngã (tracking, debounce, state machine FALLING/STANDING...).
  - `api_client.py`: client gọi BE API (gửi FallAlert, đồng bộ thông tin bệnh nhân...).
  - `face_recognition_fast.py` / `face_recognition_gpu.py`: (trước đây dùng; hiện tại có thể đã xoá/đơn giản hoá) –
    - phiển bản CPU nhanh, và phiên bản GPU dùng `face-recognition`/`dlib` hoặc `facenet`.
  - `yolov8n-pose.pt`: model YOLOv8n-Pose dùng cho fall detection.
- File Python chính:
  - `camera_server.py`: **server chính** chạy Flask + SocketIO để stream video + overlay AI + REST API.
  - `run_with_backend.py`: script CLI để chạy fall detection và gửi alert trực tiếp về BE (không cần Flask UI).

### 2.2. `camera_server.py` – Camera Streaming + AI Server

Chức năng chính:

- Chạy một Flask server cung cấp:
  - Endpoint MJPEG stream (`/stream`) để FE xem video live.
  - WebSocket (SocketIO) gửi frame + kết quả AI (fall detection, face recognition) realtime cho FE.
  - Endpoint upload ảnh khuôn mặt (đăng ký bệnh nhân mới, update ảnh).
- Quản lý global state:
  - `camera`: instance `HikvisionCamera` kết nối tới camera Hikvision.
  - `fall_detector`: instance `YOLOFallDetector` dùng YOLOv8-Pose.
  - `face_recognizer`: module nhận diện khuôn mặt (GPU nếu có, fallback CPU).
  - `ai_settings`: bật/tắt AI, fall detection, face recognition.
  - `stats`: thống kê fps, số lần té ngã, số khuôn mặt nhận diện...
- Quy trình xử lý frame:
  1. Đọc frame từ `HikvisionCamera`.
  2. Nếu `fall_detection_enabled = True`: chạy YOLOv8-Pose, suy luận tư thế, detect té ngã.
  3. Nếu `face_recognition_enabled = True`: chạy nhận diện mặt, map với MÃ Y TẾ trong thư mục `data/faces`.
  4. Vẽ overlay (bounding box, skeleton, label tư thế, tên bệnh nhân) lên frame.
  5. Gửi frame (MJPEG hoặc base64) + metadata qua SocketIO cho FE.
- Tích hợp BE:
  - Khi detect té ngã, có thể gọi `api_client` hoặc gửi event cho BE/FE để tạo FallAlert.

### 2.3. `run_with_backend.py` – Fall Detection + BE Integration

Chức năng:

- Chạy fall detection từ camera Hikvision, **không cần Flask/UI**, tập trung vào gửi alert về BE.
- Quy trình:
  1. Kiểm tra kết nối BE API (`/api/alerts/active`).
  2. Đọc config từ `config/config.yaml`.
  3. Khởi tạo `HikvisionCamera` và `YOLOFallDetector`.
  4. Loop đọc frame từ camera, chạy fall detection.
  5. Khi phát hiện té ngã với độ tin cậy > ngưỡng:
     - Encode frame sang JPG, base64.
     - Gọi hàm `send_fall_alert()` để POST tới BE `/api/fall-alert` với payload: `patientId`, `location`, `confidence`, `frameData`, `cameraId`.

### 2.4. `camera_manager.py`

- Định nghĩa class `HikvisionCamera`:
  - Thuộc tính: IP, port, username, password, channel, stream type.
  - Hàm:
    - `connect()`: mở kết nối RTSP.
    - `read_frame()`: đọc một frame (trả về `np.ndarray` hoặc `None`).
    - `release()`: đóng kết nối.
    - Cơ chế reconnect nếu mất kết nối.
- Hàm `load_camera_configs(path)`: đọc `config.yaml` để lấy danh sách camera.

### 2.5. `yolo_fall_detector.py` + `fall_detection_module.py`

- `YOLOFallDetector`:
  - Load model YOLOv8-Pose từ `yolov8n-pose.pt`.
  - Hàm `detect(frame)`:
    - Chạy inference.
    - Trả về danh sách người với keypoints + trạng thái tư thế (đứng, ngồi, nằm, té ngã).
- `fall_detection_module.py`:
  - Xây dựng logic FSM/state machine để tránh false-positive:
    - Theo dõi lịch sử tư thế theo thời gian.
    - Chỉ báo `FALL` khi `lying` kéo dài đủ lâu hoặc có chuyển động bất thường.

### 2.6. Face Recognition (nếu đang bật)

- Sử dụng thư mục `data/faces/<MAYTE>/` để tổ chức ảnh khuôn mặt theo MÃ Y TẾ.
- Module GPU/CPU (tùy config) sẽ:
  - Index tất cả embeddings từ thư mục faces.
  - Khi có frame mới, crop mặt, tính embedding và tìm nearest neighbor.
  - Trả về `patientId` hoặc `MaYTe` để gọi BE:
    - BE (`FaceController`, `BenhNhanController`) sẽ:
      - Validate MÃ Y TẾ trong `TT_BENHNHAN`.
      - Lưu `FaceImage` kèm `PatientId`/MAYTE.

---

## 3. Luồng tổng thể AI ↔ BE ↔ FE

1. **AI ↔ BE**

   - AI gửi FallAlert qua `run_with_backend.py` hoặc qua `camera_server.py` + `api_client`.
   - Payload gồm hình ảnh (base64), độ tin cậy, cameraId, location.
   - BE lưu vào bảng `FallAlerts`, phát SignalR alert mới.

2. **AI ↔ BE (Face)**

   - AI nhận diện khuôn mặt → lấy `MaYTe` → gọi BE (`FaceController.ValidateMaYTe`).
   - BE kiểm tra tồn tại trong `TT_BENHNHAN`, trả về thông tin bệnh nhân hoặc lỗi.
   - BE lưu metadata ảnh vào `FaceImage` nếu cần.

3. **BE ↔ FE**
   - FE dùng `alertApi`, `dashboardApi`, `patientApi` để lấy dữ liệu alert, thống kê dashboard, thông tin bệnh nhân.
   - FE kết nối SignalR (`AlertHub`) qua hook `useSignalR.ts` để nhận alert mới realtime.

---

## 4. Cách chạy nhanh

### 4.1. Backend (BE)

```powershell
cd "D:\Intern\Computer Vision\BE\HospitalVision.API"
dotnet run
```

### 4.2. AI – Camera Server

```powershell
cd "D:\Intern\Computer Vision\AI"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python camera_server.py
```

### 4.3. AI – Fall Detection + Backend

```powershell
cd "D:\Intern\Computer Vision\AI"
.venv\Scripts\activate
python run_with_backend.py
```

File này chỉ là overview; nếu bạn muốn, tôi có thể tách riêng thành `AI_README.md` chi tiết hơn cho phần AI (cấu hình, tham số YOLO, cách training/finetune, v.v.).
