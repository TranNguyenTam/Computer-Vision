using HospitalVision.API.Models.DTOs;
using HospitalVision.API.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HospitalVision.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FaceController : ControllerBase
{
    private readonly IFaceService _faceService;
    private readonly IPatientService _patientService;
    private readonly ILogger<FaceController> _logger;

    public FaceController(
        IFaceService faceService,
        IPatientService patientService,
        ILogger<FaceController> logger)
    {
        _faceService = faceService;
        _patientService = patientService;
        _logger = logger;
    }

    /// Kiểm tra mã y tế có tồn tại không
    [HttpGet("validate/{mayte}")]
    public async Task<ActionResult> ValidateMaYTe(string mayte)
    {
        try
        {
            var patient = await _faceService.ValidateMaYTeAsync(mayte);
            if (patient == null)
            {
                return NotFound(new { 
                    success = false, 
                    message = $"Không tìm thấy bệnh nhân với MAYTE: {mayte}" 
                });
            }

            return Ok(new { success = true, patient });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating MAYTE: {MaYTe}", mayte);
            return StatusCode(500, new { success = false, message = "Internal server error" });
        }
    }

    /// Tìm kiếm bệnh nhân theo tên hoặc mã y tế
    [HttpGet("search-patient")]
    public async Task<ActionResult> SearchPatient([FromQuery] string? term)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(term) || term.Length < 2)
            {
                return Ok(new { success = true, patients = new List<object>() });
            }

            var benhNhans = await _faceService.SearchPatientsAsync(term);
            var results = benhNhans.Select(b => new
            {
                b.BenhNhanId,
                b.MaYTe,
                b.TenBenhNhan,
                b.NgaySinh,
                b.SoDienThoai,
                b.DiaChi
            }).ToList();

            return Ok(new { success = true, patients = results });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching patients");
            return StatusCode(500, new { success = false, message = "Internal server error" });
        }
    }

    /// Lấy thông tin chi tiết bệnh nhân
    [HttpGet("patient/{mayte}")]
    public async Task<ActionResult> GetPatientByMaYTe(string mayte)
    {
        try
        {
            var patient = await _faceService.GetPatientByMaYTeAsync(mayte);
            if (patient == null)
            {
                return NotFound(new { success = false, message = "Patient not found" });
            }

            return Ok(new { success = true, patient });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting patient: {MaYTe}", mayte);
            return StatusCode(500, new { success = false, message = "Internal server error" });
        }
    }

    /// Lấy danh sách ảnh khuôn mặt của bệnh nhân
    [HttpGet("images/{mayte}")]
    public async Task<ActionResult> GetFaceImages(string mayte)
    {
        try
        {
            var images = await _faceService.GetFacesByMaYTeAsync(mayte);
            return Ok(new { success = true, images });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting face images for: {MaYTe}", mayte);
            return StatusCode(500, new { success = false, message = "Internal server error" });
        }
    }

    /// Upload ảnh khuôn mặt mới
    [HttpPost("images")]
    public async Task<ActionResult> UploadFaceImage([FromBody] SaveEmbeddingRequest request)
    {
        try
        {
            await _faceService.SaveEmbeddingAsync(request);
            return Ok(new { success = true, message = "Face image uploaded successfully" });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading face image");
            return StatusCode(500, new { success = false, message = "Internal server error" });
        }
    }

    /// Xóa ảnh khuôn mặt
    [HttpDelete("images/{id}")]
    public async Task<ActionResult> DeleteFaceImage(int id)
    {
        try
        {
            var deleted = await _faceService.DeleteFaceImageAsync(id);
            if (!deleted)
            {
                return NotFound(new { success = false, message = "Face image not found" });
            }

            return Ok(new { success = true, message = "Face image deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting face image: {Id}", id);
            return StatusCode(500, new { success = false, message = "Internal server error" });
        }
    }

    /// Xóa tất cả ảnh của bệnh nhân
    [HttpDelete("patient/{maYTe}")]
    public async Task<ActionResult> DeletePatientFaces(string maYTe)
    {
        try
        {
            var deleted = await _faceService.DeleteAllFacesByMaYTeAsync(maYTe);
            if (!deleted)
            {
                return NotFound(new { success = false, message = "No faces found for this patient" });
            }

            return Ok(new { success = true, message = "All face images deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting patient faces: {MaYTe}", maYTe);
            return StatusCode(500, new { success = false, message = "Internal server error" });
        }
    }

    /// Lấy thống kê face recognition
    [HttpGet("stats")]
    public async Task<ActionResult> GetStatistics()
    {
        try
        {
            var stats = await _faceService.GetFaceStatisticsAsync();
            return Ok(new { success = true, stats });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting statistics");
            return StatusCode(500, new { success = false, message = "Internal server error" });
        }
    }

    /// Lấy tất cả embeddings cho AI module
    [HttpGet("embeddings")]
    public async Task<ActionResult> GetAllEmbeddings()
    {
        try
        {
            var embeddings = await _faceService.GetAllEmbeddingsAsync();
            return Ok(embeddings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting embeddings");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// Lưu embedding từ AI module
    [HttpPost("embeddings")]
    public async Task<ActionResult> SaveEmbedding([FromBody] SaveEmbeddingRequest request)
    {
        try
        {
            await _faceService.SaveEmbeddingAsync(request);
            return Ok(new { success = true, message = "Embedding saved successfully" });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving embedding");
            return StatusCode(500, new { success = false, message = "Internal server error" });
        }
    }

    /// Ghi nhận phát hiện khuôn mặt từ camera
    [HttpPost("detection")]
    public async Task<ActionResult> RecordDetection([FromBody] RecordDetectionRequest request)
    {
        try
        {
            var result = await _faceService.RecordDetectionAsync(request);
            var resultDict = (dynamic)result;
            
            return Ok(new 
            { 
                success = true, 
                message = "Detection recorded successfully",
                patientName = resultDict.PatientName,
                alreadyRecorded = resultDict.AlreadyRecorded
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recording detection");
            return StatusCode(500, new { success = false, message = "Internal server error" });
        }
    }

    /// Lấy danh sách phát hiện hôm nay
    [HttpGet("detections/today")]
    public async Task<ActionResult> GetTodayDetections()
    {
        try
        {
            var detections = await _faceService.GetTodayDetectionsAsync();
            return Ok(new { success = true, data = detections });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting today's detections");
            return StatusCode(500, new { success = false, message = "Internal server error" });
        }
    }

    /// Lấy danh sách MaYTe đã phát hiện hôm nay
    [HttpGet("detections/today/mayte-list")]
    public async Task<ActionResult> GetTodayDetectedMaYTes()
    {
        try
        {
            var maYTes = await _faceService.GetTodayDetectedMaYTesAsync();
            return Ok(new { success = true, maYTes });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting detected MaYTes");
            return StatusCode(500, new { success = false, message = "Internal server error" });
        }
    }

    /// Xóa tất cả phát hiện hôm nay
    [HttpDelete("detections/today")]
    public async Task<ActionResult> DeleteTodayDetections()
    {
        try
        {
            var deleted = await _faceService.DeleteTodayDetectionsAsync();
            return Ok(new { success = true, message = "Today's detections cleared", deleted });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting today's detections");
            return StatusCode(500, new { success = false, message = "Internal server error" });
        }
    }
}
