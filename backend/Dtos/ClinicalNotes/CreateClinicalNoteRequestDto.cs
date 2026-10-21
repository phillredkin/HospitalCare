
using System.ComponentModel.DataAnnotations;

namespace HospitalCare.Web.Dtos;

public class CreateClinicalNoteRequestDto
{
    [Required]
    [StringLength(4000, MinimumLength = 1)]
    public string Content { get; set; } = string.Empty;
}
