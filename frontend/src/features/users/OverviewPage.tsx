import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BedDouble, ShieldCheck, Stethoscope, UserRound, Users } from 'lucide-react';
import { queries } from '../../api/queries';
import { Card, ErrorState } from '../../shared/ui';
import styles from './users.module.css';
export function OverviewPage() {
  const patients = useQuery(queries.patients());
  const hospitalizations = useQuery(queries.hospitalizations());
  const users = useQuery(queries.users());
  const metrics = [
    {
      title: 'Pacienti',
      query: patients,
      count: patients.data?.length,
      icon: <Users size={29} />,
      detail: 'Evidovaní v systéme',
      link: '/patients',
    },
    {
      title: 'Hospitalizácie',
      query: hospitalizations,
      count: hospitalizations.data?.length,
      icon: <BedDouble size={29} />,
      detail: 'Všetky záznamy',
    },
    {
      title: 'Aktívni používatelia',
      query: users,
      count: users.data?.filter((user) => user.isActive).length,
      icon: <UserRound size={29} />,
      detail: 'Účty s povoleným prístupom',
      link: '/admin/users',
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className={styles.eyebrow}>ADMINISTRÁCIA</div>
          <h1>Prehľad systému</h1>
          <p>Základný prehľad evidencie a používateľských účtov.</p>
        </div>
        <span className={styles.overviewBadge}>
          <span className={styles.dot} />
          Prehľad evidencie
        </span>
      </div>
      <div className={styles.metrics}>
        {metrics.map(({ title, query, count, icon, detail, link }) => (
          <Card key={title} className={styles.metric}>
            <div className={styles.metricTop}>
              <span className={styles.metricIcon}>{icon}</span>
              {link && (
                <Link to={link} aria-label={`Otvoriť ${title.toLowerCase()}`}>
                  <ArrowUpRight size={19} />
                </Link>
              )}
            </div>
            <h2>{title}</h2>
            {query.isError ? (
              <ErrorState error={query.error} retry={() => void query.refetch()} />
            ) : (
              <strong aria-live="polite">{query.isPending ? '…' : count}</strong>
            )}
            <p>{detail}</p>
          </Card>
        ))}
      </div>
      <Card className={styles.management}>
        <div className={styles.managementHeading}>
          <div>
            <h2>Správa používateľov</h2>
            <p>Vytvárajte účty, nastavujte roly a spravujte prístup do systému.</p>
          </div>
          <Link className={styles.actionLink} to="/admin/users">
            <Users size={19} />
            Otvoriť používateľov
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className={styles.roles}>
          <div>
            <span>
              <ShieldCheck size={29} />
            </span>
            <div>
              <h3>Administrátor</h3>
              <p>Správa účtov, rolí a prístupu.</p>
            </div>
          </div>
          <div>
            <span>
              <Stethoscope size={29} />
            </span>
            <div>
              <h3>Lekár</h3>
              <p>Pacienti, hospitalizácie a plán starostlivosti.</p>
            </div>
          </div>
        </div>
      </Card>
      <div className={styles.quickLink}>
        <div>
          <h2>Pacienti a ich starostlivosť</h2>
          <p>Otvorte evidenciu pacientov a pokračujte v práci s klinickými záznamami.</p>
        </div>
        <Link to="/patients">
          Prejsť na pacientov
          <ArrowUpRight size={17} />
        </Link>
      </div>
    </>
  );
}
