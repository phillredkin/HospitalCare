export type Role = 'Admin' | 'Doctor';
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}
export interface User extends SessionUser {
  isActive: boolean;
  createdAt: string;
}
export interface CreateUser {
  name: string;
  email: string;
  password: string;
  role: Role;
}
export type UpdateUser = Partial<Omit<CreateUser, 'password'>> & { isActive?: boolean };
export interface PatientInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string;
  diabetesType: string;
}
export interface Patient extends PatientInput {
  id: number;
  createdAt: string;
}
export interface HospitalizationInput {
  patientId: number;
  admissionDate: string;
  dischargeDate: string | null;
  admissionTypeId: number | null;
  dischargeDispositionId: number | null;
  diag1: string | null;
  diag2: string | null;
  diag3: string | null;
  a1CResult: string | null;
  maxGluSerum: string | null;
  numLabProcedures: number | null;
  numProcedures: number | null;
  numMedications: number | null;
  numberDiagnoses: number | null;
  numberOutpatient: number | null;
  numberEmergency: number | null;
  numberInpatient: number | null;
  change: string | null;
  diabetesMed: string | null;
}
export interface Hospitalization extends HospitalizationInput {
  id: number;
  timeInHospital: number | null;
  createdAt: string;
}
export type HospitalizationUpdate = Partial<Omit<HospitalizationInput, 'patientId'>>;
export type DoseStatus = 'No' | 'Steady' | 'Up' | 'Down';
export interface MedicationInput {
  medicationName: string;
  doseStatus: DoseStatus;
}
export interface Medication extends MedicationInput {
  id: number;
  hospitalizationId: number;
}
export interface ClinicalNote {
  id: number;
  hospitalizationId: number;
  doctorId: number;
  content: string;
  createdAt: string;
}
