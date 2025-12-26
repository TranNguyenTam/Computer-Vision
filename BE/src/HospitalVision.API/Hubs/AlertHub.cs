using Microsoft.AspNetCore.SignalR;

namespace HospitalVision.API.Hubs;

/// SignalR Hub for real-time alerts and notifications
public class AlertHub : Hub
{
    private readonly ILogger<AlertHub> _logger;

    public AlertHub(ILogger<AlertHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    /// Join a specific location group to receive alerts for that location
    public async Task JoinLocationGroup(string location)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"Location_{location}");
        _logger.LogInformation("Client {ConnectionId} joined location: {Location}", 
            Context.ConnectionId, location);
    }

    /// Leave a location group
    public async Task LeaveLocationGroup(string location)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Location_{location}");
        _logger.LogInformation("Client {ConnectionId} left location: {Location}", 
            Context.ConnectionId, location);
    }

    /// Send a message to all connected clients
    public async Task SendMessage(string type, string message)
    {
        await Clients.All.SendAsync("ReceiveMessage", type, message);
    }

    /// Acknowledge an alert (for staff/operators)
    public async Task AcknowledgeAlert(int alertId, string acknowledgedBy)
    {
        await Clients.All.SendAsync("AlertAcknowledged", new
        {
            AlertId = alertId,
            AcknowledgedBy = acknowledgedBy,
            Timestamp = DateTime.UtcNow
        });
        
        _logger.LogInformation("Alert {AlertId} acknowledged by {User}", alertId, acknowledgedBy);
    }
}
