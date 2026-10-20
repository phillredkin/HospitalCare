
namespace HospitalCare.Web.Dtos;

public class HospitalizationResponseDto
{
    public int Id { get; set; }

    public int PatientId { get; set; }

    public DateOnly AdmissionDate { get; set; }

    public DateOnly? DischargeDate { get; set; }

    public int? AdmissionTypeId { get; set; }

    public int? DischargeDispositionId { get; set; }

    public int? TimeInHospital { get; set; }

    public string? Diag1 { get; set; }

    public string? Diag2 { get; set; }

    public string? Diag3 { get; set; }

    public string? A1CResult { get; set; }

    public string? MaxGluSerum { get; set; }

    public int? NumLabProcedures { get; set; }

    public int? NumProcedures { get; set; }

    public int? NumMedications { get; set; }

    public int? NumberDiagnoses { get; set; }

    public int? NumberOutpatient { get; set; }

    public int? NumberEmergency { get; set; }

    public int? NumberInpatient { get; set; }

    public string? Change { get; set; }

    public string? DiabetesMed { get; set; }

    public DateTime CreatedAt { get; set; }
}
