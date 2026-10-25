import { queryOptions } from '@tanstack/react-query';
import { api } from './endpoints';
export const queries = {
  patients: () =>
    queryOptions({ queryKey: ['patients'], queryFn: ({ signal }) => api.patients(signal) }),
  patient: (id: number) =>
    queryOptions({ queryKey: ['patients', id], queryFn: ({ signal }) => api.patient(id, signal) }),
  hospitalizations: (patientId?: number) =>
    queryOptions({
      queryKey: ['hospitalizations', patientId ?? 'all'],
      queryFn: ({ signal }) => api.hospitalizations(patientId, signal),
    }),
  medications: (id: number) =>
    queryOptions({
      queryKey: ['medications', id],
      queryFn: ({ signal }) => api.medications(id, signal),
    }),
  notes: (id: number) =>
    queryOptions({ queryKey: ['notes', id], queryFn: ({ signal }) => api.notes(id, signal) }),
  users: () => queryOptions({ queryKey: ['users'], queryFn: ({ signal }) => api.users(signal) }),
};
