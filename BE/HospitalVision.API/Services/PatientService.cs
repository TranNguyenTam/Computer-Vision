using HospitalVision.API.Data;
using HospitalVision.API.Models;
using HospitalVision.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

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
    private readonly HospitalDbContext _context;
    private readonly ILogger<PatientService> _logger;
    
    // In-memory storage for detection events
    private static readonly List<DetectionEventMemory> _detectionEvents = new();
    // Shared storage for alerts (accessible from AlertService)
    public static readonly List<FallAlertMemory> SharedAlerts = new();

    public PatientService(HospitalDbContext context, ILogger<PatientService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<PatientInfoDto?> GetPatientInfoAsync(string patientId)
    {
        // Try to parse as int for BenhNhan ID
        if (int.TryParse(patientId, out int benhNhanId))
        {
            var benhNhan = await _context.BenhNhans.FindAsync(benhNhanId);
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
        return await _context.BenhNhans.FindAsync(benhNhanId);
    }

    public async Task<List<BenhNhan>> GetAllBenhNhansAsync()
    {
        return await _context.BenhNhans.OrderBy(p => p.TenBenhNhan).ToListAsync();
    }

    public async Task<List<BenhNhan>> SearchBenhNhansAsync(string searchTerm)
    {
        return await _context.BenhNhans
            .Where(p => (p.TenBenhNhan != null && p.TenBenhNhan.Contains(searchTerm)) || 
                       (p.MaYTe != null && p.MaYTe.Contains(searchTerm)) ||
                       (p.SoDienThoai != null && p.SoDienThoai.Contains(searchTerm)))
            .OrderBy(p => p.TenBenhNhan)
            .ToListAsync();
    }

    public async Task<DashboardStatsDto> GetDashboardStatsAsync()
    {
        var today = DateTime.Today;

        // Count từ bảng TT_BENHNHAN thực tế
        var totalPatients = await _context.BenhNhans.CountAsync();
        
        // Get alerts from shared storage
        var activeAlerts = SharedAlerts.Where(a => a.Status == "Active").ToList();
        
        var patientsDetectedToday = _detectionEvents
            .Where(d => d.Timestamp >= today)
            .Select(d => d.PatientId)
            .Distinct()
            .Count();

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
            RecentDetections = _detectionEvents
                .OrderByDescending(d => d.Timestamp)
                .Take(10)
                .Select(d => new RecentDetectionDto
                {
                    PatientId = d.PatientId,
                    PatientName = d.PatientName,
                    Timestamp = d.Timestamp,
                    Location = d.Location
                })
                .ToList()
        };

        return stats;
    }

    // Static methods for detection events
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
