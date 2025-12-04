# Thiết lập đầu ghi và camera

## Đầu ghi

- IP: 192.168.1.5
- Account: admin
- Password: test@2025

![alt text](image.png)

## Camera

- IP: 192.168.1.6
- Account: admin
- Password: test@2025

# 🚀 Hướng dẫn triển khai Backend FastAPI

## 📋 Tổng quan

Backend này được xây dựng với FastAPI, PostgreSQL và SQLAlchemy, hỗ trợ authentication JWT và quản lý người dùng với role-based access control.

## 🏗️ Kiến trúc hệ thống

```
backend/
├── main.py              # FastAPI app chính
├── database.py          # Database connection và session
├── requirements.txt     # Python dependencies
├── .env                # Environment variables
├── users/              # User management module
│   ├── config.py       # App settings
│   ├── models.py       # SQLAlchemy models
│   ├── schemas.py      # Pydantic schemas
│   └── router.py       # API endpoints
└── sql/
    └── create_tables.sql # Database initialization
```

## 📋 Yêu cầu hệ thống

- **Python 3.11+** (⚠️ Tránh Python 3.13 do conflicts với một số packages)
- **PostgreSQL 15+**
- **pgAdmin 4** (khuyến nghị cho quản lý database)
- **Windows 10/11**

## 🛠️ Hướng dẫn cài đặt từng bước

### Bước 1: Cài đặt Python 3.11+

1. **Tải Python**: https://www.python.org/downloads/
2. **Cài đặt**: ✅ **QUAN TRỌNG** - Tích "Add Python to PATH"
3. **Kiểm tra**:

```cmd
python --version
pip --version
```

### Bước 2: Cài đặt PostgreSQL

1. **Tải PostgreSQL 15**: https://www.postgresql.org/download/windows/
2. **Cài đặt** với:
   - Port: `5432` (mặc định)
   - Password cho user `postgres`: **Ghi nhớ password này!**
   - Locale: Default locale
3. **Cài pgAdmin** (đi kèm với PostgreSQL)

### Bước 3: Thiết lập Database

#### 3.1 Tạo Database và User

```sql
-- Kết nối PostgreSQL với user postgres
psql -U postgres -h localhost

-- Tạo database
CREATE DATABASE fastapi_db;

-- Tạo user riêng cho ứng dụng
CREATE USER fastapi_user WITH PASSWORD 'fastapi123';

-- Cấp quyền cho user
GRANT ALL PRIVILEGES ON DATABASE fastapi_db TO fastapi_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO fastapi_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fastapi_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fastapi_user;

-- Cấp quyền mặc định cho tables/sequences tương lai
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO fastapi_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO fastapi_user;

-- Thoát
\q
```

#### 3.2 Sử dụng pgAdmin (Cách 2)

1. Mở **pgAdmin 4**
2. Kết nối PostgreSQL Server
3. **Tạo Database**:
   - Right-click "Databases" → "Create" → "Database..."
   - Name: `fastapi_db`
4. **Tạo User**:
   - Right-click "Login/Group Roles" → "Create" → "Login/Group Role..."
   - General tab: Name = `fastapi_user`
   - Definition tab: Password = `fastapi123`
   - Privileges tab: ✅ "Can login?", ✅ "Create databases?"

### Bước 4: Cài đặt Python Dependencies

#### 4.1 Tạo Virtual Environment

```cmd
# Điều hướng đến thư mục backend
cd D:\KCL\fastapi_react\backend

# Tạo virtual environment
python -m venv venv

# Kích hoạt virtual environment
venv\Scripts\activate
```

#### 4.2 Cài đặt packages

**⚠️ LỖI THƯỜNG GẶP**: Python 3.13 có thể gặp lỗi với Rust compiler

**Giải pháp 1**: Cài với pre-compiled wheels

```cmd
# Cập nhật pip
python -m pip install --upgrade pip setuptools wheel

# Cài với pre-compiled wheels
pip install --only-binary=all -r requirements.txt
```

**Giải pháp 2**: Cài từng package riêng lẻ

