
namespace HospitalCare.Web.Models;

public class PredictionLink
{
    public int Id { get; set; }

    public int HospitalizationId { get; set; }

    public Hospitalization Hospitalization { get; set; } = null!;

    public Guid PredictionId { get; set; }

    public Guid RequestId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
