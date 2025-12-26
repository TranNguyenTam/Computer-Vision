using HospitalVision.API.Models;
using HospitalVision.API.Repositories.Implementations;
using HospitalVision.API.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore.Storage;

namespace HospitalVision.API.Data.UnitOfWork;

/// <summary>
/// Unit of Work implementation managing both QMS and Hospital contexts
/// </summary>
public class UnitOfWork : IUnitOfWork
{
    private readonly QmsDbContext _qmsContext;
    private readonly HospitalDbContext _hospitalContext;
    private IDbContextTransaction? _transaction;

    // Lazy-loaded repositories
    private IBenhNhanRepository? _benhNhans;
    private IFaceImageRepository? _faceImages;
    private IHangDoiPhongBanRepository? _hangDoiPhongBans;
    private IRepository<DetectionHistory>? _detectionHistories;

    public UnitOfWork(QmsDbContext qmsContext, HospitalDbContext hospitalContext)
    {
        _qmsContext = qmsContext;
        _hospitalContext = hospitalContext;
    }

    // Repository properties with lazy initialization
    public IBenhNhanRepository BenhNhans => 
        _benhNhans ??= new BenhNhanRepository(_hospitalContext);

    public IFaceImageRepository FaceImages => 
        _faceImages ??= new FaceImageRepository(_qmsContext);

    public IHangDoiPhongBanRepository HangDoiPhongBans => 
        _hangDoiPhongBans ??= new HangDoiPhongBanRepository(_qmsContext, _hospitalContext);

    public IRepository<DetectionHistory> DetectionHistories =>
        _detectionHistories ??= new Repository<DetectionHistory>(_qmsContext);

    // Transaction management (primarily for QMS context - Hospital is read-only)
    public async Task<int> SaveChangesAsync()
    {
        // Save changes to QMS context (where we have write permission)
        return await _qmsContext.SaveChangesAsync();
        // Hospital context is read-only, no SaveChanges needed
    }

    public async Task BeginTransactionAsync()
    {
        _transaction = await _qmsContext.Database.BeginTransactionAsync();
    }

    public async Task CommitTransactionAsync()
    {
        if (_transaction != null)
        {
            await _transaction.CommitAsync();
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public async Task RollbackTransactionAsync()
    {
        if (_transaction != null)
        {
            await _transaction.RollbackAsync();
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public void Dispose()
    {
        _transaction?.Dispose();
        // Don't dispose contexts - managed by DI container
    }
}
