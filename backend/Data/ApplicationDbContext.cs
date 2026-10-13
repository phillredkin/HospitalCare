
using HospitalCare.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace HospitalCare.Web.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options
    ) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<UserSession> Sessions => Set<UserSession>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<Hospitalization> Hospitalizations => Set<Hospitalization>();
    public DbSet<Medication> Medications => Set<Medication>();
    public DbSet<ClinicalNote> ClinicalNotes => Set<ClinicalNote>();
    public DbSet<PredictionLink> PredictionLinks => Set<PredictionLink>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // =========================
        // USERS
        // =========================
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.Id);

            entity.HasIndex(u => u.Email)
                .IsUnique();

            entity.Property(u => u.Name)
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(u => u.Email)
                .HasMaxLength(256)
                .IsRequired();

            entity.Property(u => u.PasswordHash)
                .HasMaxLength(512)
                .IsRequired();

            entity.Property(u => u.Role)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();
        });

        // =========================
        // USER SESSIONS
        // =========================
        modelBuilder.Entity<UserSession>(entity =>
        {
            entity.HasKey(s => s.Id);

            entity.HasIndex(s => s.TokenHash)
                .IsUnique();

            entity.Property(s => s.TokenHash)
                .HasMaxLength(128)
                .IsRequired();

            entity.HasOne(s => s.User)
                .WithMany(u => u.Sessions)
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // =========================
        // PATIENTS
        // =========================
        modelBuilder.Entity<Patient>(entity =>
        {
            entity.HasKey(p => p.Id);

            entity.Property(p => p.FirstName)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(p => p.LastName)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(p => p.Gender)
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(p => p.DiabetesType)
                .HasMaxLength(30)
                .IsRequired();
        });

        // =========================
        // HOSPITALIZATIONS
        // =========================
        modelBuilder.Entity<Hospitalization>(entity =>
        {
            entity.HasKey(h => h.Id);

            entity.HasOne(h => h.Patient)
                .WithMany(p => p.Hospitalizations)
                .HasForeignKey(h => h.PatientId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.Property(h => h.Diag1).HasMaxLength(20);
            entity.Property(h => h.Diag2).HasMaxLength(20);
            entity.Property(h => h.Diag3).HasMaxLength(20);

            entity.Property(h => h.A1CResult).HasMaxLength(20);
            entity.Property(h => h.MaxGluSerum).HasMaxLength(20);
            entity.Property(h => h.Change).HasMaxLength(10);
            entity.Property(h => h.DiabetesMed).HasMaxLength(10);

            entity.ToTable(t =>
            {
                t.HasCheckConstraint(
                    "CK_Hospitalizations_Dates",
                    "[DischargeDate] IS NULL OR " +
                    "[DischargeDate] >= [AdmissionDate]");

                t.HasCheckConstraint(
                    "CK_Hospitalizations_TimeInHospital",
                    "[TimeInHospital] IS NULL OR [TimeInHospital] >= 0");

                t.HasCheckConstraint(
                    "CK_Hospitalizations_Counts",
                    "([NumLabProcedures] IS NULL OR [NumLabProcedures] >= 0) AND " +
                    "([NumProcedures] IS NULL OR [NumProcedures] >= 0) AND " +
                    "([NumMedications] IS NULL OR [NumMedications] >= 0) AND " +
                    "([NumberDiagnoses] IS NULL OR [NumberDiagnoses] >= 0) AND " +
                    "([NumberOutpatient] IS NULL OR [NumberOutpatient] >= 0) AND " +
                    "([NumberEmergency] IS NULL OR [NumberEmergency] >= 0) AND " +
                    "([NumberInpatient] IS NULL OR [NumberInpatient] >= 0)");
            });
        });

        // =========================
        // MEDICATIONS
        // =========================
        modelBuilder.Entity<Medication>(entity =>
        {
            entity.HasKey(m => m.Id);

            entity.HasOne(m => m.Hospitalization)
                .WithMany(h => h.Medications)
                .HasForeignKey(m => m.HospitalizationId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.Property(m => m.MedicationName)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(m => m.DoseStatus)
                .HasMaxLength(20)
                .IsRequired();

            entity.HasIndex(m => new
            {
                m.HospitalizationId,
                m.MedicationName
            }).IsUnique();

            entity.ToTable(t =>
            {
                t.HasCheckConstraint(
                    "CK_Medications_DoseStatus",
                    "[DoseStatus] IN ('No', 'Steady', 'Up', 'Down')");
            });
        });

        // =========================
        // CLINICAL NOTES
        // =========================
        modelBuilder.Entity<ClinicalNote>(entity =>
        {
            entity.HasKey(n => n.Id);

            entity.HasOne(n => n.Hospitalization)
                .WithMany(h => h.ClinicalNotes)
                .HasForeignKey(n => n.HospitalizationId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(n => n.Doctor)
                .WithMany()
                .HasForeignKey(n => n.DoctorId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.Property(n => n.Content)
                .HasMaxLength(4000)
                .IsRequired();
        });


        // =========================
        // PREDICTION LINKS
        // =========================
        modelBuilder.Entity<PredictionLink>(entity =>
        {
            entity.HasKey(p => p.Id);

            entity.HasOne(p => p.Hospitalization)
                .WithMany(h => h.PredictionLinks)
                .HasForeignKey(p => p.HospitalizationId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(p => p.PredictionId)
                .IsUnique();

            entity.HasIndex(p => p.RequestId)
                .IsUnique();
        });
    }
}
