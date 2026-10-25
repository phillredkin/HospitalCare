import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ChevronLeft, ChevronRight, LoaderCircle, X } from 'lucide-react';
import { ApiError, errorMessage } from '../api/client';
import styles from './ui.module.css';

export function Button({
  variant = 'primary',
  busy,
  children,
  className = '',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`${styles.button} ${styles[variant]} ${className}`}
    >
      {busy && <LoaderCircle className={styles.spin} size={17} />}
      {children}
    </button>
  );
}
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children(id, error || hint ? `${id}-help` : undefined)}
      {(error || hint) && (
        <small id={`${id}-help`} className={error ? styles.fieldError : styles.hint}>
          {error ?? hint}
        </small>
      )}
    </div>
  );
}
export function Input({
  label,
  error,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(id, describedBy) => (
        <input
          {...props}
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
        />
      )}
    </Field>
  );
}
export function Select({
  label,
  error,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  return (
    <Field label={label} error={error}>
      {(id, describedBy) => (
        <select
          {...props}
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
        >
          {children}
        </select>
      )}
    </Field>
  );
}
export function Alert({
  children,
  tone = 'error',
}: {
  children: ReactNode;
  tone?: 'error' | 'success' | 'info';
}) {
  return (
    <div className={`${styles.alert} ${styles[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      <AlertCircle size={19} />
      <div>{children}</div>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const labels: Record<string, string> = {
    Name: 'Meno',
    Email: 'E-mail',
    Password: 'Heslo',
    FirstName: 'Meno',
    LastName: 'Priezvisko',
    Gender: 'Pohlavie',
    DiabetesType: 'Typ diabetu',
    AdmissionDate: 'Dátum prijatia',
    DischargeDate: 'Dátum prepustenia',
    Content: 'Text poznámky',
    MedicationName: 'Názov lieku',
    DoseStatus: 'Stav dávky',
  };
  return (
    <Alert>
      {errorMessage(error)}
      {error instanceof ApiError && Object.keys(error.fields).length > 0 && (
        <ul>
          {Object.keys(error.fields).map((key) => (
            <li key={key}>{labels[key] ?? key}: skontrolujte zadanú hodnotu.</li>
          ))}
        </ul>
      )}
      {retry && (
        <button type="button" className={styles.retry} onClick={retry}>
          Skúsiť znova
        </button>
      )}
    </Alert>
  );
}
export function Loading({ label = 'Načítavam údaje…' }: { label?: string }) {
  return (
    <div className={styles.loading} role="status">
      <LoaderCircle className={styles.spin} size={24} />
      {label}
    </div>
  );
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <p>{title}</p>
      {children}
    </div>
  );
}
export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.card} ${className}`}>
      {title && (
        <div className={styles.cardTitle}>
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Badge({ children, active = true }: { children: ReactNode; active?: boolean }) {
  return <span className={`${styles.badge} ${!active ? styles.inactive : ''}`}>{children}</span>;
}
export function Table({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={label}>
      <table>{children}</table>
    </div>
  );
}
export function Pagination({
  page,
  total,
  size = 8,
  onChange,
}: {
  page: number;
  total: number;
  size?: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className={styles.pagination}>
      <span>
        Zobrazené {total ? (page - 1) * size + 1 : 0}–{Math.min(page * size, total)} z {total}
      </span>
      <div>
        <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={17} />
          Predchádzajúce
        </Button>
        <span aria-label="Strana">
          {page} / {pages}
        </span>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Nasledujúce
          <ChevronRight size={17} />
        </Button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ) ?? [],
      );
    (
      dialog.current?.querySelector<HTMLElement>('input, select, textarea') ?? dialog.current
    )?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === 'Tab') {
        const elements = focusables();
        const first = elements[0];
        const last = elements.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === dialog.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div className={styles.backdrop}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`${styles.modal} ${wide ? styles.wide : ''}`}
      >
        <div className={styles.modalHeading}>
          <h2 id={titleId}>{title}</h2>
          <Button aria-label="Zavrieť" variant="quiet" onClick={onClose}>
            <X size={22} />
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export function FormActions({ children }: { children: ReactNode }) {
  return <div className={styles.formActions}>{children}</div>;
}
