namespace HospitalVision.Domain.Interfaces;
>
public interface IUnitOfWork : IDisposable, IAsyncDisposable
{
    IBenhNhanRepository BenhNhans { get; }
    IFaceImageRepository FaceImages { get; }
    IDetectionHistoryRepository DetectionHistories { get; }
    IAlertRepository Alerts { get; }
    IHangDoiPhongBanRepository HangDoiPhongBans { get; }
    
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    Task BeginTransactionAsync(CancellationToken cancellationToken = default);
    Task CommitTransactionAsync(CancellationToken cancellationToken = default);
    Task RollbackTransactionAsync(CancellationToken cancellationToken = default);
}
