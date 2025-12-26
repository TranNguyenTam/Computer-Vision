using HospitalVision.Domain.Entities;

namespace HospitalVision.Domain.Interfaces;

/// <summary>
/// Repository cho BenhNhan (chỉ đọc từ PRODUCT_HIS)
/// </summary>
public interface IBenhNhanRepository : IRepository<BenhNhan>
{
    Task<BenhNhan?> GetByMaYTeAsync(string maYTe, CancellationToken cancellationToken = default);
    Task<BenhNhan?> GetByIdAsync(int benhNhanId, CancellationToken cancellationToken = default);
    Task<IEnumerable<BenhNhan>> SearchAsync(string keyword, int limit = 20, CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(string maYTe, CancellationToken cancellationToken = default);
    Task<List<BenhNhan>> GetAllAsync();
    Task<List<BenhNhan>> SearchBenhNhansAsync(string searchTerm);
    Task<int> CountAsync();
}

/// <summary>
/// Repository cho FaceImage (đọc/ghi vào K_QMS_YHCT)
/// </summary>
public interface IFaceImageRepository : IRepository<FaceImage>
{
    Task<IEnumerable<FaceImage>> GetByMaYTeAsync(string maYTe, CancellationToken cancellationToken = default);
    Task<IEnumerable<FaceImage>> GetAllActiveEmbeddingsAsync(CancellationToken cancellationToken = default);
    Task DeleteByMaYTeAsync(string maYTe, CancellationToken cancellationToken = default);
}

public interface IDetectionHistoryRepository : IRepository<DetectionHistory>
{
    Task<IEnumerable<DetectionHistory>> GetTodayDetectionsAsync(CancellationToken cancellationToken = default);
    Task<IEnumerable<string>> GetTodayDetectedMaYTeListAsync(CancellationToken cancellationToken = default);
    Task<bool> IsDetectedTodayAsync(string maYTe, CancellationToken cancellationToken = default);
    Task ClearTodayDetectionsAsync(CancellationToken cancellationToken = default);
    Task<List<DetectionHistory>> GetRecentDetectionsAsync(int count = 10, CancellationToken cancellationToken = default);
}

public interface IAlertRepository : IRepository<Alert>
{
    Task<IEnumerable<Alert>> GetRecentAlertsAsync(int count = 50, CancellationToken cancellationToken = default);
    Task<IEnumerable<Alert>> GetUnresolvedAlertsAsync(CancellationToken cancellationToken = default);
    Task<Alert?> GetLatestFallAlertAsync(CancellationToken cancellationToken = default);
}

public interface IHangDoiPhongBanRepository : IRepository<HangDoiPhongBan>
{
    Task<IEnumerable<HangDoiPhongBan>> GetTodayQueueAsync(CancellationToken cancellationToken = default);
    Task<HangDoiPhongBan?> GetByBenhNhanIdTodayAsync(int benhNhanId, CancellationToken cancellationToken = default);
    Task<bool> IsInQueueTodayAsync(int benhNhanId, CancellationToken cancellationToken = default);
}
