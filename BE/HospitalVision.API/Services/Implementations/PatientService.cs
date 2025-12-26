using HospitalVision.API.Data.UnitOfWork;
using HospitalVision.API.Models;
using HospitalVision.API.Models.DTOs;
using HospitalVision.API.Services.Interfaces;

namespace HospitalVision.API.Services.Implementations;

public class PatientService : IPatientService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<PatientService> _logger;
    
    // In-memory detection events (temporary)
    private static readonly List<RecentDetectionDto> _recentDetections = new();
    private static readonly object _lockObj = new();

    public PatientService(IUnitOfWork unitOfWork, ILogger<PatientService> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<PatientInfoDto?> GetPatientInfoAsync(string patientId)
    {
        BenhNhan? benhNhan = null;

        // Try to parse as int for BenhNhan ID
        if (int.TryParse(patientId, out int benhNhanId))
        {
            benhNhan = await _unitOfWork.BenhNhans.GetByIdAsync(benhNhanId);
        }
        
        // If not found by ID or patientId is not a number, try to find by MaYTe
        if (benhNhan == null)
        {
            benhNhan = await _unitOfWork.BenhNhans.GetByMaYTeAsync(patientId);
        }

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

        return null;
    }

    public async Task<BenhNhan?> GetBenhNhanAsync(int benhNhanId)
    {
        return await _unitOfWork.BenhNhans.GetByIdAsync(benhNhanId);
    }

    public async Task<BenhNhan?> GetBenhNhanByMaYTeAsync(string maYTe)
    {
        return await _unitOfWork.BenhNhans.GetByMaYTeAsync(maYTe);
    }

    public async Task<List<BenhNhan>> GetAllBenhNhansAsync()
    {
        var all = await _unitOfWork.BenhNhans.GetAllAsync();
        return all.OrderBy(p => p.TenBenhNhan).ToList();
    }

    public async Task<List<BenhNhan>> SearchBenhNhansAsync(string searchTerm)
    {
        return await _unitOfWork.BenhNhans.SearchByNameOrMaYTeAsync(searchTerm);
    }

    public async Task<DashboardStatsDto> GetDashboardStatsAsync()
    {
        // Count total patients
        var totalPatients = await _unitOfWork.BenhNhans.CountAsync();
        
        // Mock data for now (can be enhanced later)
        return new DashboardStatsDto
        {
            TotalPatients = totalPatients,
            PatientsDetectedToday = 0, // Will be calculated from face detections
            ActiveAlerts = 0, // Will be calculated from alerts
            RecentDetections = new List<RecentDetectionDto>()
        };
    }

    private static int CalculateAge(DateTime dateOfBirth)
    {
        var today = DateTime.Today;
        var age = today.Year - dateOfBirth.Year;
        if (dateOfBirth.Date > today.AddYears(-age)) age--;
        return age;
    }

    public Task AddDetectionEventAsync(string patientId, string patientName, string location)
    {
        lock (_lockObj)
        {
            _recentDetections.Add(new RecentDetectionDto
            {
                PatientId = patientId,
                PatientName = patientName,
                Timestamp = DateTime.UtcNow,
                Location = location,
                Confidence = 0.85
            });

            // Keep only last 100 detections
            if (_recentDetections.Count > 100)
            {
                _recentDetections.RemoveAt(0);
            }
        }

        _logger.LogInformation("Added detection event: {PatientId} - {PatientName}", patientId, patientName);
        return Task.CompletedTask;
    }

    public List<RecentDetectionDto> GetRecentDetections()
    {
        lock (_lockObj)
        {
            return _recentDetections
                .OrderByDescending(d => d.Timestamp)
                .Take(20)
                .ToList();
        }
    }

    public async Task<object> GetPatientsWithPaginationAsync(int page, int pageSize)
    {
        var totalCount = await _unitOfWork.BenhNhans.CountAsync();
        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        var patients = await _unitOfWork.BenhNhans.GetPagedAsync(page, pageSize);

        return new
        {
            data = patients,
            pagination = new
            {
                page,
                pageSize,
                totalItems = totalCount,
                totalPages
            }
        };
    }

    public async Task<BenhNhan?> GetPatientByIdAsync(int id)
    {
        return await _unitOfWork.BenhNhans.GetByIdAsync(id);
    }

    public async Task<List<BenhNhan>> SearchPatientsAsync(string searchTerm, int maxResults = 50)
    {
        var results = await _unitOfWork.BenhNhans.SearchByNameOrMaYTeAsync(searchTerm);
        return results.Take(maxResults).ToList();
    }
}
