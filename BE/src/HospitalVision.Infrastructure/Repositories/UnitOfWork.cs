using HospitalVision.Domain.Interfaces;
using HospitalVision.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Storage;

namespace HospitalVision.Infrastructure.Repositories;

/// <summary>
/// Unit of Work implementation for managing transactions across repositories
/// Requires two DbContext instances: one for hospital data (read-only) and one for QMS data (read-write)
/// </summary>
public class UnitOfWork : IUnitOfWork
{
    private readonly HospitalDbContext _hospitalContext;
    private readonly QmsDbContext _qmsContext;
    
    private IBenhNhanRepository? _benhNhans;
    private IFaceImageRepository? _faceImages;
    private IAlertRepository? _alerts;
    private IDetectionHistoryRepository? _detectionHistories;
    private IHangDoiPhongBanRepository? _hangDoiPhongBans;
    
    private IDbContextTransaction? _transaction;
    private bool _disposed = false;

    /// <summary>
    /// Constructor for UnitOfWork
    /// Note: Use IUnitOfWorkFactory to create instances with correct contexts
    /// </summary>
    public UnitOfWork(HospitalDbContext hospitalContext, QmsDbContext qmsContext)
    {
        _hospitalContext = hospitalContext;
        _qmsContext = qmsContext;
    }

    public IBenhNhanRepository BenhNhans => 
        _benhNhans ??= new BenhNhanRepository(_hospitalContext);

    public IFaceImageRepository FaceImages => 
        _faceImages ??= new FaceImageRepository(_qmsContext);

    public IAlertRepository Alerts => 
        _alerts ??= new AlertRepository(_qmsContext);

    public IDetectionHistoryRepository DetectionHistories => 
        _detectionHistories ??= new DetectionHistoryRepository(_qmsContext);

    public IHangDoiPhongBanRepository HangDoiPhongBans => 
        _hangDoiPhongBans ??= new HangDoiPhongBanRepository(_qmsContext);

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // Note: HospitalDbContext is read-only, so we only save QmsDbContext
        return await _qmsContext.SaveChangesAsync(cancellationToken);
    }

    public async Task BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        // Only QmsDbContext supports write transactions
        _transaction = await _qmsContext.Database.BeginTransactionAsync(cancellationToken);
    }

    public async Task CommitTransactionAsync(CancellationToken cancellationToken = default)
    {
        if (_transaction != null)
        {
            await _transaction.CommitAsync(cancellationToken);
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public async Task RollbackTransactionAsync(CancellationToken cancellationToken = default)
    {
        if (_transaction != null)
        {
            await _transaction.RollbackAsync(cancellationToken);
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed)
        {
            if (disposing)
            {
                _transaction?.Dispose();
                _qmsContext.Dispose();
                _hospitalContext.Dispose();
            }
            _disposed = true;
        }
    }

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    public async ValueTask DisposeAsync()
    {
        if (!_disposed)
        {
            if (_transaction != null)
            {
                await _transaction.DisposeAsync();
            }
            await _qmsContext.DisposeAsync();
            await _hospitalContext.DisposeAsync();
            _disposed = true;
        }
        GC.SuppressFinalize(this);
    }
}
