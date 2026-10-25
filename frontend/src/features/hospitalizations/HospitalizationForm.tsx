import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import type { Hospitalization } from '../../api/types';
import { api } from '../../api/endpoints';
import { hospitalCode, changedFields, clearingMessage } from '../../shared/format';
import { Button, Card, ErrorState, FormActions, Input, Modal, Select } from '../../shared/ui';
import { confirmDiscard, useUnsavedChanges } from '../../app/UnsavedChanges';
import {
  hospitalDefaults,
  hospitalInput,
  hospitalSchema,
  numberKeys,
  stringKeys,
  type HospitalValues,
} from './form';
import styles from './hospitalization.module.css';
export function HospitalizationForm({
  patientId,
  hospitalization,
  modal = false,
  onClose,
  onSaved,
}: {
  patientId: number;
  hospitalization?: Hospitalization;
  modal?: boolean;
  onClose?: () => void;
  onSaved: (saved: Hospitalization) => Promise<void>;
}) {
  const initial = hospitalDefaults(hospitalization);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<HospitalValues>({ resolver: zodResolver(hospitalSchema), defaultValues: initial });
  const markClean = useUnsavedChanges(isDirty);
  const [error, setRequestError] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);
  const values = watch();
  const close = () => {
    if (!isSubmitting && confirmDiscard(isDirty)) {
      markClean();
      onClose?.();
    }
  };
  const input = (name: keyof HospitalValues, label: string, numeric = false, type = 'text') => (
    <Input
      key={name}
      label={label}
      type={numeric ? 'number' : type}
      min={numeric ? (name.endsWith('Id') ? 1 : 0) : undefined}
      max={numeric ? 2147483647 : undefined}
      step={numeric ? 1 : undefined}
      error={errors[name]?.message}
      {...register(name)}
    />
  );
  const select = (name: keyof HospitalValues, label: string, options: [string, string][]) => (
    <Select label={label} error={errors[name]?.message} {...register(name)}>
      <option value="">Neuvedené</option>
      {values[name] && !options.some(([value]) => value === values[name]) && (
        <option value={values[name]}>{values[name]}</option>
      )}
      {options.map(([value, text]) => (
        <option value={value} key={value}>
          {text}
        </option>
      ))}
    </Select>
  );
  const form = (
    <form
      className="stack"
      onChange={() => setSuccess(false)}
      onSubmit={handleSubmit(async (submitted) => {
        setRequestError(null);
        setSuccess(false);
        if (hospitalization) {
          let invalid = false;
          for (const key of [...numberKeys, ...stringKeys])
            if (initial[key] !== '' && submitted[key] === '') {
              setError(key, { message: clearingMessage });
              invalid = true;
            }
          if (invalid) return;
        }
        const next = hospitalInput(submitted, patientId);
        const { patientId: _patientId, ...patch } = changedFields(
          hospitalInput(initial, patientId),
          next,
        );
        if (hospitalization && !Object.keys(patch).length) {
          reset(submitted);
          return;
        }
        try {
          const saved = hospitalization
            ? await api.updateHospitalization(hospitalization.id, patch)
            : await api.createHospitalization(next);
          reset(hospitalDefaults(saved));
          markClean();
          setSuccess(true);
          await onSaved(saved);
        } catch (e) {
          setRequestError(e);
        }
      })}
    >
      {error != null && <ErrorState error={error} />}
      {success && (
        <p className={styles.saved} role="status">
          Hospitalizácia bola uložená.
        </p>
      )}
      <fieldset disabled={isSubmitting} className={styles.fieldset}>
        <Card
          title={
            hospitalization
              ? `Hospitalizácia · ${hospitalCode(hospitalization.id)}`
              : 'Nová hospitalizácia'
          }
        >
          <div className={styles.grid3}>
            {input('admissionDate', 'Dátum prijatia', false, 'date')}
            {input('dischargeDate', 'Dátum prepustenia', false, 'date')}
            <Input
              label="Dĺžka pobytu (dni)"
              readOnly
              value={hospitalization?.timeInHospital ?? ''}
              placeholder="Vypočíta sa po uložení"
            />
          </div>
          <div className={`${styles.grid2} section-gap`}>
            {input('admissionTypeId', 'Typ prijatia · kód', true)}
            {input('dischargeDispositionId', 'Spôsob prepustenia · kód', true)}
          </div>
          <div className={`${styles.grid3} section-gap`}>
            {input('diag1', 'Hlavná diagnóza (ICD-9)')}
            {input('diag2', 'Ďalšia diagnóza (ICD-9)')}
            {input('diag3', 'Tretia diagnóza (ICD-9)')}
          </div>
        </Card>
        <Card title="Vyšetrenia a výkony">
          <div className={styles.grid2}>
            {select('a1CResult', 'HbA1c', [
              ['None', 'Nevykonané'],
              ['Norm', 'V norme'],
              ['>7', '> 7'],
              ['>8', '> 8'],
            ])}
            {select('maxGluSerum', 'Glykémia', [
              ['None', 'Nevykonané'],
              ['Norm', 'V norme'],
              ['>200', '> 200'],
              ['>300', '> 300'],
            ])}
            {input('numLabProcedures', 'Laboratórne výkony', true)}
            {input('numProcedures', 'Ostatné výkony', true)}
            {input('numMedications', 'Počet rôznych liekov', true)}
            {input('numberDiagnoses', 'Celkový počet diagnóz', true)}
          </div>
        </Card>
        <Card title="Návštevy za predchádzajúci rok">
          <div className={styles.grid3}>
            {input('numberOutpatient', 'Ambulantné', true)}
            {input('numberEmergency', 'Urgentné', true)}
            {input('numberInpatient', 'Hospitalizácie', true)}
          </div>
        </Card>
        <Card title="Diabetická liečba">
          <div className={styles.grid2}>
            {select('diabetesMed', 'Antidiabetická liečba', [
              ['Yes', 'Áno'],
              ['No', 'Nie'],
            ])}
            {select('change', 'Zmena liečby', [
              ['Ch', 'Áno'],
              ['No', 'Nie'],
            ])}
          </div>
        </Card>
      </fieldset>
      <FormActions>
        {modal && (
          <Button variant="secondary" type="button" onClick={close} disabled={isSubmitting}>
            Zrušiť
          </Button>
        )}
        <Button
          type="submit"
          className={modal ? '' : 'full-width'}
          busy={isSubmitting}
          disabled={!!hospitalization && !isDirty}
        >
          <Save size={18} />
          Uložiť hospitalizáciu
        </Button>
      </FormActions>
    </form>
  );
  return modal ? (
    <Modal title="Nová hospitalizácia" wide onClose={close}>
      {form}
    </Modal>
  ) : (
    form
  );
}
