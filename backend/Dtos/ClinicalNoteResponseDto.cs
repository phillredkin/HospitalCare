
namespace HospitalCare.Web.Dtos;

public class ClinicalNoteResponseDto
{
    public int Id { get; set; }

    public int HospitalizationId { get; set; }

    public int DoctorId { get; set; }

    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}
