import { z } from 'zod';
import type { Hospitalization, HospitalizationInput } from '../../api/types';
export const numberKeys = [
  'admissionTypeId',
  'dischargeDispositionId',
  'numLabProcedures',
  'numProcedures',
  'numMedications',
  'numberDiagnoses',
  'numberOutpatient',
  'numberEmergency',
  'numberInpatient',
] as const;
export const stringKeys = [
  'dischargeDate',
  'diag1',
  'diag2',
  'diag3',
  'a1CResult',
  'maxGluSerum',
  'change',
  'diabetesMed',
] as const;
const number = (min = 0) =>
  z
    .string()
    .refine(
      (value) =>
        value === '' ||
        (/^\d+$/.test(value) && Number(value) >= min && Number(value) <= 2147483647),
      `Zadajte celé číslo od ${min} do 2147483647.`,
    );
const shortText = z.string().trim().max(20, 'Najviac 20 znakov.');
export const hospitalSchema = z
  .object({
    admissionDate: z.string().min(1, 'Dátum prijatia je povinný.'),
    dischargeDate: z.string(),
    admissionTypeId: number(1),
    dischargeDispositionId: number(1),
    diag1: shortText,
    diag2: shortText,
    diag3: shortText,
    a1CResult: shortText,
    maxGluSerum: shortText,
    numLabProcedures: number(),
    numProcedures: number(),
    numMedications: number(),
    numberDiagnoses: number(),
    numberOutpatient: number(),
    numberEmergency: number(),
    numberInpatient: number(),
    change: z.string().trim().max(10, 'Najviac 10 znakov.'),
    diabetesMed: z.string().trim().max(10, 'Najviac 10 znakov.'),
  })
  .refine((values) => !values.dischargeDate || values.dischargeDate >= values.admissionDate, {
    path: ['dischargeDate'],
    message: 'Dátum prepustenia nemôže byť pred prijatím.',
  });
export type HospitalValues = z.infer<typeof hospitalSchema>;
export function hospitalDefaults(hospitalization?: Hospitalization): HospitalValues {
  const values = { admissionDate: hospitalization?.admissionDate ?? '' } as HospitalValues;
  for (const key of [...numberKeys, ...stringKeys])
    values[key] = hospitalization?.[key]?.toString() ?? '';
  return values;
}
export function hospitalInput(values: HospitalValues, patientId: number): HospitalizationInput {
  const result = { patientId, admissionDate: values.admissionDate } as HospitalizationInput;
  for (const key of numberKeys) result[key] = values[key] === '' ? null : Number(values[key]);
  for (const key of stringKeys) result[key] = values[key] || null;
  return result;
}
