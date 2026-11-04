import { useEffect, useState } from 'react';
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
  
  const [prediction, setPrediction] = useState<{
    hospitalizationId: number;
    probability: number;
    risk_level: string;
    top_factors: {
      field: string;
      label: string;
      value: string | number | null;
      impact: number;
    }[];
  } | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState('');

  const riskColors: Record<string, string> = {
    low: '#16a34a',
    medium: '#d97706',
    high: '#dc2626',
  };

  const history = [...(hospitalizations.data ?? [])].sort(
    (a, b) => b.admissionDate.localeCompare(a.admissionDate) || b.id - a.id,
  );
  const selectedId = params.get('hospitalizationId');
  const selected = selectedId ? history.find((item) => item.id === Number(selectedId)) : history[0];
  const selectedHospitalizationId = selected?.id;

  useEffect(() => {
    if (!selectedHospitalizationId) {
      setPrediction(null);
      setPredictionError('');
      return;
    }

    const controller = new AbortController();
    const hospitalizationId = selectedHospitalizationId;

    const loadLatestPrediction = async () => {
      setPrediction(null);
      setPredictionError('');

      try {
        const response = await fetch(`/api/predictions/hospitalizations/${hospitalizationId}/latest`, {
          credentials: 'same-origin',
          signal: controller.signal,
        });

        if (response.status === 404) return;

        if (!response.ok) {
          throw new Error(`Nepodarilo sa načítať predikciu (${response.status}).`);
        }

        const result = await response.json();

        if (!controller.signal.aborted) {
          setPrediction({
            hospitalizationId,
            probability: result.probability,
            risk_level: result.risk_level,
            top_factors: Array.isArray(result.top_factors) ? result.top_factors : [],
          });

          if (result.status === 'unsupported' || result.probability == null || result.risk_level == null) {
            setPrediction(null);
            setPredictionError(
              result.reasons?.map((reason: { message: string }) => reason.message).join(' ') ||
                'Predikciu nie je možné vypočítať pre zadané údaje.',
            );
            return;
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPredictionError(error instanceof Error ? error.message : 'Nepodarilo sa načítať predikciu.');
        }
      }
    };

    void loadLatestPrediction();

    return () => controller.abort();
  }, [selectedHospitalizationId]);

  const onSaved = async (_saved: Hospitalization) => {
    await client.invalidateQueries({ queryKey: ['hospitalizations'] });
  };

  
  const calculateRisk = async (hospitalizationId: number) => {
    if (predictionLoading) return;

    setPredictionLoading(true);
    setPredictionError('');

    try {
      const csrfResponse = await fetch('/api/auth/csrf', {
        credentials: 'same-origin',
      });

      if (!csrfResponse.ok) throw new Error('Nepodarilo sa získať CSRF token.');

      const { csrfToken } = await csrfResponse.json();

      const response = await fetch(`/api/predictions/hospitalizations/${hospitalizationId}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-CSRF-TOKEN': csrfToken,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message ?? `Chyba predikcie (${response.status}).`);
      }

      const result = await response.json();

      setPrediction({
        hospitalizationId,
        probability: result.probability,
        risk_level: result.risk_level,
        top_factors: Array.isArray(result.top_factors) ? result.top_factors : [],
      });

      if (result.status === 'unsupported' || result.probability == null || result.risk_level == null) {
        setPrediction(null);
        setPredictionError(
          result.reasons?.map((reason: { message: string }) => reason.message).join(' ') ||
            'Predikciu nie je možné vypočítať pre zadané údaje.',
        );
        return;
      }
    } catch (error) {
      setPredictionError(error instanceof Error ? error.message : 'Predikcia zlyhala.');
    } finally {
      setPredictionLoading(false);
    }
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

                {prediction && prediction.hospitalizationId === selected?.id ? (
                  <>
                    <strong style={{ fontSize: 30, color: riskColors[prediction.risk_level] ?? '#64748b' }}>
                      {(prediction.probability * 100).toFixed(1)} %
                    </strong>
                    <p style={{ color: riskColors[prediction.risk_level] ?? '#64748b', fontWeight: 600 }}>
                      {prediction.risk_level === 'low'
                        ? 'Nízke riziko'
                        : prediction.risk_level === 'medium'
                          ? 'Stredné riziko'
                          : prediction.risk_level === 'high'
                            ? 'Vysoké riziko'
                            : 'Neznáme riziko'}
                    </p>
                  </>
                ) : (
                  <>
                    <strong>Predikcia zatiaľ nebola vypočítaná</strong>
                    <p>Kliknutím na tlačidlo vypočítate riziko opätovnej hospitalizácie.</p>
                  </>
                )}

                {prediction && prediction.hospitalizationId === selected?.id && prediction.top_factors.length > 0 && (
                  <div style={{ width: '100%', textAlign: 'left', marginTop: 16, marginBottom: 16 }}>
                    <strong style={{ display: 'block', fontSize: 13, marginBottom: 12 }}>
                      Faktory ovplyvňujúce predikciu
                    </strong>

                    {prediction.top_factors.map((factor, index) => (
                      <div key={`${factor.field}-${index}`} style={{ padding: '10px 0', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <span style={{ fontSize: 13 }}>
                            {factor.field === 'discharge_disposition_id' ? 'Spôsob prepustenia' : factor.label}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: factor.impact > 0 ? '#dc2626' : '#16a34a' }}>
                            {factor.impact > 0 ? '+' : ''}{factor.impact.toFixed(4)}
                          </span>
                        </div>
                        <p className="small muted" style={{ marginTop: 4 }}>
                          Hodnota: {factor.value ?? 'Neuvedené'}
                        </p>
                      </div>
                    ))}

                    <p className="small muted" style={{ marginTop: 8 }}>
                      Faktory predstavujú vysvetlenie modelu, nie potvrdené príčiny opätovnej hospitalizácie.
                    </p>
                  </div>
                )}

                {predictionError && <p role="alert">{predictionError}</p>}

                <Button
                  disabled={!selected || predictionLoading}
                  className="full-width"
                  onClick={() => selected && void calculateRisk(selected.id)}
                >
                  <Calculator size={17} />
                  {predictionLoading ? 'Vypočítavam riziko...' : 'Prepočítať riziko'}
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
