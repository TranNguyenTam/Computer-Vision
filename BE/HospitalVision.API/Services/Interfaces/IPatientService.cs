using HospitalVision.API.Models;
using HospitalVision.API.Models.DTOs;

namespace HospitalVision.API.Services.Interfaces;

public interface IPatientService
{
    Task<PatientInfoDto?> GetPatientInfoAsync(string patientId);
    Task<BenhNhan?> GetBenhNhanAsync(int benhNhanId);
    Task<BenhNhan?> GetBenhNhanByMaYTeAsync(string maYTe);
    Task<BenhNhan?> GetBenhNhanByFaceIdAsync(string faceId);
    Task<List<BenhNhan>> GetAllBenhNhansAsync();
    Task<List<BenhNhan>> SearchBenhNhansAsync(string searchTerm);
    Task<DashboardStatsDto> GetDashboardStatsAsync();
    Task AddDetectionEventAsync(string patientId, string patientName, string location);
    List<RecentDetectionDto> GetRecentDetections();
    
    // New methods for BenhNhanController
    Task<object> GetPatientsWithPaginationAsync(int page, int pageSize);
    Task<BenhNhan?> GetPatientByIdAsync(int id);
    Task<List<BenhNhan>> SearchPatientsAsync(string searchTerm, int maxResults = 50);
}
