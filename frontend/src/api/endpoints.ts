import { request } from './client';
import type {
  ClinicalNote,
  CreateUser,
  Hospitalization,
  HospitalizationInput,
  HospitalizationUpdate,
  Medication,
  MedicationInput,
  Patient,
  PatientInput,
  SessionUser,
  UpdateUser,
  User,
} from './types';
const json = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
export const api = {
  me: (signal?: AbortSignal) => request<SessionUser>('/auth/me', { signal }, true),
  login: (email: string, password: string) =>
    request<SessionUser>('/auth/login', json({ email, password }), true),
  logout: () => request<void>('/auth/logout', json({})),
  patients: (signal?: AbortSignal) => request<Patient[]>('/patients', { signal }),
  patient: (id: number, signal?: AbortSignal) => request<Patient>(`/patients/${id}`, { signal }),
  createPatient: (input: PatientInput) => request<Patient>('/patients', json(input)),
  updatePatient: (id: number, input: Partial<PatientInput>) =>
    request<Patient>(`/patients/${id}`, json(input, 'PATCH')),
  hospitalizations: (patientId?: number, signal?: AbortSignal) =>
    request<Hospitalization[]>(
      `/hospitalizations${patientId === undefined ? '' : `?patientId=${patientId}`}`,
      { signal },
    ),
  createHospitalization: (input: HospitalizationInput) =>
    request<Hospitalization>('/hospitalizations', json(input)),
  updateHospitalization: (id: number, input: HospitalizationUpdate) =>
    request<Hospitalization>(`/hospitalizations/${id}`, json(input, 'PATCH')),
  medications: (id: number, signal?: AbortSignal) =>
    request<Medication[]>(`/hospitalizations/${id}/medications`, { signal }),
  addMedication: (id: number, input: MedicationInput) =>
    request<Medication>(`/hospitalizations/${id}/medications`, json(input)),
  notes: (id: number, signal?: AbortSignal) =>
    request<ClinicalNote[]>(`/hospitalizations/${id}/clinical-notes`, { signal }),
  addNote: (id: number, content: string) =>
    request<ClinicalNote>(`/hospitalizations/${id}/clinical-notes`, json({ content })),
  users: (signal?: AbortSignal) => request<User[]>('/users', { signal }),
  createUser: (input: CreateUser) => request<User>('/users', json(input)),
  updateUser: (id: number, input: UpdateUser) =>
    request<User>(`/users/${id}`, json(input, 'PATCH')),
};
