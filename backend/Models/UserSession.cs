
namespace HospitalCare.Web.Models;

public class UserSession
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public int UserId { get; set; }

    public User User { get; set; } = null!;

    public string TokenHash { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;

    public DateTime ExpiresAt { get; set; }

    public DateTime? RevokedAt { get; set; }
}
