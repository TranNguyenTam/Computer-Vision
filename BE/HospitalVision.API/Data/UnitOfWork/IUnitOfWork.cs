using HospitalVision.API.Models.Entities;
using HospitalVision.API.Repositories.Interfaces;

namespace HospitalVision.API.Data.UnitOfWork;

public interface IUnitOfWork : IDisposable
{
    // Repositories
    IBenhNhanRepository BenhNhans { get; }
    IFaceImageRepository FaceImages { get; }
    IHangDoiPhongBanRepository HangDoiPhongBans { get; }
    IRepository<DetectionHistory> DetectionHistories { get; }
    IFallAlertRepository FallAlerts { get; }

    // Transaction management
    Task<int> SaveChangesAsync();
    Task BeginTransactionAsync();
    Task CommitTransactionAsync();
    Task RollbackTransactionAsync();
}
