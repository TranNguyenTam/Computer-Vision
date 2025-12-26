using HospitalVision.Domain.Entities;
using HospitalVision.Infrastructure.Data;
using HospitalVision.API.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using System.Data;

namespace HospitalVision.API.Controllers;

/// API quản lý khuôn mặt bệnh nhân
/// Sử dụng cross-database query:
/// - K_QMS_YHCT: HangDoiPhongBan (có BenhNhan_Id), FACE_IMAGES (lưu ảnh)
/// - PRODUCT_HIS: TT_BENHNHAN (thông tin chi tiết bệnh nhân)
/// JOIN: HangDoiPhongBan.BenhNhan_Id = TT_BENHNHAN.BENHNHAN_ID
[ApiController]
[Route("api/[controller]")]
public class FaceController : ControllerBase
{
    private readonly QmsDbContext _qmsContext;  // K_QMS_YHCT - có quyền write
    private readonly HospitalDbContext _hospitalContext;  // PRODUCT_HIS - chỉ đọc
    private readonly ILogger<FaceController> _logger;
    private readonly IConfiguration _configuration;

    public FaceController(
        QmsDbContext qmsContext, 
        HospitalDbContext hospitalContext,
        ILogger<FaceController> logger,
        IConfiguration configuration)
    {
        _qmsContext = qmsContext;
        _hospitalContext = hospitalContext;
        _logger = logger;
        _configuration = configuration;
    }

