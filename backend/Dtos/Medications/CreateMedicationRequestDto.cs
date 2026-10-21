
using System.ComponentModel.DataAnnotations;

namespace HospitalCare.Web.Dtos;

public class CreateMedicationRequestDto
{
    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string MedicationName { get; set; } = string.Empty;

    [Required]
    [StringLength(20, MinimumLength = 1)]
    public string DoseStatus { get; set; } = string.Empty;
}
