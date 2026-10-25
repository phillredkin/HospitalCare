import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Save, UserRound } from 'lucide-react';
import { api } from '../../api/endpoints';
import { queries } from '../../api/queries';
import type { User } from '../../api/types';
import { ApiError } from '../../api/client';
import { changedFields } from '../../shared/format';
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  ErrorState,
  FormActions,
  Input,
  Loading,
  Modal,
  Pagination,
  Select,
  Table,
} from '../../shared/ui';
import { confirmDiscard, useUnsavedChanges } from '../../app/UnsavedChanges';
import { useAuth } from '../auth/AuthProvider';
import styles from './users.module.css';
const schema = z.object({
  name: z.string().trim().min(1, 'Zadajte meno.').max(150, 'Najviac 150 znakov.'),
  email: z.string().trim().email('Zadajte platný e-mail.').max(256, 'Najviac 256 znakov.'),
  password: z.string(),
  role: z.enum(['Admin', 'Doctor']),
  isActive: z.boolean(),
});
function UserForm({ user, onClose }: { user?: User; onClose: () => void }) {
  const client = useQueryClient();
  const auth = useAuth();
  const [error, setError] = useState<unknown>(null);
  const initial: z.infer<typeof schema> = {
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'Doctor',
    isActive: user?.isActive ?? true,
  };
  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: initial });
  const markClean = useUnsavedChanges(isDirty);
  const close = () => {
    if (!isSubmitting && confirmDiscard(isDirty)) {
      markClean();
      onClose();
    }
  };
  return (
    <Modal title={user ? 'Upraviť používateľa' : 'Nový používateľ'} onClose={close}>
      <form
        className="stack"
        onSubmit={handleSubmit(async (values) => {
          if (!user && (values.password.length < 8 || !values.password.trim())) {
            setFieldError('password', { message: 'Heslo musí obsahovať aspoň 8 znakov.' });
            return;
          }
          if (
            user &&
            (values.role !== user.role || (user.isActive && !values.isActive)) &&
            !window.confirm('Naozaj chcete zmeniť rolu alebo deaktivovať tento účet?')
          )
            return;
          setError(null);
          try {
            if (user) {
              const { password: _password, ...updated } = values;
              const { password: _initialPassword, ...original } = initial;
              const patch = changedFields(original, updated);
              if (Object.keys(patch).length) await api.updateUser(user.id, patch);
            } else {
              await api.createUser({
                name: values.name,
                email: values.email,
                password: values.password,
                role: values.role,
              });
            }
            reset(values);
            markClean();
            await client.invalidateQueries({ queryKey: ['users'] });
            if (user?.id === auth.user?.id) await auth.refresh();
            onClose();
          } catch (e) {
            if (e instanceof ApiError && e.status === 409)
              setFieldError('email', { message: 'Používateľ s týmto e-mailom už existuje.' });
            else setError(e);
          }
        })}
      >
        {error != null && <ErrorState error={error} />}
        <Input
          label="Meno"
          autoComplete="name"
          maxLength={150}
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          maxLength={256}
          error={errors.email?.message}
          {...register('email')}
        />
        {!user && (
          <Input
            label="Heslo"
            type="password"
            autoComplete="new-password"
            hint="Aspoň 8 znakov."
            error={errors.password?.message}
            {...register('password')}
          />
        )}
        <Select label="Rola" {...register('role')}>
          <option value="Doctor">Lekár</option>
          <option value="Admin">Administrátor</option>
        </Select>
        {user ? (
          <label className={styles.toggle}>
            <span>Aktívny účet</span>
            <input type="checkbox" role="switch" {...register('isActive')} />
            <span aria-hidden="true" />
          </label>
        ) : (
          <Alert tone="info">Nový účet bude aktívny. Aktivitu môžete neskôr zmeniť.</Alert>
        )}
        <FormActions>
          <Button variant="secondary" type="button" disabled={isSubmitting} onClick={close}>
            Zrušiť
          </Button>
          <Button type="submit" busy={isSubmitting}>
            <Save size={17} />
            Uložiť používateľa
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
export function UsersPage() {
  const users = useQuery(queries.users());
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [page, setPage] = useState(1);
  const currentPage = Math.min(page, Math.max(1, Math.ceil((users.data?.length ?? 0) / 8)));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className={styles.eyebrow}>ADMINISTRÁCIA</div>
          <h1>Používatelia</h1>
          <p>Správa účtov, rolí a aktivity.</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus size={20} />
          Nový používateľ
        </Button>
      </div>
      <Card>
        {users.isPending ? (
          <Loading />
        ) : users.isError ? (
          <ErrorState error={users.error} retry={() => void users.refetch()} />
        ) : !users.data.length ? (
          <Empty title="Zatiaľ žiadni používatelia." />
        ) : (
          <>
            <Table label="Zoznam používateľov">
              <thead>
                <tr>
                  <th>Používateľ</th>
                  <th>E-mail</th>
                  <th>Rola</th>
                  <th>Stav</th>
                  <th>Akcia</th>
                </tr>
              </thead>
              <tbody>
                {users.data.slice((currentPage - 1) * 8, currentPage * 8).map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="cell-title">
                        <span className="avatar">
                          <UserRound size={20} />
                        </span>
                        <strong>{user.name}</strong>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.role === 'Admin' ? 'Administrátor' : 'Lekár'}</td>
                    <td>
                      <Badge active={user.isActive}>
                        <span className={user.isActive ? styles.dot : styles.inactiveDot} />
                        {user.isActive ? 'Aktívny' : 'Neaktívny'}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        aria-label={`Upraviť ${user.name}`}
                        onClick={() => setEditing(user)}
                      >
                        <Pencil size={15} />
                        Upraviť
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={currentPage} total={users.data.length} onChange={setPage} />
            <p className="small muted">
              {users.data.length} používateľov · {users.data.filter((user) => user.isActive).length}{' '}
              aktívnych
            </p>
          </>
        )}
      </Card>
      {editing && (
        <UserForm user={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
