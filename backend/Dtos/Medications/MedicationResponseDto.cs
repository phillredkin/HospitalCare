
namespace HospitalCare.Web.Dtos;

public class MedicationResponseDto
{
    public int Id { get; set; }

    public int HospitalizationId { get; set; }

    public string MedicationName { get; set; } = string.Empty;

    public string DoseStatus { get; set; } = string.Empty;
}