    /// Kiểm tra mã y tế có tồn tại trong TT_BENHNHAN không
    [HttpGet("validate/{mayte}")]
    public async Task<ActionResult<PatientBasicInfo>> ValidateMaYTe(string mayte)
    {
        try
        {
            // Tìm trực tiếp trong TT_BENHNHAN (PRODUCT_HIS)
            var benhNhan = await _hospitalContext.BenhNhans
                .FirstOrDefaultAsync(b => b.MaYTe == mayte);

            if (benhNhan == null)
            {
                return NotFound(new { 
                    success = false, 
                    message = $"Không tìm thấy bệnh nhân với MAYTE: {mayte}" 
                });
            }

            // Lấy tên nhóm máu nếu có
            string? nhomMau = null;
            if (benhNhan.NhomMauId.HasValue)
            {
                nhomMau = benhNhan.NhomMauId.Value switch
                {
                    1 => "A",
                    2 => "B",
                    3 => "AB",
                    4 => "O",
                    _ => $"Loại {benhNhan.NhomMauId.Value}"
                };
            }

            // Lấy yếu tố Rh nếu có
            string? yeuToRh = null;
            if (benhNhan.YeuToRhId.HasValue)
            {
                yeuToRh = benhNhan.YeuToRhId.Value switch
                {
                    1 => "Rh+",
                    2 => "Rh-",
                    _ => null
                };
            }

            // Tính tuổi: ưu tiên NgaySinh, nếu không có thì dùng NamSinh
            int? tuoi = null;
            if (benhNhan.NgaySinh.HasValue)
            {
                tuoi = CalculateAge(benhNhan.NgaySinh.Value);
            }
            else if (benhNhan.NamSinh.HasValue)
            {
                tuoi = DateTime.Today.Year - benhNhan.NamSinh.Value;
            }

            // Chuyển đổi giới tính
            string? gioiTinh = ConvertGioiTinh(benhNhan.GioiTinh);

            return Ok(new { 
                success = true, 
                patient = new PatientBasicInfo
                {
                    // Thông tin định danh
                    BenhNhanId = benhNhan.BenhNhanId,
                    MaYTe = benhNhan.MaYTe,
                    FID = benhNhan.FID,
                    SoVaoVien = benhNhan.SoVaoVien,
                    PID = benhNhan.PID,
                    
                    // Thông tin cá nhân
                    TenBenhNhan = benhNhan.TenBenhNhan ?? "Unknown",
                    Ho = benhNhan.Ho,
                    Ten = benhNhan.Ten,
                    GioiTinh = gioiTinh,
                    Tuoi = tuoi,
                    NgaySinh = benhNhan.NgaySinh,
                    NgayGioSinh = benhNhan.NgayGioSinh,
                    NamSinh = benhNhan.NamSinh?.ToString(),
                    MaNoiSinh = benhNhan.MaNoiSinh,
                    
                    // Liên hệ
                    SoDienThoai = benhNhan.SoDienThoai,
                    DienThoaiBan = benhNhan.DienThoaiBan,
                    Email = benhNhan.Email,
                    
                    // Địa chỉ
                    SoNha = benhNhan.SoNha,
                    DiaChi = benhNhan.DiaChi,
                    DiaChiThuongTru = benhNhan.DiaChiThuongTru,
                    DiaChiLienLac = benhNhan.DiaChiLienLac,
                    DiaChiCoQuan = benhNhan.DiaChiCoQuan,
                    TinhThanhId = benhNhan.TinhThanhId?.ToString(),
                    QuanHuyenId = benhNhan.QuanHuyenId?.ToString(),
                    XaPhuongId = benhNhan.XaPhuongId,
                    
                    // Giấy tờ tùy thân
                    CMND = benhNhan.CMND,
                    HoChieu = benhNhan.HoChieu,
                    
                    // Thông tin y tế
                    NhomMau = nhomMau,
                    YeuToRh = yeuToRh,
                    TienSuDiUng = benhNhan.TienSuDiUng,
                    TienSuBenh = benhNhan.TienSuBenh,
                    TienSuHutThuocLa = benhNhan.TienSuHutThuocLa,
                    SoLuuTruNoiTru = benhNhan.SoLuuTruNoiTru,
                    SoLuuTruNgoaiTru = benhNhan.SoLuuTruNgoaiTru,
                    
                    // Thông tin nhân khẩu học
                    NgheNghiepId = benhNhan.NgheNghiepId?.ToString(),
                    QuocTichId = benhNhan.QuocTichId?.ToString(),
                    DanTocId = benhNhan.DanTocId?.ToString(),
                    TrinhDoVanHoaId = benhNhan.TrinhDoVanHoaId?.ToString(),
                    TinhTrangHonNhanId = benhNhan.TinhTrangHonNhanId?.ToString(),
                    VietKieu = benhNhan.VietKieu,
                    NguoiNuocNgoai = benhNhan.NguoiNuocNgoai,
                    
                    // Người liên hệ
                    NguoiLienHe = benhNhan.NguoiLienHe,
                    ThongTinNguoiLienHe = benhNhan.ThongTinNguoiLienHe,
                    MoiQuanHeId = benhNhan.MoiQuanHeId?.ToString(),
                    
                    // Thông tin tử vong
                    TuVong = benhNhan.TuVong,
                    NgayTuVong = benhNhan.NgayTuVong,
                    ThoiGianTuVong = benhNhan.ThoiGianTuVong,
                    NguyenNhanTuVongId = benhNhan.NguyenNhanTuVongId?.ToString(),
                    
                    // Thông tin hệ thống
                    HinhAnhDaiDien = benhNhan.HinhAnhDaiDien,
                    GhiChu = benhNhan.GhiChu,
                    Active = benhNhan.Active,
                    BenhVienId = benhNhan.BenhVienId,
                    SiteId = benhNhan.SiteId,
                    NgayTao = benhNhan.NgayTao,
                    NgayCapNhat = benhNhan.NgayCapNhat,
                    NguoiTaoId = benhNhan.NguoiTaoId?.ToString(),
                    NguoiCapNhatId = benhNhan.NguoiCapNhatId?.ToString()
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating MAYTE: {MaYTe}", mayte);
            return StatusCode(500, new { success = false, message = "Lỗi server" });
        }
    }

    /// Tìm kiếm bệnh nhân để đăng ký khuôn mặt
    /// Ưu tiên tìm trong hàng đợi (HangDoiPhongBan JOIN TT_BENHNHAN)
    [HttpGet("search-patient")]
    public async Task<ActionResult<List<PatientBasicInfo>>> SearchPatient([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
        {
            return Ok(new List<PatientBasicInfo>());
        }

        try
        {
            var patients = new List<PatientBasicInfo>();

            // Cross-database query: HangDoiPhongBan JOIN TT_BENHNHAN
            var connectionString = _configuration.GetConnectionString("QmsDatabase");
            using (var connection = new SqlConnection(connectionString))
            {
                await connection.OpenAsync();
                
                var query = @"
                    SELECT DISTINCT TOP 10
                        b.BENHNHAN_ID,
                        b.MAYTE,
                        b.TENBENHNHAN,
                        b.GIOITINH,
                        b.NGAYSINH,
                        b.SODIENTHOAI,
                        b.DIACHI,
                        h.STT,
                        h.TinhTrang,
                        h.NgayThucHien
                    FROM [K_QMS_YHCT].[dbo].[HangDoiPhongBan] h
                    INNER JOIN [PRODUCT_HIS].[dbo].[TT_BENHNHAN] b 
                        ON h.BenhNhan_Id = b.BENHNHAN_ID
                    WHERE (b.MAYTE LIKE @search 
                        OR b.TENBENHNHAN LIKE @search 
                        OR b.SODIENTHOAI LIKE @search)
                        AND h.NgayThucHien >= CAST(GETDATE() AS DATE)
                    ORDER BY h.NgayThucHien DESC";

                using (var command = new SqlCommand(query, connection))
                {
                    command.Parameters.AddWithValue("@search", $"%{q}%");
                    
                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            patients.Add(new PatientBasicInfo
                            {
                                BenhNhanId = reader.GetInt32(reader.GetOrdinal("BENHNHAN_ID")),
                                MaYTe = reader.IsDBNull(reader.GetOrdinal("MAYTE")) ? "" : reader.GetString(reader.GetOrdinal("MAYTE")),
                                TenBenhNhan = reader.IsDBNull(reader.GetOrdinal("TENBENHNHAN")) ? "Unknown" : reader.GetString(reader.GetOrdinal("TENBENHNHAN")),
                                GioiTinh = ConvertGioiTinh(reader.IsDBNull(reader.GetOrdinal("GIOITINH")) 
                                    ? null 
                                    : reader.GetInt32(reader.GetOrdinal("GIOITINH"))),
                                Tuoi = reader.IsDBNull(reader.GetOrdinal("NGAYSINH")) ? null : CalculateAge(reader.GetDateTime(reader.GetOrdinal("NGAYSINH"))),
                                SoDienThoai = reader.IsDBNull(reader.GetOrdinal("SODIENTHOAI")) ? null : reader.GetString(reader.GetOrdinal("SODIENTHOAI"))
                            });
                        }
                    }
                }
            }

            // Nếu không tìm thấy trong hàng đợi, tìm trực tiếp trong TT_BENHNHAN
            if (patients.Count == 0)
            {
                var benhNhans = await _hospitalContext.BenhNhans
                    .Where(b => (b.MaYTe != null && b.MaYTe.Contains(q)) ||
                               (b.TenBenhNhan != null && b.TenBenhNhan.Contains(q)) ||
                               (b.SoDienThoai != null && b.SoDienThoai.Contains(q)))
                    .Take(10)
                    .ToListAsync();

                patients = benhNhans.Select(b => new PatientBasicInfo
                {
                    BenhNhanId = b.BenhNhanId,
                    MaYTe = b.MaYTe,
                    TenBenhNhan = b.TenBenhNhan ?? "Unknown",
                    GioiTinh = ConvertGioiTinh(b.GioiTinh),
                    Tuoi = b.NgaySinh.HasValue ? CalculateAge(b.NgaySinh.Value) : null,
                    SoDienThoai = b.SoDienThoai
                }).ToList();
            }

            return Ok(patients);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching patients");
            return StatusCode(500, new { message = "Lỗi server" });
        }
    }

    /// Lấy danh sách bệnh nhân đang trong hàng đợi hôm nay
    /// Cross-database query: HangDoiPhongBan JOIN TT_BENHNHAN
    [HttpGet("queue-today")]
    public async Task<ActionResult<List<HangDoiPatientInfo>>> GetQueueToday()
    {
        try
        {
            var patients = new List<HangDoiPatientInfo>();

            var connectionString = _configuration.GetConnectionString("QmsDatabase");
            using (var connection = new SqlConnection(connectionString))
            {
                await connection.OpenAsync();
                
                var query = @"
                    SELECT 
                        h.HangDoiPhongBan_Id,
                        h.STT,
                        h.SoThuTuDayDu,
                        h.TinhTrang,
                        h.NgayThucHien,
                        h.NgayGioLaySo,
                        b.BENHNHAN_ID,
                        b.MAYTE,
                        b.TENBENHNHAN,
                        b.GIOITINH,
                        b.NGAYSINH,
                        b.SODIENTHOAI
                    FROM [K_QMS_YHCT].[dbo].[HangDoiPhongBan] h
                    INNER JOIN [PRODUCT_HIS].[dbo].[TT_BENHNHAN] b 
                        ON h.BenhNhan_Id = b.BENHNHAN_ID
                    WHERE CAST(h.NgayThucHien AS DATE) = CAST(GETDATE() AS DATE)
                        AND (h.Huy IS NULL OR h.Huy = 0)
                    ORDER BY h.STT";

                using (var command = new SqlCommand(query, connection))
                {
                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            patients.Add(new HangDoiPatientInfo
                            {
                                Id = reader.GetInt32(reader.GetOrdinal("HangDoiPhongBan_Id")),
                                MaYTe = reader.IsDBNull(reader.GetOrdinal("MAYTE")) ? "" : reader.GetString(reader.GetOrdinal("MAYTE")),
                                HoTen = reader.IsDBNull(reader.GetOrdinal("TENBENHNHAN")) ? "" : reader.GetString(reader.GetOrdinal("TENBENHNHAN")),
                                NgaySinh = reader.IsDBNull(reader.GetOrdinal("NGAYSINH")) ? null : reader.GetDateTime(reader.GetOrdinal("NGAYSINH")),
                                GioiTinh = ConvertGioiTinh(reader.IsDBNull(reader.GetOrdinal("GIOITINH")) 
                                    ? null 
                                    : reader.GetInt32(reader.GetOrdinal("GIOITINH"))),
                                SoDienThoai = reader.IsDBNull(reader.GetOrdinal("SODIENTHOAI")) ? null : reader.GetString(reader.GetOrdinal("SODIENTHOAI")),
                                SoThuTu = reader.IsDBNull(reader.GetOrdinal("STT")) ? null : reader.GetInt32(reader.GetOrdinal("STT")),
                                TrangThaiText = GetTrangThaiText(reader.IsDBNull(reader.GetOrdinal("TinhTrang")) ? null : reader.GetInt32(reader.GetOrdinal("TinhTrang")))
                            });
                        }
                    }
                }
            }

            return Ok(patients);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting queue today");
            return StatusCode(500, new { message = "Lỗi server" });
        }
    }

