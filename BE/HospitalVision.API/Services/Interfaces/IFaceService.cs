using HospitalVision.API.Models.DTOs;
using HospitalVision.API.Models.Entities;

namespace HospitalVision.API.Services.Interfaces;

public interface IFaceService
{
    // Patient validation and search
    Task<PatientDetailDto?> ValidateMaYTeAsync(string maYTe);
    Task<List<BenhNhan>> SearchPatientsAsync(string searchTerm);
    Task<PatientDetailDto?> GetPatientByMaYTeAsync(string maYTe);
    
    // Face image management
    Task<FaceImage> SaveFaceImageAsync(string maYTe, byte[] embedding, string? imagePath = null);
    Task<List<FaceImage>> GetFacesByMaYTeAsync(string maYTe);
    Task<bool> DeleteFaceImageAsync(int id);
    Task<bool> DeleteAllFacesByMaYTeAsync(string maYTe);
    
    // Statistics
    Task<object> GetFaceStatisticsAsync();
    
    // Embeddings for AI
    Task<List<EmbeddingData>> GetAllEmbeddingsAsync();
    Task SaveEmbeddingAsync(SaveEmbeddingRequest request);
    
    // Detection records
    Task<object> RecordDetectionAsync(RecordDetectionRequest request);
    Task<List<object>> GetTodayDetectionsAsync();
    Task<List<string>> GetTodayDetectedMaYTesAsync();
    Task<bool> DeleteTodayDetectionsAsync();
}
