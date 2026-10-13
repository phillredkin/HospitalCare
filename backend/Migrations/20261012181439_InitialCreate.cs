using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HospitalCare.Web.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Patients",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FirstName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DateOfBirth = table.Column<DateOnly>(type: "date", nullable: true),
                    Gender = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    DiabetesType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Patients", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    Role = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Hospitalizations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PatientId = table.Column<int>(type: "int", nullable: false),
                    AdmissionDate = table.Column<DateOnly>(type: "date", nullable: false),
                    DischargeDate = table.Column<DateOnly>(type: "date", nullable: true),
                    AdmissionTypeId = table.Column<int>(type: "int", nullable: true),
                    DischargeDispositionId = table.Column<int>(type: "int", nullable: true),
                    TimeInHospital = table.Column<int>(type: "int", nullable: true),
                    Diag1 = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Diag2 = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Diag3 = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    A1CResult = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    MaxGluSerum = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    NumLabProcedures = table.Column<int>(type: "int", nullable: true),
                    NumProcedures = table.Column<int>(type: "int", nullable: true),
                    NumMedications = table.Column<int>(type: "int", nullable: true),
                    NumberDiagnoses = table.Column<int>(type: "int", nullable: true),
                    NumberOutpatient = table.Column<int>(type: "int", nullable: true),
                    NumberEmergency = table.Column<int>(type: "int", nullable: true),
                    NumberInpatient = table.Column<int>(type: "int", nullable: true),
                    Change = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    DiabetesMed = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Hospitalizations", x => x.Id);
                    table.CheckConstraint("CK_Hospitalizations_Counts", "([NumLabProcedures] IS NULL OR [NumLabProcedures] >= 0) AND ([NumProcedures] IS NULL OR [NumProcedures] >= 0) AND ([NumMedications] IS NULL OR [NumMedications] >= 0) AND ([NumberDiagnoses] IS NULL OR [NumberDiagnoses] >= 0) AND ([NumberOutpatient] IS NULL OR [NumberOutpatient] >= 0) AND ([NumberEmergency] IS NULL OR [NumberEmergency] >= 0) AND ([NumberInpatient] IS NULL OR [NumberInpatient] >= 0)");
                    table.CheckConstraint("CK_Hospitalizations_Dates", "[DischargeDate] IS NULL OR [DischargeDate] >= [AdmissionDate]");
                    table.CheckConstraint("CK_Hospitalizations_TimeInHospital", "[TimeInHospital] IS NULL OR [TimeInHospital] >= 0");
                    table.ForeignKey(
                        name: "FK_Hospitalizations_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastActivityAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sessions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClinicalNotes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    HospitalizationId = table.Column<int>(type: "int", nullable: false),
                    DoctorId = table.Column<int>(type: "int", nullable: false),
                    Content = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClinicalNotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClinicalNotes_Hospitalizations_HospitalizationId",
                        column: x => x.HospitalizationId,
                        principalTable: "Hospitalizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClinicalNotes_Users_DoctorId",
                        column: x => x.DoctorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Medications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    HospitalizationId = table.Column<int>(type: "int", nullable: false),
                    MedicationName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DoseStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Medications", x => x.Id);
                    table.CheckConstraint("CK_Medications_DoseStatus", "[DoseStatus] IN ('No', 'Steady', 'Up', 'Down')");
                    table.ForeignKey(
                        name: "FK_Medications_Hospitalizations_HospitalizationId",
                        column: x => x.HospitalizationId,
                        principalTable: "Hospitalizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PredictionLinks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    HospitalizationId = table.Column<int>(type: "int", nullable: false),
                    PredictionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PredictionLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PredictionLinks_Hospitalizations_HospitalizationId",
                        column: x => x.HospitalizationId,
                        principalTable: "Hospitalizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalNotes_DoctorId",
                table: "ClinicalNotes",
                column: "DoctorId");

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalNotes_HospitalizationId",
                table: "ClinicalNotes",
                column: "HospitalizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Hospitalizations_PatientId",
                table: "Hospitalizations",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_Medications_HospitalizationId_MedicationName",
                table: "Medications",
                columns: new[] { "HospitalizationId", "MedicationName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PredictionLinks_HospitalizationId",
                table: "PredictionLinks",
                column: "HospitalizationId");

            migrationBuilder.CreateIndex(
                name: "IX_PredictionLinks_PredictionId",
                table: "PredictionLinks",
                column: "PredictionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PredictionLinks_RequestId",
                table: "PredictionLinks",
                column: "RequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_TokenHash",
                table: "Sessions",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_UserId",
                table: "Sessions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClinicalNotes");

            migrationBuilder.DropTable(
                name: "Medications");

            migrationBuilder.DropTable(
                name: "PredictionLinks");

            migrationBuilder.DropTable(
                name: "Sessions");

            migrationBuilder.DropTable(
                name: "Hospitalizations");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Patients");
        }
    }
}