```cmd
# Cài các package cơ bản
pip install fastapi==0.104.1
pip install uvicorn==0.24.0
pip install sqlalchemy==2.0.23
pip install psycopg2-binary==2.9.9
pip install pydantic==2.5.1
pip install pydantic-settings==2.1.0
pip install python-dotenv==1.0.0
pip install python-multipart==0.0.6
pip install email-validator==2.1.0.post1

# Cài packages crypto
pip install --only-binary=bcrypt bcrypt==4.0.1
pip install passlib==1.7.4
pip install --only-binary=all python-jose==3.3.0
```

**Giải pháp 3**: Nếu vẫn lỗi, dùng PyJWT thay python-jose

```cmd
pip install PyJWT==2.8.0
```

### Bước 5: Tạo file cấu hình

#### 5.1 Tạo file .env

```env
DATABASE_URL=postgresql://fastapi_user:fastapi123@localhost:5432/fastapi_db
SECRET_KEY=your_super_secret_key_change_this_in_production_12345
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=True
```

**Tạo SECRET_KEY ngẫu nhiên**:

```cmd
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Bước 6: Khởi tạo Database Tables

#### 6.1 Chạy SQL Script

```cmd
# Cách 1: Command Line
psql -U fastapi_user -d fastapi_db -h localhost -f sql\create_tables.sql

# Cách 2: pgAdmin
# - Mở Query Tool trong database fastapi_db
# - Load file sql/create_tables.sql
# - Execute (F5)
```

#### 6.2 Kiểm tra Tables

```sql
-- Trong psql
\dt
\d users
SELECT * FROM users;
```

### Bước 7: Test Database Connection

#### 7.1 Test SQLAlchemy Connection

**⚠️ LỖI THƯỜNG GẶP**: SQLAlchemy 2.0+ syntax

**❌ Cách cũ (lỗi)**:

```python
result = conn.execute('SELECT * FROM users')
```

**✅ Cách đúng**:

```python
from sqlalchemy import text
result = conn.execute(text('SELECT * FROM users'))
```

#### 7.2 Test Permission

**⚠️ LỖI THƯỜNG GẶP**: Permission denied for table users

**Giải pháp**: Cấp quyền đầy đủ (xem Bước 3.1)

#### 7.3 File test.py

```python
from database import engine
from sqlalchemy import text

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM users"))
        count = result.scalar()
        print(f"✅ Found {count} users in database")
except Exception as e:
    print(f"❌ Connection failed: {e}")
```

### Bước 8: Chạy Backend Server

#### 8.1 Khởi động Server

```cmd
# Đảm bảo virtual environment đã kích hoạt (venv)
python main.py

# Hoặc dùng uvicorn trực tiếp
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

#### 8.2 Kiểm tra Server

- **API**: http://localhost:5000
- **Documentation**: http://localhost:5000/docs
- **ReDoc**: http://localhost:5000/redoc

### Bước 9: Test API Endpoints

#### 9.1 Tài khoản test

- **Admin**: `admin` / `123456` (role: 1)
- **User**: `user` / `123456` (role: 0)

#### 9.2 Test Login

```bash
curl -X POST "http://localhost:5000/api/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=123456"
```

#### 9.3 Test trong Swagger UI

1. Mở http://localhost:5000/docs
2. Test `POST /api/token` với admin/123456
3. Copy access_token
4. Click "Authorize" và nhập: `Bearer YOUR_TOKEN`
5. Test các protected endpoints

## 🔧 Troubleshooting - Các lỗi thường gặp

### ❌ "python không được nhận dạng"

**Nguyên nhân**: Python chưa được thêm vào PATH
**Giải pháp**:

