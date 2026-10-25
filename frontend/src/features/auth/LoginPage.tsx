import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Activity, Eye, EyeOff, HeartPulse, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { Alert, Button, ErrorState, Input, Loading } from '../../shared/ui';
import styles from './login.module.css';
const schema = z.object({
  email: z.string().trim().email('Zadajte platný e-mail.').max(256),
  password: z.string().min(1, 'Zadajte heslo.'),
});
export function LoginPage() {
  const auth = useAuth();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (auth.loading) return <Loading label="Overujem prihlásenie…" />;
  if (auth.user)
    return <Navigate to={auth.user.role === 'Admin' ? '/admin/overview' : '/patients'} replace />;
  return (
    <main className={styles.page}>
      <section className={styles.brand} aria-label="HospitalCare">
        <a className={styles.logo} href="/login">
          HospitalCare<span>Riadenie hospitalizácií</span>
        </a>
        <div className={styles.pitch}>
          <span className={styles.eyebrow}>STAROSTLIVOSŤ S PREHĽADOM</span>
          <h1>
            Pacienti.
            <br />
            Hospitalizácie.
            <br />
            <span>Lepšia starostlivosť.</span>
          </h1>
          <p>Všetky dôležité informácie o vašich pacientoch na jednom mieste.</p>
          <div className={styles.illustration} aria-hidden="true">
            <div className={styles.orbit} />
            <div className={styles.record}>
              <HeartPulse size={65} strokeWidth={1.3} />
              <div className={styles.recordLines}>
                <i />
                <i />
                <i />
              </div>
              <Activity size={100} strokeWidth={1} />
            </div>
          </div>
        </div>
      </section>
      <section className={styles.loginArea}>
        <div className={styles.loginCard}>
          <div className={styles.lock}>
            <LockKeyhole size={25} />
          </div>
          <h2>Vitajte späť</h2>
          <p>Prihláste sa do svojho účtu HospitalCare.</p>
          <form
            className="stack"
            onSubmit={handleSubmit(async (values) => {
              setError(null);
              try {
                await auth.login(values.email, values.password);
              } catch (e) {
                setError(e);
              }
            })}
          >
            {auth.expired && <Alert tone="info">Relácia vypršala. Prihláste sa znova.</Alert>}
            {(error ?? auth.error) != null && (
              <ErrorState
                error={error ?? auth.error}
                retry={() => {
                  setError(null);
                  auth.dismissError();
                  void auth.refresh().catch(() => {});
                }}
              />
            )}
            <Input
              label="E-mail"
              type="email"
              autoComplete="username"
              placeholder="meno@nemocnica.sk"
              error={errors.email?.message}
              {...register('email')}
            />
            <div className={styles.password}>
              <Input
                label="Heslo"
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Zadajte svoje heslo"
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                aria-label={visible ? 'Skryť heslo' : 'Zobraziť heslo'}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <Button type="submit" busy={isSubmitting} className="full-width">
              Prihlásiť sa
            </Button>
          </form>
          <div className={styles.access}>
            <ShieldCheck size={15} />
            Prístup pre lekárov a administrátorov
          </div>
        </div>
        <p className={styles.help}>Nemáte prístup? Obráťte sa na administrátora.</p>
      </section>
    </main>
  );
}
