
namespace HospitalCare.Web.Dtos;

public class PatientResponseDto
{
    public int Id { get; set; }

    public string FirstName { get; set; } = string.Empty;

    public string LastName { get; set; } = string.Empty;

    public DateOnly? DateOfBirth { get; set; }

    public string Gender { get; set; } = string.Empty;

    public string DiabetesType { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}
