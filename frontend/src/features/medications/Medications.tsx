import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Save } from 'lucide-react';
import { api } from '../../api/endpoints';
import { queries } from '../../api/queries';
import { doseLabels } from '../../shared/format';
import {
  Button,
  Card,
  Empty,
  ErrorState,
  FormActions,
  Input,
  Loading,
  Modal,
  Select,
  Table,
} from '../../shared/ui';
import { confirmDiscard, useUnsavedChanges } from '../../app/UnsavedChanges';
const schema = z.object({
  medicationName: z.string().trim().min(1, 'Zadajte názov lieku.').max(100, 'Najviac 100 znakov.'),
  doseStatus: z.enum(['No', 'Steady', 'Up', 'Down']),
});
function MedicationForm({ id, onClose }: { id: number; onClose: () => void }) {
  const client = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { medicationName: '', doseStatus: 'Steady' },
  });
  const markClean = useUnsavedChanges(isDirty);
  const close = () => {
    if (!isSubmitting && confirmDiscard(isDirty)) {
      markClean();
      onClose();
    }
  };
  return (
    <Modal title="Pridať liek" onClose={close}>
      <form
        className="stack"
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          try {
            await api.addMedication(id, values);
            reset(values);
            markClean();
            await client.invalidateQueries({ queryKey: ['medications', id] });
            onClose();
          } catch (e) {
            setError(e);
          }
        })}
      >
        {error != null && <ErrorState error={error} />}
        <Input
          label="Názov lieku"
          maxLength={100}
          placeholder="Napr. metformin"
          error={errors.medicationName?.message}
          {...register('medicationName')}
        />
        <Select label="Stav dávky" {...register('doseStatus')}>
          {Object.entries(doseLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <FormActions>
          <Button type="button" variant="secondary" onClick={close} disabled={isSubmitting}>
            Zrušiť
          </Button>
          <Button type="submit" busy={isSubmitting}>
            <Save size={16} />
            Pridať liek
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
export function Medications({ id }: { id: number }) {
  const query = useQuery(queries.medications(id));
  const [creating, setCreating] = useState(false);
  return (
    <Card
      title="Antidiabetická liečba"
      action={
        <Button variant="secondary" onClick={() => setCreating(true)}>
          <Plus size={16} />
          Pridať liek
        </Button>
      }
    >
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.length ? (
        <Table label="Lieky počas hospitalizácie">
          <thead>
            <tr>
              <th>Liek</th>
              <th>Stav dávky</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((item) => (
              <tr key={item.id}>
                <td>{item.medicationName}</td>
                <td>{doseLabels[item.doseStatus] ?? item.doseStatus}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty title="K tejto hospitalizácii zatiaľ nie sú pridané lieky." />
      )}
      {creating && <MedicationForm id={id} onClose={() => setCreating(false)} />}
    </Card>
  );
}
