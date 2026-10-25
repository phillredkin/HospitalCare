import { useState } from 'react';
import { NavLink, Outlet, Navigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserRound,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  HeartPulse,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';
import { useLeaveConfirmation } from './UnsavedChanges';
import { Alert, Button, ErrorState, Loading } from '../shared/ui';
import { errorMessage } from '../api/client';
import styles from './layout.module.css';
export function Protected({ admin = false }: { admin?: boolean }) {
  const auth = useAuth();
  if (auth.loading) return <Loading label="Overujem prihlásenie…" />;
  if (auth.error && !auth.user)
    return (
      <div className={styles.standalone}>
        <ErrorState error={auth.error} retry={() => void auth.refresh().catch(() => {})} />
        <Link className="text-link" to="/login">
          Späť na prihlásenie
        </Link>
      </div>
    );
  if (!auth.user) return <Navigate to="/login" replace />;
  if (admin && auth.user.role !== 'Admin')
    return (
      <Alert>
        Na túto stránku nemáte oprávnenie. <Link to="/patients">Späť na pacientov</Link>
      </Alert>
    );
  return <Outlet />;
}
export function Layout() {
  const { user, logout } = useAuth();
  const confirmLeave = useLeaveConfirmation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className={styles.app}>
      <a className={styles.skip} href="#main">
        Preskočiť na obsah
      </a>
      <header className={styles.mobileHeader}>
        <Link to="/patients">
          <HeartPulse size={21} />
          HospitalCare
        </Link>
        <Button
          variant="quiet"
          aria-label={open ? 'Zavrieť menu' : 'Otvoriť menu'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </header>
      {open && (
        <button className={styles.scrim} aria-label="Zavrieť menu" onClick={() => setOpen(false)} />
      )}
      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
        <Link to={user?.role === 'Admin' ? '/admin/overview' : '/patients'} className={styles.logo}>
          HospitalCare<span>Riadenie hospitalizácií</span>
        </Link>
        <nav aria-label="Hlavná navigácia" onClick={() => setOpen(false)}>
          {user?.role === 'Admin' && (
            <NavLink
              to="/admin/overview"
              className={({ isActive }) => (isActive ? styles.active : '')}
            >
              <LayoutDashboard size={21} />
              Prehľad
            </NavLink>
          )}
          <NavLink to="/patients" className={({ isActive }) => (isActive ? styles.active : '')}>
            <UserRound size={21} />
            Pacienti
          </NavLink>
          {user?.role === 'Admin' && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) => (isActive ? styles.active : '')}
            >
              <Users size={21} />
              Používatelia
            </NavLink>
          )}
        </nav>
        <div className={styles.account}>
          <div>
            <span className={styles.accountIcon}>
              {user?.role === 'Admin' ? <ShieldCheck size={22} /> : <UserRound size={22} />}
            </span>
            <div>
              <strong>{user?.name}</strong>
            </div>
          </div>
          {error && <p role="alert">{error}</p>}
          <button
            disabled={busy}
            onClick={async () => {
              if (!confirmLeave()) return;
              setBusy(true);
              setError('');
              try {
                await logout();
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={18} />
            {busy ? 'Odhlasujem…' : 'Odhlásiť sa'}
          </button>
        </div>
      </aside>
      <div className={styles.workspace}>
        <div className={styles.topbar}>
          <span>
            <span className={styles.statusDot} />
            Nemocničný informačný systém
          </span>
        </div>
        <main id="main" className={styles.main}>
          <Outlet />
        </main>
        <footer className={styles.footer}>HospitalCare</footer>
      </div>
    </div>
  );
}
