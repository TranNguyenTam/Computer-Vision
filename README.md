# Hospital Vision System

Hệ thống nhận diện bệnh nhân và phát hiện té ngã cho bệnh viện sử dụng Computer Vision.

## Tổng quan

Hệ thống bao gồm 3 module chính:

### 1. AI Module (Python)

- **Face Recognition**: Nhận diện khuôn mặt bệnh nhân để lấy mã bệnh nhân
- **Fall Detection**: Phát hiện té ngã sử dụng MediaPipe pose estimation
- **Real-time Processing**: Xử lý video stream từ webcam/camera

### 2. Backend API (.NET Core)

- REST API endpoints cho patient và alert management
- Real-time notifications qua SignalR
- Entity Framework Core với SQL Server/PostgreSQL support

### 3. Frontend Dashboard (React + Vite)

- Real-time alerts display
- Patient information panel
- Dashboard statistics

## Cấu trúc Project

```
Computer Vision/
├── AI/                          # AI Module (Python)
│   ├── config/                  # Configuration files
│   ├── data/                    # Face encodings database
│   ├── scripts/                 # Utility scripts
│   ├── src/                     # Source code
│   ├── tests/                   # Test scripts
│   ├── requirements.txt
│   └── README.md
│
├── BE/                          # Backend API (.NET Core)
│   └── HospitalVision.API/
│       ├── Controllers/
│       ├── Data/
│       ├── Hubs/
│       ├── Models/
│       ├── Services/
│       └── README.md
│
└── FE/                          # Frontend Dashboard (React)
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── services/
    │   └── types/
    ├── package.json
    └── README.md
```

## Quick Start

### 1. Khởi động Backend

```bash
cd BE/HospitalVision.API
dotnet restore
dotnet run
```

Backend sẽ chạy tại: http://localhost:5000

### 2. Khởi động Frontend

```bash
cd FE
npm install
npm run dev
```

Frontend sẽ chạy tại: http://localhost:3000

### 3. Chạy AI Module

```bash
cd AI
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Đăng ký bệnh nhân
python scripts/register_patient.py --mode webcam --patient-id P001

# Chạy ứng dụng chính
python src/main.py
```

## Workflow

### Bước 1: Đăng ký khuôn mặt bệnh nhân

1. Bệnh nhân đăng ký tại quầy
2. Chụp ảnh khuôn mặt (3-5 ảnh) từ nhiều góc
3. Encode và lưu vào database

### Bước 2: Nhận diện tự động

1. Camera phát hiện khuôn mặt
2. So sánh với database → lấy patient_id
3. Gửi thông tin đến backend
4. Dashboard hiển thị thông tin bệnh nhân (phòng khám, lịch hẹn)

### Bước 3: Phát hiện té ngã

1. MediaPipe detect skeleton/keypoints
2. Track tư thế, tốc độ, orientation
3. Sudden change → trigger fall alert
4. Backend nhận alert → broadcast to dashboard
5. Dashboard hiển thị popup cảnh báo + âm thanh

## Development Notes

### AI Module

- Sử dụng `face_recognition` library (dlib-based)
- Fall detection dựa trên body angle và vertical speed
- Configurable thresholds để giảm false positives

### Backend

- SignalR cho real-time communication
- In-Memory database cho development
- Production: SQL Server hoặc PostgreSQL

### Frontend

- TailwindCSS cho styling
- SignalR client cho real-time updates
- Audio notifications cho fall alerts

## Kế hoạch phát triển

### Phase 1: Offline Development ✅

- [x] Face Recognition Module
- [x] Fall Detection Module
- [x] Backend API
- [x] Frontend Dashboard

### Phase 2: Testing

- [ ] Test với video samples
- [ ] Điều chỉnh thresholds
- [ ] Performance optimization

### Phase 3: Onsite Integration

- [ ] Kết nối camera thật
- [ ] Test trong môi trường thực
- [ ] WebSocket/real-time optimization

### Phase 4: Additional Features

- [ ] Queue system / TTS gọi số
- [ ] Multi-camera support
- [ ] Alert history và reporting
- [ ] Mobile app

## License

Internal use only

## Contact

[Thêm thông tin liên hệ]