1. Cài lại Python với "Add Python to PATH"
2. Hoặc thêm thủ công: `C:\Users\YourName\AppData\Local\Programs\Python\Python311\`

### ❌ "psql không được nhận dạng"

**Nguyên nhân**: PostgreSQL bin chưa trong PATH
**Giải pháp**: Thêm vào PATH: `C:\Program Files\PostgreSQL\15\bin`

### ❌ Lỗi Rust compiler khi cài packages

**Nguyên nhân**: Python 3.13 + packages cần compile từ source
**Giải pháp**:

1. Dùng `--only-binary=all`
2. Cài Python 3.11/3.12
3. Cài Visual Studio Build Tools

### ❌ "permission denied for table users"

**Nguyên nhân**: User không có quyền truy cập table
**Giải pháp**: Chạy lệnh GRANT ALL PRIVILEGES (xem Bước 3.1)

### ❌ "Not an executable object: 'SELECT...'"

**Nguyên nhân**: SQLAlchemy 2.0+ syntax
**Giải pháp**: Dùng `text()` wrapper cho raw SQL

### ❌ "ModuleNotFoundError"

**Nguyên nhân**: Virtual environment chưa kích hoạt
**Giải pháp**: `venv\Scripts\activate`

### ❌ Database connection failed

**Nguyên nhân**: PostgreSQL service không chạy
**Giải pháp**: `net start postgresql-x64-15`

## 📊 API Endpoints

| Method | Endpoint          | Mô tả                   | Auth     |
| ------ | ----------------- | ----------------------- | -------- |
| POST   | `/api/token`      | Đăng nhập               | ❌       |
| POST   | `/api/register`   | Đăng ký                 | ❌       |
| GET    | `/api/users/me`   | Thông tin user hiện tại | ✅       |
| GET    | `/api/users`      | Danh sách users         | ✅ Admin |
| PUT    | `/api/users/{id}` | Cập nhật user           | ✅ Admin |
| DELETE | `/api/users/{id}` | Xóa user                | ✅ Admin |

## 🗄️ Database Schema

### Table: users

| Column       | Type         | Description               |
| ------------ | ------------ | ------------------------- |
| id           | SERIAL       | Primary key               |
| username     | VARCHAR(255) | Tên đăng nhập (unique)    |
| password     | VARCHAR(255) | Mật khẩu (hashed)         |
| nickname     | VARCHAR(255) | Tên hiển thị              |
| email        | VARCHAR(255) | Email                     |
| avatar       | VARCHAR(500) | URL avatar                |
| role         | INT4         | Vai trò (0=user, 1=admin) |
| created_time | TIMESTAMP    | Thời gian tạo             |
| updated_time | TIMESTAMP    | Thời gian cập nhật        |
| others       | JSONB        | Thông tin khác            |

## 🔐 Security Features

- **JWT Authentication** với Bearer token
- **Password Hashing** với bcrypt
- **Role-based Access Control** (user/admin)
- **CORS Configuration** cho frontend
- **SQL Injection Protection** với SQLAlchemy ORM

## 🚀 Production Deployment

### Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SECRET_KEY=<strong-random-key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=False
```

### Security Checklist

- [ ] Thay đổi SECRET_KEY
- [ ] Cập nhật CORS origins
- [ ] Sử dụng HTTPS
- [ ] Setup reverse proxy (nginx)
- [ ] Enable database SSL
- [ ] Setup monitoring và logging

## 📝 Ghi chú quan trọng

1. **Virtual Environment**: Luôn kích hoạt trước khi làm việc
2. **Database Service**: PostgreSQL phải chạy
3. **File .env**: Chứa thông tin nhạy cảm, không commit vào Git
4. **Port 5000**: Đảm bảo không bị conflict với services khác
5. **UTF-8 Support**: Database đã được cấu hình hỗ trợ tiếng Việt

## 🎯 Bước tiếp theo

- [ ] Cài đặt và tích hợp Frontend React
- [ ] Thêm features: forgot password, email verification
- [ ] Setup CI/CD pipeline
- [ ] Deploy lên cloud (AWS, DigitalOcean, Heroku)
- [ ] Thêm monitoring và logging
- [ ] Setup backup database tự động

---

**🎉 Backend FastAPI đã sẵn sàng hoạt động!**

Để chạy lại server trong tương lai:

```cmd
cd D:\KCL\fastapi_react\backend
venv\Scripts\activate
python main.py
```
