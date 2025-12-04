# Hospital Vision System - Frontend Dashboard

## Mô tả

React Dashboard cho hệ thống giám sát bệnh nhân và cảnh báo té ngã.

## Tính năng

- Real-time fall alerts với visual và audio notifications
- Hiển thị thông tin bệnh nhân khi được nhận diện
- Dashboard statistics
- Recent activity tracking
- SignalR real-time connection

## Yêu cầu

- Node.js 18+
- npm hoặc yarn

## Cài đặt

```bash
# Cài đặt dependencies
npm install

# Hoặc
yarn install
```

## Chạy Development

```bash
# Chạy development server
npm run dev

# Hoặc
yarn dev
```

Dashboard sẽ chạy tại: `http://localhost:3000`

## Build Production

```bash
npm run build
npm run preview
```

## Cấu hình

### Environment Variables

Tạo file `.env` (optional):

```env
VITE_API_URL=http://localhost:5000/api
VITE_SIGNALR_URL=http://localhost:5000/hubs/alerts
```

### Proxy Configuration

Trong development, requests sẽ được proxy tới backend:

- `/api/*` → `http://localhost:5000/api/*`
- `/hubs/*` → `http://localhost:5000/hubs/*`

## Components

### Dashboard (`pages/Dashboard.tsx`)

Main dashboard component với:

- Stats cards
- Active alerts panel
- Patient info panel
- Recent activity

### FallAlertCard (`components/FallAlertCard.tsx`)

Hiển thị chi tiết cảnh báo té ngã với các actions:

- Acknowledge (Tiếp nhận)
- Resolve (Đã xử lý)
- Dismiss (Báo động giả)

### PatientInfoCard (`components/PatientInfoCard.tsx`)

Hiển thị thông tin bệnh nhân:

- Basic info (tên, tuổi, giới tính)
- Current appointment
- Upcoming appointments

### StatsCards (`components/StatsCards.tsx`)

Hiển thị thống kê:

- Tổng số bệnh nhân
- Lịch khám hôm nay
- Cảnh báo đang xử lý
- Bệnh nhân đã phát hiện

### RecentActivity (`components/RecentActivity.tsx`)

Hiển thị hoạt động gần đây:

- Recent alerts
- Recent patient detections

## Real-time Features

### SignalR Events

```typescript
// Nhận cảnh báo té ngã mới
signalRService.onFallAlert((alert) => {
  // Handle new alert
});

// Nhận sự kiện phát hiện bệnh nhân
signalRService.onPatientDetected((event) => {
  // Handle patient detection
});

// Nhận cập nhật trạng thái
signalRService.onAlertStatusUpdate((data) => {
  // Handle status update
});
```

### Audio Notifications

- Sound notification khi có fall alert mới
- Toggle on/off từ header

## Cấu trúc Project

```
FE/
├── public/
├── src/
│   ├── components/
│   │   ├── FallAlertCard.tsx
│   │   ├── PatientInfoCard.tsx
│   │   ├── RecentActivity.tsx
│   │   └── StatsCards.tsx
│   ├── pages/
│   │   └── Dashboard.tsx
│   ├── services/
│   │   ├── api.ts
│   │   └── signalr.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── vite.config.ts
```

## Styling

- Tailwind CSS cho styling
- Custom animations cho alerts
- Responsive design

## Keyboard Shortcuts

Không có keyboard shortcuts hiện tại (có thể thêm sau)

## Browser Support

- Chrome (recommended)
- Firefox
- Edge
- Safari

## License

Internal use only
