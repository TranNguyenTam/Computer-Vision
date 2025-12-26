using HospitalVision.API.Data.UnitOfWork;
using HospitalVision.API.Models;
using HospitalVision.API.Models.DTOs;
using HospitalVision.API.Services.Interfaces;

namespace HospitalVision.API.Services.Implementations;

public class FaceService : IFaceService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationService _notificationService;
    private readonly ILogger<FaceService> _logger;

    public FaceService(IUnitOfWork unitOfWork, INotificationService notificationService, ILogger<FaceService> logger)
    {
        _unitOfWork = unitOfWork;
        _notificationService = notificationService;
        _logger = logger;
    }

    #region Patient Validation and Search

    public async Task<PatientDetailDto?> ValidateMaYTeAsync(string maYTe)
    {
        var benhNhan = await _unitOfWork.BenhNhans.GetByMaYTeAsync(maYTe);
        if (benhNhan == null) return null;

        return MapToPatientDetailDto(benhNhan);
    }

    public async Task<PatientDetailDto?> GetPatientByMaYTeAsync(string maYTe)
    {
        var benhNhan = await _unitOfWork.BenhNhans.GetByMaYTeAsync(maYTe);
        if (benhNhan == null) return null;

        return MapToPatientDetailDto(benhNhan);
    }

    public async Task<List<BenhNhan>> SearchPatientsAsync(string searchTerm)
    {
        return await _unitOfWork.BenhNhans.SearchByNameOrMaYTeAsync(searchTerm);
    }

    #endregion

    #region Face Image Management

    public async Task<FaceImage> SaveFaceImageAsync(string maYTe, byte[] embedding, string? imagePath = null)
    {
        var patient = await _unitOfWork.BenhNhans.GetByMaYTeAsync(maYTe);
        if (patient == null)
        {
            throw new ArgumentException($"Patient with MAYTE {maYTe} not found");
        }

        var faceImage = new FaceImage
        {
            MaYTe = maYTe,
            ImagePath = imagePath,
            Embedding = embedding,
            EmbeddingSize = embedding.Length,
            ModelName = "Facenet512",
            CreatedAt = DateTime.Now,
            IsActive = true
        };

        await _unitOfWork.FaceImages.AddAsync(faceImage);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Saved face image for {MaYTe}", maYTe);
        return faceImage;
    }

    public async Task<List<FaceImage>> GetFacesByMaYTeAsync(string maYTe)
    {
        return await _unitOfWork.FaceImages.GetByMaYTeAsync(maYTe);
    }

    public async Task<bool> DeleteFaceImageAsync(int id)
    {
        var image = await _unitOfWork.FaceImages.GetByIdAsync(id);
        if (image == null) return false;

        image.IsActive = false;
        await _unitOfWork.SaveChangesAsync();
        
        _logger.LogInformation("Deactivated face image {Id}", id);
        return true;
    }

    public async Task<bool> DeleteAllFacesByMaYTeAsync(string maYTe)
    {
        var images = await _unitOfWork.FaceImages.GetByMaYTeAsync(maYTe);
        if (!images.Any()) return false;

        foreach (var image in images)
        {
            image.IsActive = false;
        }

        await _unitOfWork.SaveChangesAsync();
        _logger.LogInformation("Deleted all face images for {MaYTe}", maYTe);
        return true;
    }

    #endregion

    #region Statistics

    public async Task<object> GetFaceStatisticsAsync()
    {
        var allImages = await _unitOfWork.FaceImages.GetAllAsync();
        var totalImages = allImages.Count(f => f.IsActive);
        var totalPatients = allImages.Where(f => f.IsActive).Select(f => f.MaYTe).Distinct().Count();

        return new
        {
            TotalImages = totalImages,
            TotalPatientsWithFaces = totalPatients,
            AverageImagesPerPatient = totalPatients > 0 ? (double)totalImages / totalPatients : 0,
            LastUpdated = allImages.Any() ? allImages.Max(f => f.CreatedAt) : DateTime.MinValue
        };
    }

    #endregion

    #region Embeddings for AI

    public async Task<List<EmbeddingData>> GetAllEmbeddingsAsync()
    {
        var allImages = await _unitOfWork.FaceImages.GetAllAsync();
        var activeImages = allImages.Where(f => f.IsActive && f.Embedding != null).ToList();

        var grouped = activeImages.GroupBy(f => f.MaYTe);
        var results = new List<EmbeddingData>();

        foreach (var group in grouped)
        {
            var patient = await _unitOfWork.BenhNhans.GetByMaYTeAsync(group.Key);
            if (patient == null) continue;

            var embeddings = group.Select(img => new EmbeddingVector
            {
                EmbeddingSize = img.EmbeddingSize ?? 0,
                ModelName = img.ModelName,
                Vector = ConvertBytesToFloatArray(img.Embedding)
            }).ToList();

            results.Add(new EmbeddingData
            {
                MaYTe = group.Key,
                Embeddings = embeddings
            });
        }

        return results;
    }

    public async Task SaveEmbeddingAsync(SaveEmbeddingRequest request)
    {
        var patient = await _unitOfWork.BenhNhans.GetByMaYTeAsync(request.MaYTe);
        if (patient == null)
        {
            throw new ArgumentException($"Patient with MAYTE {request.MaYTe} not found");
        }

        var faceImage = new FaceImage
        {
            MaYTe = request.MaYTe,
            ImagePath = request.ImagePath,
            Embedding = ConvertFloatArrayToBytes(request.Embedding),
            EmbeddingSize = request.Embedding.Length * sizeof(float),
            ModelName = request.ModelName ?? "Facenet512",
            CreatedAt = DateTime.Now,
            IsActive = true
        };

        await _unitOfWork.FaceImages.AddAsync(faceImage);
        await _unitOfWork.SaveChangesAsync();
        
        _logger.LogInformation("Saved embedding from AI for {MaYTe}", request.MaYTe);
    }

    #endregion

    #region Detection Records

    public async Task<object> RecordDetectionAsync(RecordDetectionRequest request)
    {
        _logger.LogInformation("RecordDetectionAsync called for MaYTe: {MaYTe}", request.MaYTe);

        // Get patient info from database
        var benhNhan = await _unitOfWork.BenhNhans.GetByMaYTeAsync(request.MaYTe);
        var patientName = benhNhan?.TenBenhNhan ?? request.PatientName ?? "Unknown";

        _logger.LogInformation("Patient lookup: {PatientName} for MaYTe: {MaYTe}", patientName, request.MaYTe);

        // Check if already recorded today in database
        var today = DateTime.Today;
        var existingDetection = await _unitOfWork.DetectionHistories.FindAsync(
            d => d.MaYTe == request.MaYTe && d.DetectedAt.Date == today
        );
        
        bool alreadyRecorded = existingDetection.Any();
        
        _logger.LogInformation("Checking existing detection for {MaYTe}: Found {Count} records, AlreadyRecorded={AlreadyRecorded}", 
            request.MaYTe, existingDetection.Count(), alreadyRecorded);

        if (!alreadyRecorded)
        {
            _logger.LogInformation("Creating NEW detection record for {MaYTe}", request.MaYTe);

            // Save to database
            var detection = new DetectionHistory
            {
                MaYTe = request.MaYTe,
                PatientName = patientName,
                Confidence = request.Confidence,
                DetectedAt = DateTime.Now,
                CameraId = request.CameraId ?? "CAM01",
                Location = request.Location ?? "Unknown",
                Note = request.Note
            };
            
            await _unitOfWork.DetectionHistories.AddAsync(detection);
            var savedCount = await _unitOfWork.SaveChangesAsync();
            
            _logger.LogInformation("Saved detection to database: {SavedCount} rows affected, ID={Id}", 
                savedCount, detection.Id);
        }
        else
        {
            _logger.LogInformation("SKIPPED - {MaYTe} already recorded today", request.MaYTe);
        }

        _logger.LogInformation("Recorded detection: {PatientName} ({MaYTe}) with confidence {Confidence}", 
            patientName, request.MaYTe, request.Confidence);

        // Send realtime notification via SignalR
        if (!alreadyRecorded)
        {
            try
            {
                await _notificationService.SendPatientDetectedAsync(
                    request.MaYTe, 
                    patientName, 
                    request.Location ?? "Unknown"
                );
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send patient detected notification");
            }
        }

        return new 
        {
            PatientName = patientName,
            AlreadyRecorded = alreadyRecorded
        };
    }

    public async Task<List<object>> GetTodayDetectionsAsync()
    {
        var today = DateTime.Today;
        var detections = await _unitOfWork.DetectionHistories.FindAsync(
            d => d.DetectedAt.Date == today
        );

        var result = detections
            .OrderByDescending(d => d.DetectedAt)
            .Select(d => new
            {
                Id = d.Id,
                MaYTe = d.MaYTe,
                PatientName = d.PatientName,
                Confidence = d.Confidence,
                DetectedAt = d.DetectedAt,
                CameraId = d.CameraId,
                Location = d.Location
            } as object)
            .ToList();

        return result;
    }

    public async Task<List<string>> GetTodayDetectedMaYTesAsync()
    {
        var today = DateTime.Today;
        var detections = await _unitOfWork.DetectionHistories.FindAsync(
            d => d.DetectedAt.Date == today
        );

        var maYTes = detections
            .Select(d => d.MaYTe)
            .Distinct()
            .ToList();

        return maYTes;
    }

    public async Task<bool> DeleteTodayDetectionsAsync()
    {
        var today = DateTime.Today;
        var detections = await _unitOfWork.DetectionHistories.FindAsync(
            d => d.DetectedAt.Date == today
        );

        _unitOfWork.DetectionHistories.RemoveRange(detections);
        var count = await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Deleted {Count} today's detections", count);
        return count > 0;
    }

    #endregion

    #region Helper Methods

    private PatientDetailDto MapToPatientDetailDto(BenhNhan benhNhan)
    {
        string? nhomMau = benhNhan.NhomMauId.HasValue ? benhNhan.NhomMauId.Value switch
        {
            1 => "A", 2 => "B", 3 => "AB", 4 => "O",
            _ => $"Loại {benhNhan.NhomMauId.Value}"
        } : null;

        string? yeuToRh = benhNhan.YeuToRhId.HasValue ? benhNhan.YeuToRhId.Value switch
        {
            1 => "Rh+", 2 => "Rh-", _ => null
        } : null;

        int? tuoi = null;
        if (benhNhan.NgaySinh.HasValue)
        {
            var today = DateTime.Today;
            var calculatedAge = today.Year - benhNhan.NgaySinh.Value.Year;
            if (benhNhan.NgaySinh.Value.Date > today.AddYears(-calculatedAge)) calculatedAge--;
            tuoi = calculatedAge;
        }
        else if (benhNhan.NamSinh.HasValue)
        {
            tuoi = DateTime.Today.Year - benhNhan.NamSinh.Value;
        }

        string? gioiTinh = benhNhan.GioiTinh.HasValue ? benhNhan.GioiTinh.Value switch
        {
            1 => "Nam", 2 or 0 => "Nữ", _ => "Khác"
        } : "Không rõ";

        return new PatientDetailDto
        {
            BenhNhanId = benhNhan.BenhNhanId,
            MaYTe = benhNhan.MaYTe,
            FID = benhNhan.FID,
            SoVaoVien = benhNhan.SoVaoVien,
            PID = benhNhan.PID,
            TenBenhNhan = benhNhan.TenBenhNhan ?? "Unknown",
            Ho = benhNhan.Ho,
            Ten = benhNhan.Ten,
            GioiTinh = gioiTinh,
            Tuoi = tuoi,
            NgaySinh = benhNhan.NgaySinh?.ToString("yyyy-MM-dd"),
            NgayGioSinh = benhNhan.NgayGioSinh?.ToString("yyyy-MM-dd HH:mm:ss"),
            NamSinh = benhNhan.NamSinh?.ToString(),
            MaNoiSinh = benhNhan.MaNoiSinh,
            SoDienThoai = benhNhan.SoDienThoai,
            DienThoaiBan = benhNhan.DienThoaiBan,
            Email = benhNhan.Email,
            SoNha = benhNhan.SoNha,
            DiaChi = benhNhan.DiaChi,
            DiaChiThuongTru = benhNhan.DiaChiThuongTru,
            DiaChiLienLac = benhNhan.DiaChiLienLac,
            DiaChiCoQuan = benhNhan.DiaChiCoQuan,
            TinhThanhId = benhNhan.TinhThanhId?.ToString(),
            QuanHuyenId = benhNhan.QuanHuyenId?.ToString(),
            XaPhuongId = benhNhan.XaPhuongId,
            CMND = benhNhan.CMND,
            HoChieu = benhNhan.HoChieu,
            NhomMau = nhomMau,
            YeuToRh = yeuToRh,
            TienSuBenh = benhNhan.TienSuBenh,
            TienSuDiUng = benhNhan.TienSuDiUng,
            TienSuHutThuocLa = benhNhan.TienSuHutThuocLa,
            SoLuuTruNoiTru = benhNhan.SoLuuTruNoiTru,
            SoLuuTruNgoaiTru = benhNhan.SoLuuTruNgoaiTru,
            HinhAnhDaiDien = benhNhan.HinhAnhDaiDien,
            NgheNghiepId = benhNhan.NgheNghiepId?.ToString(),
            QuocTichId = benhNhan.QuocTichId?.ToString(),
            DanTocId = benhNhan.DanTocId?.ToString(),
            TrinhDoVanHoaId = benhNhan.TrinhDoVanHoaId?.ToString(),
            TinhTrangHonNhanId = benhNhan.TinhTrangHonNhanId?.ToString(),
            VietKieu = benhNhan.VietKieu == "1" || benhNhan.VietKieu?.ToLower() == "true" ? true : false,
            NguoiNuocNgoai = benhNhan.NguoiNuocNgoai == "1" || benhNhan.NguoiNuocNgoai?.ToLower() == "true" ? true : false,
            NguoiLienHeTen = benhNhan.NguoiLienHe,
            NguoiLienHeSdt = benhNhan.ThongTinNguoiLienHe,
            NguoiLienHeDiaChi = benhNhan.DiaChi,
            NguoiLienHeQuanHe = benhNhan.MoiQuanHeId?.ToString(),
            TuVong = benhNhan.TuVong == "1" || benhNhan.TuVong?.ToLower() == "true" ? true : false,
            NgayTuVong = benhNhan.NgayTuVong,
            ThoiGianTuVong = benhNhan.ThoiGianTuVong?.ToString("yyyy-MM-dd HH:mm:ss"),
            NguyenNhanTuVongId = benhNhan.NguyenNhanTuVongId?.ToString(),
            Active = benhNhan.Active == "1" || benhNhan.Active?.ToLower() == "true" ? true : false,
            BenhVienId = int.TryParse(benhNhan.BenhVienId, out int bvId) ? bvId : (int?)null,
            SiteId = int.TryParse(benhNhan.SiteId, out int sId) ? sId : (int?)null,
            NgayTao = benhNhan.NgayTao,
            NgayCapNhat = benhNhan.NgayCapNhat,
            NguoiTaoId = benhNhan.NguoiTaoId?.ToString(),
            NguoiCapNhatId = benhNhan.NguoiCapNhatId?.ToString(),
            Note = benhNhan.GhiChu
        };
    }

    private float[] ConvertBytesToFloatArray(byte[]? bytes)
    {
        if (bytes == null || bytes.Length == 0) return Array.Empty<float>();
        
        var floats = new float[bytes.Length / sizeof(float)];
        Buffer.BlockCopy(bytes, 0, floats, 0, bytes.Length);
        return floats;
    }

    private byte[] ConvertFloatArrayToBytes(float[] floats)
    {
        var bytes = new byte[floats.Length * sizeof(float)];
        Buffer.BlockCopy(floats, 0, bytes, 0, bytes.Length);
        return bytes;
    }

    #endregion
}

