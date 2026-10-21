
using System.ComponentModel.DataAnnotations;

namespace HospitalCare.Web.Dtos;

public class UpdatePatientRequestDto
{
    [MaxLength(100)]
    public string? FirstName { get; set; }

    [MaxLength(100)]
    public string? LastName { get; set; }

    public DateOnly? DateOfBirth { get; set; }

    [MaxLength(30)]
    public string? Gender { get; set; }

    [MaxLength(30)]
    public string? DiabetesType { get; set; }
}
