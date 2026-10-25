import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Search, UserRound } from 'lucide-react';
import { queries } from '../../api/queries';
import { age, formatDate, patientCode } from '../../shared/format';
import { Button, Card, Empty, ErrorState, Loading, Pagination, Table } from '../../shared/ui';
import { PatientForm } from './PatientForm';
import styles from './patients.module.css';
export function PatientsPage() {
  const patients = useQuery(queries.patients());
  const hospitalizations = useQuery(queries.hospitalizations());
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const latest = useMemo(() => {
    const map = new Map<number, NonNullable<typeof hospitalizations.data>[number]>();
    for (const hospitalization of hospitalizations.data ?? []) {
      const previous = map.get(hospitalization.patientId);
      if (
        !previous ||
        hospitalization.admissionDate > previous.admissionDate ||
        (hospitalization.admissionDate === previous.admissionDate &&
          hospitalization.id > previous.id)
      )
        map.set(hospitalization.patientId, hospitalization);
    }
    return map;
  }, [hospitalizations.data]);
  const normalized = search.trim().toLocaleLowerCase('sk');
  const filtered = (patients.data ?? []).filter((patient) =>
    `${patient.id} ${patientCode(patient.id)} ${patient.firstName} ${patient.lastName} ${patient.lastName} ${patient.firstName}`
      .toLocaleLowerCase('sk')
      .includes(normalized),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 8)));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className={styles.eyebrow}>EVIDENCIA PACIENTOV</div>
          <h1>Pacienti</h1>
          <p>Zoznam pacientov a prístup ku klinickej karte.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus size={20} />
          Pridať pacienta
        </Button>
      </div>
      <div className={styles.search}>
        <Search size={20} />
        <label htmlFor="patient-search" className="sr-only">
          Vyhľadať pacienta
        </label>
        <input
          id="patient-search"
          type="search"
          placeholder="Vyhľadať podľa ID alebo mena"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <span>{filtered.length} pacientov</span>
      </div>
      {hospitalizations.isError && (
        <div className="section-gap">
          <ErrorState
            error={hospitalizations.error}
            retry={() => void hospitalizations.refetch()}
          />
        </div>
      )}
      <Card className={styles.list}>
        {patients.isPending ? (
          <Loading />
        ) : patients.isError ? (
          <ErrorState error={patients.error} retry={() => void patients.refetch()} />
        ) : !filtered.length ? (
          <Empty
            title={
              search
                ? 'Žiadny pacient nezodpovedá vyhľadávaniu.'
                : 'Zatiaľ nemáte žiadnych pacientov.'
            }
          >
            {!search && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={17} />
                Pridať prvého pacienta
              </Button>
            )}
          </Empty>
        ) : (
          <>
            <Table label="Zoznam pacientov">
              <thead>
                <tr>
                  <th>Pacient</th>
                  <th>Vek</th>
                  <th>Pohlavie</th>
                  <th>Typ diabetu</th>
                  <th>Posledná hospitalizácia</th>
                  <th>Akcia</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice((currentPage - 1) * 8, currentPage * 8).map((patient) => {
                  const hospitalization = latest.get(patient.id);
                  return (
                    <tr key={patient.id}>
                      <td>
                        <div className="cell-title">
                          <span className="avatar">
                            <UserRound size={20} />
                          </span>
                          <div>
                            <strong>
                              {patient.firstName} {patient.lastName}
                            </strong>
                            <small>{patientCode(patient.id)}</small>
                          </div>
                        </div>
                      </td>
                      <td>{age(patient.dateOfBirth)}</td>
                      <td>{patient.gender}</td>
                      <td>{patient.diabetesType}</td>
                      <td>
                        {hospitalizations.isError
                          ? 'Nedostupné'
                          : hospitalizations.isPending
                            ? 'Načítavam…'
                            : hospitalization
                              ? `${formatDate(hospitalization.admissionDate)} – ${hospitalization.dischargeDate ? formatDate(hospitalization.dischargeDate) : 'prebieha'}`
                              : 'Bez hospitalizácie'}
                      </td>
                      <td>
                        <Link className={styles.openRecord} to={`/patients/${patient.id}`}>
                          <FileText size={17} />
                          Otvoriť kartu
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination page={currentPage} total={filtered.length} onChange={setPage} />
          </>
        )}
      </Card>
      {creating && (
        <PatientForm
          suggestions={patients.data}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            await client.invalidateQueries({ queryKey: ['patients'] });
            setCreating(false);
          }}
        />
      )}
    </>
  );
}
