export function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function formatDate(value: string | null | undefined) {
  if (!value) return 'Neuvedené';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}
export function age(value: string | null, today = localToday()) {
  if (!value) return 'Neuvedené';
  let years = Number(today.slice(0, 4)) - Number(value.slice(0, 4));
  if (today.slice(5) < value.slice(5)) years--;
  return `${years} r.`;
}
export function formatTimestamp(value: string) {
  const utcValue = /(?:Z|[+-]\d\d:\d\d)$/i.test(value) ? value : `${value}Z`;
  return new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(utcValue),
  );
}
export const patientCode = (id: number) => `P-${String(id).padStart(4, '0')}`;
export const hospitalCode = (id: number) => `H-${String(id).padStart(4, '0')}`;
export const doseLabels = {
  No: 'Nepodávaný',
  Steady: 'Bez zmeny dávky',
  Up: 'Dávka zvýšená',
  Down: 'Dávka znížená',
};
export function changedFields<T extends object>(initial: T, values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => value !== initial[key as keyof T]),
  ) as Partial<T>;
}
export const clearingMessage =
  'Uloženú hodnotu zatiaľ nemožno vymazať. Môžete ju nahradiť inou hodnotou.';
