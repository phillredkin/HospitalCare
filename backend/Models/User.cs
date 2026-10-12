
namespace HospitalCare.Web.Models;

public class User
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public UserRole Role { get; set; } = UserRole.Doctor;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<UserSession> Sessions { get; set; }
        = new List<UserSession>();
}

public enum UserRole
{
    Admin,
    Doctor
}
