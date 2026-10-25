import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../../api/endpoints';
import { queries } from '../../api/queries';
import { useUnsavedChanges } from '../../app/UnsavedChanges';
import { formatTimestamp } from '../../shared/format';
import { Button, Card, Empty, ErrorState, Field, Loading } from '../../shared/ui';
import styles from '../hospitalizations/hospitalization.module.css';
const schema = z.object({
  content: z.string().trim().min(1, 'Zadajte text poznámky.').max(4000, 'Najviac 4000 znakov.'),
});
export function ClinicalNotes({ id }: { id: number }) {
  const query = useQuery(queries.notes(id));
  const client = useQueryClient();
  const { user } = useAuth();
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { content: '' },
  });
  useUnsavedChanges(isDirty);
  return (
    <Card title="Poznámka a plán lekára">
      <form
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          setSuccess(false);
          try {
            await api.addNote(id, values.content);
            reset({ content: '' });
            setSuccess(true);
            await client.invalidateQueries({ queryKey: ['notes', id] });
          } catch (e) {
            setError(e);
          }
        })}
      >
        <Field label="Nová klinická poznámka" error={errors.content?.message}>
          {(fieldId, describedBy) => (
            <textarea
              id={fieldId}
              aria-describedby={describedBy}
              aria-invalid={!!errors.content || undefined}
              maxLength={4000}
              placeholder="Zapíšte posúdenie a ďalší postup…"
              disabled={isSubmitting}
              {...register('content', { onChange: () => setSuccess(false) })}
            />
          )}
        </Field>
        <p className={styles.counter}>{watch('content').length} / 4 000</p>
        {error != null && (
          <div className="section-gap">
            <ErrorState error={error} />
          </div>
        )}
        {success && (
          <p className={styles.saved} role="status">
            Poznámka bola uložená.
          </p>
        )}
        <Button className="section-gap" type="submit" busy={isSubmitting}>
          <Save size={17} />
          Uložiť poznámku
        </Button>
      </form>
      <div className={styles.notes}>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : !query.data.length ? (
          <Empty title="Zatiaľ žiadne poznámky." />
        ) : (
          query.data.map((note) => (
            <article key={note.id} className={styles.note}>
              <div>
                <strong>
                  {note.doctorId === user?.id ? user.name : `Lekár #${note.doctorId}`}
                </strong>
                <time dateTime={note.createdAt}>{formatTimestamp(note.createdAt)}</time>
              </div>
              <p>{note.content}</p>
            </article>
          ))
        )}
      </div>
    </Card>
  );
}