    private static string GetTrangThaiText(int? trangThai)
    {
        return trangThai switch
        {
            0 => "Chờ khám",
            1 => "Đang khám",
            2 => "Đã khám",
            3 => "Bỏ qua",
            _ => "Không xác định"
        };
    }

    /// Lấy thông tin bệnh nhân khi nhận diện được khuôn mặt
    [HttpGet("patient/{mayte}")]
    public async Task<ActionResult<FaceRecognitionResult>> GetPatientByMaYTe(
        string mayte, 
        [FromQuery] float confidence = 0)
    {
        try
        {
            // Tìm trong TT_BENHNHAN
            var benhNhan = await _hospitalContext.BenhNhans
                .FirstOrDefaultAsync(b => b.MaYTe == mayte);

            if (benhNhan == null)
            {
                return Ok(new FaceRecognitionResult
                {
                    Recognized = false,
                    Confidence = confidence,
                    ConfidenceLevel = "unknown",
                    Message = $"Không tìm thấy bệnh nhân với MAYTE: {mayte}"
                });
            }

            var patientInfo = new PatientBasicInfo
            {
                BenhNhanId = benhNhan.BenhNhanId,
                MaYTe = benhNhan.MaYTe,
                TenBenhNhan = benhNhan.TenBenhNhan ?? "Unknown",
                GioiTinh = ConvertGioiTinh(benhNhan.GioiTinh),
                Tuoi = benhNhan.NgaySinh.HasValue ? CalculateAge(benhNhan.NgaySinh.Value) : null,
                SoDienThoai = benhNhan.SoDienThoai,
                DiaChi = benhNhan.DiaChi,
                HinhAnhDaiDien = benhNhan.HinhAnhDaiDien
            };

            // Kiểm tra xem bệnh nhân có đang trong hàng đợi không
            var isInQueue = await CheckPatientInQueue(benhNhan.BenhNhanId);

            // Xác định mức độ tin cậy
            string confidenceLevel = confidence switch
            {
                >= 0.9f => "very_high",
                >= 0.8f => "high",
                >= 0.7f => "medium",
                >= 0.6f => "low",
                _ => "very_low"
            };

            return Ok(new FaceRecognitionResult
            {
                Recognized = true,
                Confidence = confidence,
                ConfidenceLevel = confidenceLevel,
                Patient = patientInfo,
                IsInQueue = isInQueue
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting patient by MAYTE");
            return StatusCode(500, new { message = "Lỗi server" });
        }
    }

    /// Kiểm tra bệnh nhân có đang trong hàng đợi hôm nay không
    private async Task<bool> CheckPatientInQueue(int benhNhanId)
    {
        try
        {
            var today = DateTime.Today;
            return await _qmsContext.HangDoiPhongBans
                .AnyAsync(h => h.BenhNhanId == benhNhanId && 
                              h.NgayThucHien.HasValue && 
                              h.NgayThucHien.Value.Date == today &&
                              (h.Huy == null || h.Huy == false));
        }
        catch
        {
            return false;
        }
    }

    /// Lấy danh sách ảnh khuôn mặt đã đăng ký của bệnh nhân
    [HttpGet("images/{mayte}")]
    public async Task<ActionResult<List<FaceImageDto>>> GetFaceImages(string mayte)
    {
        try
        {
            var images = await _qmsContext.FaceImages
                .Where(f => f.MaYTe == mayte && f.IsActive)
                .OrderByDescending(f => f.CreatedAt)
                .Select(f => new FaceImageDto
                {
                    Id = f.Id,
                    MaYTe = f.MaYTe,
                    ImagePath = f.ImagePath,
                    CreatedAt = f.CreatedAt,
                    IsActive = f.IsActive
                })
                .ToListAsync();
            return Ok(images);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting face images");
            return StatusCode(500, new { message = "Lỗi server" });
        }
    }

    /// Lưu thông tin ảnh khuôn mặt vào database K_QMS_YHCT
    /// (Gọi từ AI server sau khi đăng ký thành công)
    [HttpPost("images")]
    public async Task<ActionResult> SaveFaceImage([FromBody] SaveFaceImageRequest request)
    {
        try
        {
            // Validate MAYTE exists trong TT_BENHNHAN
            var existsInPatients = await _hospitalContext.BenhNhans
                .AnyAsync(b => b.MaYTe == request.MaYTe);

            if (!existsInPatients)
            {
                return BadRequest(new { 
                    success = false, 
                    message = $"MAYTE không tồn tại: {request.MaYTe}" 
                });
            }

            var faceImage = new FaceImage
            {
                MaYTe = request.MaYTe,
                ImagePath = request.ImagePath,
                ModelName = request.ModelName ?? "FaceNet",
                CreatedAt = DateTime.Now,
                IsActive = true
            };

            _qmsContext.FaceImages.Add(faceImage);
            await _qmsContext.SaveChangesAsync();

            _logger.LogInformation("Saved face image for MAYTE: {MaYTe} to K_QMS_YHCT", request.MaYTe);

            return Ok(new { 
                success = true, 
                id = faceImage.Id,
                message = "Đã lưu ảnh khuôn mặt" 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving face image");
            return StatusCode(500, new { success = false, message = "Lỗi server" });
        }
    }

    /// Xóa ảnh khuôn mặt
    [HttpDelete("images/{id}")]
    public async Task<ActionResult> DeleteFaceImage(int id)
    {
        try
        {
            var image = await _qmsContext.FaceImages.FindAsync(id);
            if (image == null)
            {
                return NotFound(new { message = "Không tìm thấy ảnh" });
            }

            // Soft delete
            image.IsActive = false;
            await _qmsContext.SaveChangesAsync();

            return Ok(new { success = true, message = "Đã xóa ảnh" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting face image");
            return StatusCode(500, new { message = "Lỗi server" });
        }
    }

    /// Xóa tất cả dữ liệu khuôn mặt của bệnh nhân theo MaYTe
    [HttpDelete("patient/{maYTe}")]
    public async Task<ActionResult> DeletePatientFaceData(string maYTe)
    {
        try
        {
            // Xóa tất cả FaceImages của bệnh nhân
            var faceImages = await _qmsContext.FaceImages
                .Where(f => f.MaYTe == maYTe)
                .ToListAsync();
            
            if (faceImages.Any())
            {
                _qmsContext.FaceImages.RemoveRange(faceImages);
                _logger.LogInformation($"Deleting {faceImages.Count} face images for patient {maYTe}");
            }

            // Xóa lịch sử nhận diện của bệnh nhân
            var detections = await _qmsContext.DetectionHistories
                .Where(d => d.MaYTe == maYTe)
                .ToListAsync();
            
            if (detections.Any())
            {
                _qmsContext.DetectionHistories.RemoveRange(detections);
                _logger.LogInformation($"Deleting {detections.Count} detection records for patient {maYTe}");
            }

            await _qmsContext.SaveChangesAsync();

            return Ok(new { 
                success = true, 
                message = $"Đã xóa toàn bộ dữ liệu khuôn mặt của bệnh nhân {maYTe}",
                deletedImages = faceImages.Count,
                deletedDetections = detections.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting patient face data for {MaYTe}", maYTe);
            return StatusCode(500, new { success = false, message = "Lỗi server khi xóa dữ liệu" });
        }
    }

    /// Thống kê số lượng ảnh đã đăng ký
    [HttpGet("stats")]
    public async Task<ActionResult> GetStats()
    {
        try
        {
            var totalImages = await _qmsContext.FaceImages.CountAsync(f => f.IsActive);
            var totalPatients = await _qmsContext.FaceImages
                .Where(f => f.IsActive)
                .Select(f => f.MaYTe)
                .Distinct()
                .CountAsync();

            // Đếm số bệnh nhân trong hàng đợi hôm nay
            var today = DateTime.Today;
            var queueToday = await _qmsContext.HangDoiPhongBans
                .CountAsync(h => h.NgayThucHien.HasValue && 
                                h.NgayThucHien.Value.Date == today &&
                                (h.Huy == null || h.Huy == false));

            // Đếm số lượng nhận diện hôm nay
            var detectionsToday = await _qmsContext.DetectionHistories
                .CountAsync(d => d.SessionDate == today);

            return Ok(new
            {
                totalImages,
                totalPatients,
                queueToday,
                detectionsToday
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting face stats");
            return StatusCode(500, new { message = "Lỗi server" });
        }
    }

    // =====================================================
    // API cho AI Camera Server - Nhận diện tự động
    // =====================================================

    /// Lấy tất cả embeddings đã đăng ký để AI load
    [HttpGet("embeddings")]
    public async Task<ActionResult> GetAllEmbeddings()
    {
        try
        {
            var embeddings = await _qmsContext.FaceImages
                .Where(f => f.IsActive && f.Embedding != null && f.EmbeddingSize > 0)
                .Select(f => new 
                {
                    f.MaYTe,
                    f.Embedding,
                    f.EmbeddingSize,
                    f.ModelName
                })
                .ToListAsync();

            // Group by MAYTE và convert embedding từ byte[] sang float[]
            var result = embeddings
                .GroupBy(e => e.MaYTe)
                .Select(g => new 
                {
                    MaYTe = g.Key,
                    Embeddings = g.Select(e => new 
                    {
                        e.EmbeddingSize,
                        e.ModelName,
                        // Convert byte[] to float[]
                        Vector = e.Embedding != null ? ConvertBytesToFloats(e.Embedding) : null
                    }).ToList()
                })
                .ToList();

            return Ok(new { success = true, data = result, count = result.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting embeddings");
            return StatusCode(500, new { success = false, message = "Lỗi server" });
        }
    }

    /// Lưu embedding khi đăng ký khuôn mặt
    [HttpPost("embeddings")]
    public async Task<ActionResult> SaveEmbedding([FromBody] SaveEmbeddingRequest request)
    {
        try
        {
            // Kiểm tra MAYTE tồn tại
            var benhNhan = await _hospitalContext.BenhNhans
                .FirstOrDefaultAsync(b => b.MaYTe == request.MaYTe);

            if (benhNhan == null)
            {
                return NotFound(new { success = false, message = $"Không tìm thấy bệnh nhân với MAYTE: {request.MaYTe}" });
            }

            // Convert float[] to byte[]
            var embeddingBytes = ConvertFloatsToBytes(request.Embedding);

            // Tìm ảnh đã có hoặc tạo mới
            var faceImage = await _qmsContext.FaceImages
                .FirstOrDefaultAsync(f => f.MaYTe == request.MaYTe && f.ImagePath == request.ImagePath);

            if (faceImage != null)
            {
                // Cập nhật embedding cho ảnh đã có
                faceImage.Embedding = embeddingBytes;
                faceImage.EmbeddingSize = request.Embedding.Length;
                faceImage.ModelName = request.ModelName ?? "Facenet512";
            }
            else
            {
                // Tạo mới
                faceImage = new FaceImage
                {
                    MaYTe = request.MaYTe,
                    ImagePath = request.ImagePath ?? $"{request.MaYTe}_{DateTime.Now.Ticks}.jpg",
                    Embedding = embeddingBytes,
                    EmbeddingSize = request.Embedding.Length,
                    ModelName = request.ModelName ?? "Facenet512",
                    CreatedAt = DateTime.Now,
                    IsActive = true
                };
                _qmsContext.FaceImages.Add(faceImage);
            }

            await _qmsContext.SaveChangesAsync();

            _logger.LogInformation("Saved embedding for MAYTE: {MaYTe}, size: {Size}", 
                request.MaYTe, request.Embedding.Length);

            return Ok(new { 
                success = true, 
                message = "Đã lưu embedding",
                patientName = benhNhan.TenBenhNhan
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving embedding");
            return StatusCode(500, new { success = false, message = "Lỗi server" });
        }
    }

    /// Ghi nhận diện tự động - chỉ ghi 1 lần mỗi người mỗi ngày
    [HttpPost("detection")]
    public async Task<ActionResult> RecordDetection([FromBody] RecordDetectionRequest request)
    {
        try
        {
            var today = DateTime.Today;

            // Kiểm tra đã ghi nhận hôm nay chưa
            var existing = await _qmsContext.DetectionHistories
                .FirstOrDefaultAsync(d => d.MaYTe == request.MaYTe && d.SessionDate == today);

            if (existing != null)
            {
                // Đã ghi nhận rồi, không ghi lại
                return Ok(new { 
                    success = true, 
                    alreadyRecorded = true,
                    message = "Bệnh nhân đã được ghi nhận hôm nay",
                    detectionId = existing.Id
                });
            }

            // Lấy thông tin bệnh nhân
            var benhNhan = await _hospitalContext.BenhNhans
                .FirstOrDefaultAsync(b => b.MaYTe == request.MaYTe);

            // Tạo bản ghi mới
            var detection = new DetectionHistory
            {
                MaYTe = request.MaYTe,
                PatientName = benhNhan?.TenBenhNhan ?? request.PatientName,
                Confidence = request.Confidence,
                DetectedAt = DateTime.Now,
                CameraId = request.CameraId,
                Location = request.Location,
                SessionDate = today,
                Note = request.Note
            };

            _qmsContext.DetectionHistories.Add(detection);
            await _qmsContext.SaveChangesAsync();

            _logger.LogInformation("Recorded detection for MAYTE: {MaYTe}, confidence: {Conf}", 
                request.MaYTe, request.Confidence);

            return Ok(new { 
                success = true, 
                alreadyRecorded = false,
                detectionId = detection.Id,
                patientName = detection.PatientName,
                message = "Đã ghi nhận nhận diện"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recording detection");
            return StatusCode(500, new { success = false, message = "Lỗi server" });
        }
    }

    /// Lấy lịch sử nhận diện hôm nay
    [HttpGet("detections/today")]
    public async Task<ActionResult> GetDetectionsToday()
    {
        try
        {
            var today = DateTime.Today;
            var detections = await _qmsContext.DetectionHistories
                .Where(d => d.SessionDate == today)
                .OrderByDescending(d => d.DetectedAt)
                .Select(d => new 
                {
                    d.Id,
                    d.MaYTe,
                    d.PatientName,
                    d.Confidence,
                    d.DetectedAt,
                    d.CameraId,
                    d.Location
                })
                .ToListAsync();

            return Ok(new { success = true, data = detections, count = detections.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting detections today");
            return StatusCode(500, new { success = false, message = "Lỗi server" });
        }
    }

    /// Lấy danh sách MAYTE đã nhận diện hôm nay (để AI kiểm tra nhanh)
    [HttpGet("detections/today/mayte-list")]
    public async Task<ActionResult> GetDetectedMaYTeToday()
    {
        try
        {
            var today = DateTime.Today;
            var maYTeList = await _qmsContext.DetectionHistories
                .Where(d => d.SessionDate == today)
                .Select(d => d.MaYTe)
                .ToListAsync();

            return Ok(new { success = true, data = maYTeList });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting detected MAYTE list");
            return StatusCode(500, new { success = false, message = "Lỗi server" });
        }
    }

    /// Reset lịch sử nhận diện (cho testing)
    [HttpDelete("detections/today")]
    public async Task<ActionResult> ClearDetectionsToday()
    {
        try
        {
            var today = DateTime.Today;
            var detections = await _qmsContext.DetectionHistories
                .Where(d => d.SessionDate == today)
                .ToListAsync();

            _qmsContext.DetectionHistories.RemoveRange(detections);
            await _qmsContext.SaveChangesAsync();

            return Ok(new { success = true, message = $"Đã xóa {detections.Count} bản ghi" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error clearing detections");
            return StatusCode(500, new { success = false, message = "Lỗi server" });
        }
    }

    // Helper methods for embedding conversion
    private static float[] ConvertBytesToFloats(byte[] bytes)
    {
        var floats = new float[bytes.Length / sizeof(float)];
        Buffer.BlockCopy(bytes, 0, floats, 0, bytes.Length);
        return floats;
    }

    private static byte[] ConvertFloatsToBytes(float[] floats)
    {
        var bytes = new byte[floats.Length * sizeof(float)];
        Buffer.BlockCopy(floats, 0, bytes, 0, bytes.Length);
        return bytes;
    }

    /// Chuyển đổi mã giới tính từ database sang text hiển thị
    private static string? ConvertGioiTinh(int? gioiTinh)
    {
        if (!gioiTinh.HasValue)
            return null;

        return gioiTinh.Value switch
        {
            1 => "Nam",
            2 or 0 => "Nữ",
            _ => gioiTinh.Value.ToString()
        };
    }

    private static int CalculateAge(DateTime birthDate)
    {
        var today = DateTime.Today;
        var age = today.Year - birthDate.Year;
        if (birthDate.Date > today.AddYears(-age)) age--;
        return age;
    }
}

/// Request để lưu ảnh khuôn mặt
public class SaveFaceImageRequest
{
    public string MaYTe { get; set; } = string.Empty;
    public string ImagePath { get; set; } = string.Empty;
    public string? ModelName { get; set; }
}
