using HospitalVision.Domain.Entities;
using HospitalVision.Domain.Interfaces;
using HospitalVision.API.DTOs;

namespace HospitalVision.API.Services;

public interface IPatientService
{
    Task<PatientInfoDto?> GetPatientInfoAsync(string patientId);
    Task<BenhNhan?> GetBenhNhanAsync(int benhNhanId);
    Task<List<BenhNhan>> GetAllBenhNhansAsync();
    Task<List<BenhNhan>> SearchBenhNhansAsync(string searchTerm);
    Task<DashboardStatsDto> GetDashboardStatsAsync();
}

public class PatientService : IPatientService
{
    private readonly IBenhNhanRepository _benhNhanRepository;
    private readonly IDetectionHistoryRepository _detectionHistoryRepository;
    private readonly ILogger<PatientService> _logger;
    
    // In-memory storage for detection events
    private static readonly List<DetectionEventMemory> _detectionEvents = new();
    // Shared storage for alerts (accessible from AlertService)
    public static readonly List<FallAlertMemory> SharedAlerts = new();

    public PatientService(IBenhNhanRepository benhNhanRepository, IDetectionHistoryRepository detectionHistoryRepository, ILogger<PatientService> logger)
    {
        _benhNhanRepository = benhNhanRepository;
        _detectionHistoryRepository = detectionHistoryRepository;
        _logger = logger;
    }

    public async Task<PatientInfoDto?> GetPatientInfoAsync(string patientId)
    {
        // Try to parse as int for BenhNhan ID
        if (int.TryParse(patientId, out int benhNhanId))
        {
            var benhNhan = await _benhNhanRepository.GetByIdAsync(benhNhanId);
            if (benhNhan != null)
            {
                // Chuyển đổi giới tính
                string gender = "Unknown";
                if (benhNhan.GioiTinh.HasValue)
                {
                    gender = benhNhan.GioiTinh.Value switch
                    {
                        1 => "Nam",
                        2 or 0 => "Nữ",
                        _ => benhNhan.GioiTinh.Value.ToString()
                    };
                }

                return new PatientInfoDto
                {
                    Id = benhNhan.BenhNhanId.ToString(),
                    Name = benhNhan.TenBenhNhan ?? "Unknown",
                    Age = benhNhan.NgaySinh.HasValue ? CalculateAge(benhNhan.NgaySinh.Value) : 0,
                    Gender = gender,
                    Phone = benhNhan.SoDienThoai ?? "",
                    PhotoUrl = benhNhan.HinhAnhDaiDien,
                    CurrentAppointment = null,
                    UpcomingAppointments = new List<AppointmentInfoDto>()
                };
            }
        }
        return null;
    }

    public async Task<BenhNhan?> GetBenhNhanAsync(int benhNhanId)
    {
        return await _benhNhanRepository.GetByIdAsync(benhNhanId);
    }

    public async Task<List<BenhNhan>> GetAllBenhNhansAsync()
    {
        return await _benhNhanRepository.GetAllAsync();
    }

    public async Task<List<BenhNhan>> SearchBenhNhansAsync(string searchTerm)
    {
        return await _benhNhanRepository.SearchBenhNhansAsync(searchTerm);
    }

    public async Task<DashboardStatsDto> GetDashboardStatsAsync()
    {
        var today = DateTime.Today;
        var todayUtc = DateTime.UtcNow.Date;

        // Count từ bảng TT_BENHNHAN thực tế
        var totalPatients = await _benhNhanRepository.CountAsync();
        
        // Get alerts from shared storage
        var activeAlerts = SharedAlerts.Where(a => a.Status == "Active").ToList();
        
        // Get detections from database (DETECTION_HISTORY) - using DetectionHistoryRepository
        var detectionsToday = await _detectionHistoryRepository.GetTodayDetectionsAsync();
        
        var patientsDetectedToday = detectionsToday
            .Select(d => d.MaYTe)
            .Distinct()
            .Count();

        // Get recent detections from database
        var recentDetectionsFromDb = await _detectionHistoryRepository.GetRecentDetectionsAsync(10);

        var stats = new DashboardStatsDto
        {
            TotalPatients = totalPatients,
            TodayAppointments = 0, // Không có bảng appointments trong DB
            ActiveAlerts = activeAlerts.Count,
            PatientsDetectedToday = patientsDetectedToday,
            RecentAlerts = SharedAlerts
                .OrderByDescending(a => a.Timestamp)
                .Take(10)
                .Select(a => new RecentAlertDto
                {
                    Id = a.Id,
                    PatientName = a.PatientName ?? "Unknown",
                    Timestamp = a.Timestamp,
                    Location = a.Location ?? "",
                    Status = a.Status ?? "Unknown"
                })
                .ToList(),
            RecentDetections = recentDetectionsFromDb
                .Select(d => new RecentDetectionDto
                {
                    PatientId = d.MaYTe,
                    PatientName = d.PatientName ?? d.MaYTe,
                    Timestamp = d.DetectedAt,
                    Location = d.Location ?? "Cổng chính",
                    Confidence = d.Confidence
                })
                .ToList()
        };

        return stats;
    }

    // Static methods for detection events (legacy - kept for backward compatibility)
    public static void AddDetectionEvent(string patientId, string patientName, string location)
    {
        _detectionEvents.Add(new DetectionEventMemory
        {
            PatientId = patientId,
            PatientName = patientName,
            Timestamp = DateTime.UtcNow,
            Location = location
        });
    }

    private static int CalculateAge(DateTime dateOfBirth)
    {
        var today = DateTime.Today;
        var age = today.Year - dateOfBirth.Year;
        if (dateOfBirth.Date > today.AddYears(-age)) age--;
        return age;
    }
}

// In-memory model for detection events
public class DetectionEventMemory
{
    public string PatientId { get; set; } = "";
    public string PatientName { get; set; } = "";
    public DateTime Timestamp { get; set; }
    public string Location { get; set; } = "";
}
