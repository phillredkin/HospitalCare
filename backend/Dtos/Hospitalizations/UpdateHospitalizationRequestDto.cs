
using System.ComponentModel.DataAnnotations;

namespace HospitalCare.Web.Dtos;

public class UpdateHospitalizationRequestDto
{
    public DateOnly? AdmissionDate { get; set; }

    public DateOnly? DischargeDate { get; set; }

    [Range(1, int.MaxValue)]
    public int? AdmissionTypeId { get; set; }

    [Range(1, int.MaxValue)]
    public int? DischargeDispositionId { get; set; }

    [MaxLength(20)]
    public string? Diag1 { get; set; }

    [MaxLength(20)]
    public string? Diag2 { get; set; }

    [MaxLength(20)]
    public string? Diag3 { get; set; }

    [MaxLength(20)]
    public string? A1CResult { get; set; }

    [MaxLength(20)]
    public string? MaxGluSerum { get; set; }

    [Range(0, int.MaxValue)]
    public int? NumLabProcedures { get; set; }

    [Range(0, int.MaxValue)]
    public int? NumProcedures { get; set; }

    [Range(0, int.MaxValue)]
    public int? NumMedications { get; set; }

    [Range(0, int.MaxValue)]
    public int? NumberDiagnoses { get; set; }

    [Range(0, int.MaxValue)]
    public int? NumberOutpatient { get; set; }

    [Range(0, int.MaxValue)]
    public int? NumberEmergency { get; set; }

    [Range(0, int.MaxValue)]
    public int? NumberInpatient { get; set; }

    [MaxLength(10)]
    public string? Change { get; set; }

    [MaxLength(10)]
    public string? DiabetesMed { get; set; }
}
