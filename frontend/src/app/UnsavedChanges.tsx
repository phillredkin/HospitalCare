import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react';
import { useBlocker } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
const message = 'Máte neuložené zmeny. Naozaj chcete odísť bez uloženia?';
const Context = createContext<{
  setDirty: (id: string, dirty: boolean) => void;
  confirmLeave: () => boolean;
}>({ setDirty: () => {}, confirmLeave: () => true });
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [owners, setOwners] = useState<Set<string>>(() => new Set());
  // Expired sessions must leave protected pages even when a draft was open.
  const dirty = owners.size > 0 && user !== null;
  const setDirty = useCallback(
    (id: string, value: boolean) =>
      setOwners((previous) => {
        if (previous.has(id) === value) return previous;
        const next = new Set(previous);
        if (value) next.add(id);
        else next.delete(id);
        return next;
      }),
    [],
  );
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      `${currentLocation.pathname}${currentLocation.search}` !==
        `${nextLocation.pathname}${nextLocation.search}`,
  );
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(message)) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const listener = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [dirty]);
  return (
    <Context.Provider value={{ setDirty, confirmLeave: () => !dirty || window.confirm(message) }}>
      {children}
    </Context.Provider>
  );
}
export function useUnsavedChanges(dirty: boolean) {
  const id = useId();
  const { setDirty } = useContext(Context);
  useEffect(() => {
    setDirty(id, dirty);
    return () => setDirty(id, false);
  }, [id, dirty, setDirty]);
  return () => setDirty(id, false);
}
export const useLeaveConfirmation = () => useContext(Context).confirmLeave;
export function confirmDiscard(dirty: boolean) {
  return !dirty || window.confirm(message);
}
