
namespace HospitalCare.Web.Models;

public class Hospitalization
{
    public int Id { get; set; }

    // Patient relationship
    public int PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    // Admission and discharge
    public DateOnly AdmissionDate { get; set; }
    public DateOnly? DischargeDate { get; set; }

    public int? AdmissionTypeId { get; set; }
    public int? DischargeDispositionId { get; set; }

    public int? TimeInHospital { get; set; }

    // Diagnoses (ICD-9)
    public string? Diag1 { get; set; }
    public string? Diag2 { get; set; }
    public string? Diag3 { get; set; }

    // Laboratory results
    public string? A1CResult { get; set; }
    public string? MaxGluSerum { get; set; }

    // Procedures
    public int? NumLabProcedures { get; set; }
    public int? NumProcedures { get; set; }
    public int? NumMedications { get; set; }
    public int? NumberDiagnoses { get; set; }

    // Previous-year visits
    public int? NumberOutpatient { get; set; }
    public int? NumberEmergency { get; set; }
    public int? NumberInpatient { get; set; }

    // Diabetes treatment
    public string? Change { get; set; }
    public string? DiabetesMed { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Relationships
    public ICollection<Medication> Medications { get; set; }
        = new List<Medication>();

    public ICollection<ClinicalNote> ClinicalNotes { get; set; }
        = new List<ClinicalNote>();

    public ICollection<PredictionLink> PredictionLinks { get; set; }
        = new List<PredictionLink>();
}
