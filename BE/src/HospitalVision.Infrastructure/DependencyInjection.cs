using HospitalVision.Domain.Interfaces;
using HospitalVision.Infrastructure.Data;
using HospitalVision.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HospitalVision.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, 
        IConfiguration configuration)
    {
        // Register DbContexts
        services.AddDbContext<HospitalDbContext>(options =>
            options.UseSqlServer(
                configuration.GetConnectionString("SqlServer"),
                b => b.MigrationsAssembly(typeof(HospitalDbContext).Assembly.FullName)));

        services.AddDbContext<QmsDbContext>(options =>
            options.UseSqlServer(
                configuration.GetConnectionString("QmsDatabase"),
                b => b.MigrationsAssembly(typeof(QmsDbContext).Assembly.FullName)));

        // Register individual repositories (for direct injection)
        services.AddScoped<IBenhNhanRepository, BenhNhanRepository>();
        services.AddScoped<IFaceImageRepository, FaceImageRepository>();
        services.AddScoped<IAlertRepository, AlertRepository>();
        services.AddScoped<IDetectionHistoryRepository, DetectionHistoryRepository>();
        services.AddScoped<IHangDoiPhongBanRepository, HangDoiPhongBanRepository>();

        // Register Unit of Work
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        return services;
    }
}
