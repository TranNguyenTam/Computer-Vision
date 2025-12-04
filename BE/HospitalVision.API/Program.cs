using HospitalVision.API.Data;
using HospitalVision.API.Hubs;
using HospitalVision.API.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

// Add SignalR for real-time communication
builder.Services.AddSignalR();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
    
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:5173")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Add Database Context
var dbProvider = builder.Configuration.GetValue<string>("DatabaseProvider") ?? "InMemory";
Console.WriteLine($"=== Database Provider: {dbProvider} ===");

if (dbProvider == "SqlServer")
{
    Console.WriteLine("=== Connecting to SQL Server ===");
    
    // HospitalDbContext - kết nối PRODUCT_HIS (chỉ đọc thông tin bệnh nhân)
    builder.Services.AddDbContext<HospitalDbContext>(options =>
        options.UseSqlServer(builder.Configuration.GetConnectionString("SqlServer")));
    
    // QmsDbContext - kết nối K_QMS_YHCT (có quyền write - lưu ảnh khuôn mặt)
    builder.Services.AddDbContext<QmsDbContext>(options =>
        options.UseSqlServer(builder.Configuration.GetConnectionString("QmsDatabase")));
}
else if (dbProvider == "PostgreSQL")
{
    Console.WriteLine("=== Connecting to PostgreSQL ===");
    builder.Services.AddDbContext<HospitalDbContext>(options =>
        options.UseNpgsql(builder.Configuration.GetConnectionString("PostgreSQL")));
    // QmsDbContext không hỗ trợ PostgreSQL
}
else
{
    Console.WriteLine("=== Using In-Memory Database ===");
    // Default to In-Memory for development
    builder.Services.AddDbContext<HospitalDbContext>(options =>
        options.UseInMemoryDatabase("HospitalVisionDb"));
    builder.Services.AddDbContext<QmsDbContext>(options =>
        options.UseInMemoryDatabase("QmsDb"));
}

// Add Services
builder.Services.AddScoped<IPatientService, PatientService>();
builder.Services.AddScoped<IAlertService, AlertService>();
builder.Services.AddSingleton<INotificationService, NotificationService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "Hospital Vision API v1");
    });
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseAuthorization();

app.MapControllers();
app.MapHub<AlertHub>("/hubs/alerts");

// Health check endpoint
app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

app.Run();
