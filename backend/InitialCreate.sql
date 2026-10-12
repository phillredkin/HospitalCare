IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
CREATE TABLE [Patients] (
    [Id] int NOT NULL IDENTITY,
    [FirstName] nvarchar(100) NOT NULL,
    [LastName] nvarchar(100) NOT NULL,
    [DateOfBirth] date NULL,
    [Gender] nvarchar(30) NOT NULL,
    [DiabetesType] nvarchar(30) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_Patients] PRIMARY KEY ([Id])
);

CREATE TABLE [Users] (
    [Id] int NOT NULL IDENTITY,
    [Name] nvarchar(150) NOT NULL,
    [Email] nvarchar(256) NOT NULL,
    [PasswordHash] nvarchar(512) NOT NULL,
    [Role] nvarchar(20) NOT NULL,
    [IsActive] bit NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_Users] PRIMARY KEY ([Id])
);

CREATE TABLE [Hospitalizations] (
    [Id] int NOT NULL IDENTITY,
    [PatientId] int NOT NULL,
    [AdmissionDate] date NOT NULL,
    [DischargeDate] date NULL,
    [AdmissionTypeId] int NULL,
    [DischargeDispositionId] int NULL,
    [TimeInHospital] int NULL,
    [Diag1] nvarchar(20) NULL,
    [Diag2] nvarchar(20) NULL,
    [Diag3] nvarchar(20) NULL,
    [A1CResult] nvarchar(20) NULL,
    [MaxGluSerum] nvarchar(20) NULL,
    [NumLabProcedures] int NULL,
    [NumProcedures] int NULL,
    [NumMedications] int NULL,
    [NumberDiagnoses] int NULL,
    [NumberOutpatient] int NULL,
    [NumberEmergency] int NULL,
    [NumberInpatient] int NULL,
    [Change] nvarchar(10) NULL,
    [DiabetesMed] nvarchar(10) NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_Hospitalizations] PRIMARY KEY ([Id]),
    CONSTRAINT [CK_Hospitalizations_Counts] CHECK (([NumLabProcedures] IS NULL OR [NumLabProcedures] >= 0) AND ([NumProcedures] IS NULL OR [NumProcedures] >= 0) AND ([NumMedications] IS NULL OR [NumMedications] >= 0) AND ([NumberDiagnoses] IS NULL OR [NumberDiagnoses] >= 0) AND ([NumberOutpatient] IS NULL OR [NumberOutpatient] >= 0) AND ([NumberEmergency] IS NULL OR [NumberEmergency] >= 0) AND ([NumberInpatient] IS NULL OR [NumberInpatient] >= 0)),
    CONSTRAINT [CK_Hospitalizations_Dates] CHECK ([DischargeDate] IS NULL OR [DischargeDate] >= [AdmissionDate]),
    CONSTRAINT [CK_Hospitalizations_TimeInHospital] CHECK ([TimeInHospital] IS NULL OR [TimeInHospital] >= 0),
    CONSTRAINT [FK_Hospitalizations_Patients_PatientId] FOREIGN KEY ([PatientId]) REFERENCES [Patients] ([Id]) ON DELETE NO ACTION
);

CREATE TABLE [Sessions] (
    [Id] uniqueidentifier NOT NULL,
    [UserId] int NOT NULL,
    [TokenHash] nvarchar(128) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [LastActivityAt] datetime2 NOT NULL,
    [ExpiresAt] datetime2 NOT NULL,
    [RevokedAt] datetime2 NULL,
    CONSTRAINT [PK_Sessions] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Sessions_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [ClinicalNotes] (
    [Id] int NOT NULL IDENTITY,
    [HospitalizationId] int NOT NULL,
    [DoctorId] int NOT NULL,
    [Content] nvarchar(4000) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_ClinicalNotes] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_ClinicalNotes_Hospitalizations_HospitalizationId] FOREIGN KEY ([HospitalizationId]) REFERENCES [Hospitalizations] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_ClinicalNotes_Users_DoctorId] FOREIGN KEY ([DoctorId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
);

CREATE TABLE [Medications] (
    [Id] int NOT NULL IDENTITY,
    [HospitalizationId] int NOT NULL,
    [MedicationName] nvarchar(100) NOT NULL,
    [DoseStatus] nvarchar(20) NOT NULL,
    CONSTRAINT [PK_Medications] PRIMARY KEY ([Id]),
    CONSTRAINT [CK_Medications_DoseStatus] CHECK ([DoseStatus] IN ('No', 'Steady', 'Up', 'Down')),
    CONSTRAINT [FK_Medications_Hospitalizations_HospitalizationId] FOREIGN KEY ([HospitalizationId]) REFERENCES [Hospitalizations] ([Id]) ON DELETE NO ACTION
);

CREATE TABLE [PredictionLinks] (
    [Id] int NOT NULL IDENTITY,
    [HospitalizationId] int NOT NULL,
    [PredictionId] uniqueidentifier NOT NULL,
    [RequestId] uniqueidentifier NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_PredictionLinks] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_PredictionLinks_Hospitalizations_HospitalizationId] FOREIGN KEY ([HospitalizationId]) REFERENCES [Hospitalizations] ([Id]) ON DELETE NO ACTION
);

CREATE INDEX [IX_ClinicalNotes_DoctorId] ON [ClinicalNotes] ([DoctorId]);

CREATE INDEX [IX_ClinicalNotes_HospitalizationId] ON [ClinicalNotes] ([HospitalizationId]);

CREATE INDEX [IX_Hospitalizations_PatientId] ON [Hospitalizations] ([PatientId]);

CREATE UNIQUE INDEX [IX_Medications_HospitalizationId_MedicationName] ON [Medications] ([HospitalizationId], [MedicationName]);

CREATE INDEX [IX_PredictionLinks_HospitalizationId] ON [PredictionLinks] ([HospitalizationId]);

CREATE UNIQUE INDEX [IX_PredictionLinks_PredictionId] ON [PredictionLinks] ([PredictionId]);

CREATE UNIQUE INDEX [IX_PredictionLinks_RequestId] ON [PredictionLinks] ([RequestId]);

CREATE UNIQUE INDEX [IX_Sessions_TokenHash] ON [Sessions] ([TokenHash]);

CREATE INDEX [IX_Sessions_UserId] ON [Sessions] ([UserId]);

CREATE UNIQUE INDEX [IX_Users_Email] ON [Users] ([Email]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20261012181439_InitialCreate', N'10.0.4');

COMMIT;
GO

