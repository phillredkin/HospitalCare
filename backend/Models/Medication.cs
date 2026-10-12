
namespace HospitalCare.Web.Models;

public class Medication
{
    public int Id { get; set; }

    public int HospitalizationId { get; set; }

    public Hospitalization Hospitalization { get; set; } = null!;

    public string MedicationName { get; set; } = string.Empty;

    // No, Steady, Up, Down
    public string DoseStatus { get; set; } = string.Empty;
}
