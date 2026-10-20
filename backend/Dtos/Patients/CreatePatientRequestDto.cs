
using System.ComponentModel.DataAnnotations;

namespace HospitalCare.Web.Dtos;

public class CreatePatientRequestDto
{
    [Required]
    [MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    public DateOnly? DateOfBirth { get; set; }

    [Required]
    [MaxLength(30)]
    public string Gender { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    public string DiabetesType { get; set; } = string.Empty;
}
