import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, ChevronRight, ClipboardCheck, Pencil, Plus, UserRound } from 'lucide-react';
import { queries } from '../../api/queries';
import type { Hospitalization } from '../../api/types';
import { age, formatDate, hospitalCode, patientCode } from '../../shared/format';
import { Badge, Button, Card, Empty, ErrorState, Loading } from '../../shared/ui';
import { HospitalizationForm } from '../hospitalizations/HospitalizationForm';
import { ClinicalNotes } from '../notes/ClinicalNotes';
import { Medications } from '../medications/Medications';
import { PatientForm } from './PatientForm';
import styles from './patients.module.css';
export function PatientPage() {
  const { patientId: routeId } = useParams();
  const id = Number(routeId);
  if (!Number.isInteger(id) || id <= 0)
    return (
      <Empty title="Pacient sa nenašiel.">
        <Link className="text-link" to="/patients">
          Späť na pacientov
        </Link>
      </Empty>
    );
  return <PatientRecord key={id} id={id} />;
}
function PatientRecord({ id }: { id: number }) {
  const patient = useQuery(queries.patient(id));
  const hospitalizations = useQuery(queries.hospitalizations(id));
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const history = [...(hospitalizations.data ?? [])].sort(
    (a, b) => b.admissionDate.localeCompare(a.admissionDate) || b.id - a.id,
  );
  const selectedId = params.get('hospitalizationId');
  const selected = selectedId ? history.find((item) => item.id === Number(selectedId)) : history[0];
  const onSaved = async (_saved: Hospitalization) => {
    await client.invalidateQueries({ queryKey: ['hospitalizations'] });
  };
  if (patient.isPending) return <Loading />;
  if (patient.isError)
    return <ErrorState error={patient.error} retry={() => void patient.refetch()} />;
  const data = patient.data;
  return (
    <>
      <div className="breadcrumbs">
        <Link to="/patients">Pacienti</Link>
        <ChevronRight size={13} />
        <span>{patientCode(id)}</span>
      </div>
      <div className="page-heading">
        <div>
          <h1>Karta pacienta</h1>
          <p>Údaje, hospitalizácie a plán starostlivosti.</p>
        </div>
        <div className="inline-actions">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil size={17} />
            Upraviť pacienta
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus size={19} />
            Nová hospitalizácia
          </Button>
        </div>
      </div>
      <div className={styles.summary}>
        <div className={styles.identity}>
          <span className="avatar">
            <UserRound size={23} />
          </span>
          <div>
            <strong>
              {data.firstName} {data.lastName}
            </strong>
            <small>{patientCode(data.id)}</small>
          </div>
        </div>
        <div>
          <small>Vek</small>
          <strong>{age(data.dateOfBirth)}</strong>
        </div>
        <div>
          <small>Pohlavie</small>
          <strong>{data.gender}</strong>
        </div>
        <div>
          <small>Typ diabetu</small>
          <strong>{data.diabetesType}</strong>
        </div>
      </div>
      {hospitalizations.isPending ? (
        <Loading />
      ) : hospitalizations.isError ? (
        <ErrorState error={hospitalizations.error} retry={() => void hospitalizations.refetch()} />
      ) : (
        <div className={styles.recordGrid}>
          <div className="stack">
            {selected ? (
              <>
                <HospitalizationForm
                  key={selected.id}
                  patientId={id}
                  hospitalization={selected}
                  onSaved={onSaved}
                />
                <Medications key={`med-${selected.id}`} id={selected.id} />
              </>
            ) : selectedId ? (
              <Card>
                <Empty title="Vybraná hospitalizácia sa nenašla.">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.delete('hospitalizationId');
                      setParams(next);
                    }}
                  >
                    Zobraziť poslednú hospitalizáciu
                  </Button>
                </Empty>
              </Card>
            ) : (
              <Card>
                <Empty title="Pacient zatiaľ nemá žiadne hospitalizácie.">
                  <Button onClick={() => setCreating(true)}>
                    <Plus size={17} />
                    Vytvoriť hospitalizáciu
                  </Button>
                </Empty>
              </Card>
            )}
          </div>
          <aside className={styles.side}>
            <Card title="Riziko opätovnej hospitalizácie">
              <p className="small muted">Do 30 dní od prepustenia</p>
              <div className={styles.risk}>
                <span className={styles.riskIcon}>
                  <ClipboardCheck size={35} strokeWidth={1.3} />
                </span>
                <strong>Predikcia momentálne nie je dostupná</strong>
                <p>Výpočet rizika bude dostupný po pripojení predikčnej služby.</p>
                <Button
                  disabled
                  className="full-width"
                  title="Predikčná služba zatiaľ nie je pripojená"
                >
                  <Calculator size={17} />
                  Prepočítať riziko
                </Button>
              </div>
            </Card>
            <Card title="História hospitalizácií">
              {history.length ? (
                <div className={styles.history}>
                  {history.map((item) => (
                    <button
                      key={item.id}
                      className={item.id === selected?.id ? styles.selected : ''}
                      aria-pressed={item.id === selected?.id}
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.set('hospitalizationId', String(item.id));
                        setParams(next);
                      }}
                    >
                      <div>
                        <strong>{hospitalCode(item.id)}</strong>
                        <small>
                          {formatDate(item.admissionDate)} –{' '}
                          {item.dischargeDate ? formatDate(item.dischargeDate) : 'prebieha'}
                        </small>
                      </div>
                      <Badge active={!item.dischargeDate}>
                        {item.dischargeDate ? 'Ukončená' : 'Otvorená'}
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : (
                <Empty title="Zatiaľ bez hospitalizácií." />
              )}
            </Card>
            {selected && <ClinicalNotes key={`notes-${selected.id}`} id={selected.id} />}
          </aside>
        </div>
      )}
      {editing && (
        <PatientForm
          patient={data}
          suggestions={[data]}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            await client.invalidateQueries({ queryKey: ['patients'] });
            setEditing(false);
          }}
        />
      )}
      {creating && (
        <HospitalizationForm
          patientId={id}
          modal
          onClose={() => setCreating(false)}
          onSaved={async (saved) => {
            await onSaved(saved);
            setCreating(false);
            /* Unmount the saved modal before changing the selection. */ window.setTimeout(
              () => setParams({ hospitalizationId: String(saved.id) }),
              0,
            );
          }}
        />
      )}
    </>
  );
}
