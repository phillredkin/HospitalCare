
using System.ComponentModel.DataAnnotations;

namespace HospitalCare.Web.Dtos;

public class UpdateUserRequestDto
{
    [MaxLength(150)]
    public string? Name { get; set; }

    [EmailAddress]
    [MaxLength(256)]
    public string? Email { get; set; }

    public string? Role { get; set; }

    public bool? IsActive { get; set; }
}
