
namespace HospitalCare.Web.Models;

public class ClinicalNote
{
    public int Id { get; set; }

    public int HospitalizationId { get; set; }

    public Hospitalization Hospitalization { get; set; } = null!;

    public int DoctorId { get; set; }

    public User Doctor { get; set; } = null!;

    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}