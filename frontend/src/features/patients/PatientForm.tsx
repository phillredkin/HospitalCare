import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save } from 'lucide-react';
import type { Patient } from '../../api/types';
import { api } from '../../api/endpoints';
import { changedFields, clearingMessage, localToday } from '../../shared/format';
import { Button, ErrorState, FormActions, Input, Modal } from '../../shared/ui';
import { confirmDiscard, useUnsavedChanges } from '../../app/UnsavedChanges';
const required = (max: number) =>
  z.string().trim().min(1, 'Toto pole je povinné.').max(max, `Najviac ${max} znakov.`);
const schema = z.object({
  firstName: required(100),
  lastName: required(100),
  gender: required(30),
  diabetesType: required(30),
  dateOfBirth: z
    .string()
    .refine((value) => !value || value <= localToday(), 'Dátum narodenia nemôže byť v budúcnosti.'),
});
type Values = z.infer<typeof schema>;
export function PatientForm({
  patient,
  suggestions = [],
  onClose,
  onSaved,
}: {
  patient?: Patient;
  suggestions?: Patient[];
  onClose: () => void;
  onSaved: (patient: Patient) => Promise<void>;
}) {
  const initial: Values = {
    firstName: patient?.firstName ?? '',
    lastName: patient?.lastName ?? '',
    gender: patient?.gender ?? '',
    diabetesType: patient?.diabetesType ?? '',
    dateOfBirth: patient?.dateOfBirth ?? '',
  };
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const [error, setRequestError] = useState<unknown>(null);
  useUnsavedChanges(isDirty);
  const close = () => {
    if (!isSubmitting && confirmDiscard(isDirty)) onClose();
  };
  return (
    <Modal title={patient ? 'Upraviť pacienta' : 'Nový pacient'} onClose={close}>
      <form
        onSubmit={handleSubmit(async (values) => {
          if (patient?.dateOfBirth && !values.dateOfBirth) {
            setError('dateOfBirth', { message: clearingMessage });
            return;
          }
          const input = { ...values, dateOfBirth: values.dateOfBirth || null };
          const original = { ...initial, dateOfBirth: initial.dateOfBirth || null };
          const patch = changedFields(original, input);
          if (patient && !Object.keys(patch).length) {
            onClose();
            return;
          }
          setRequestError(null);
          try {
            const saved = patient
              ? await api.updatePatient(patient.id, patch)
              : await api.createPatient(input);
            reset(values);
            await onSaved(saved);
          } catch (e) {
            setRequestError(e);
          }
        })}
        className="stack"
      >
        {error != null && <ErrorState error={error} />}
        <div className="form-grid">
          <Input
            label="Meno"
            autoComplete="given-name"
            maxLength={100}
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <Input
            label="Priezvisko"
            autoComplete="family-name"
            maxLength={100}
            error={errors.lastName?.message}
            {...register('lastName')}
          />
          <Input
            label="Dátum narodenia"
            type="date"
            max={localToday()}
            error={errors.dateOfBirth?.message}
            {...register('dateOfBirth')}
          />
          <Input
            label="Pohlavie"
            list="patient-genders"
            maxLength={30}
            error={errors.gender?.message}
            {...register('gender')}
          />
          <Input
            label="Typ diabetu"
            list="patient-diabetes"
            maxLength={30}
            error={errors.diabetesType?.message}
            {...register('diabetesType')}
          />
        </div>
        <datalist id="patient-genders">
          {Array.from(new Set(suggestions.map((item) => item.gender))).map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
        <datalist id="patient-diabetes">
          {Array.from(new Set(suggestions.map((item) => item.diabetesType))).map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
        <p className="muted small">
          Údaje slúžia na evidenciu pacienta. Polia bez dátumu narodenia sú povinné.
        </p>
        <FormActions>
          <Button variant="secondary" type="button" onClick={close} disabled={isSubmitting}>
            Zrušiť
          </Button>
          <Button type="submit" busy={isSubmitting}>
            <Save size={17} />
            Uložiť pacienta
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
