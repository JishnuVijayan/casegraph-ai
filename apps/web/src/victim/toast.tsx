import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type Toast = { id: number; text: string; tone: 'info' | 'error' | 'ok' };
type Notify = (text: string, tone?: Toast['tone']) => void;
const ToastContext = createContext<Notify>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const notify = useCallback<Notify>((text, tone = 'info') => {
    const id = next.current++;
    setToasts((all) => [...all.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), tone === 'error' ? 7000 : 4000);
  }, []);
  const value = useMemo(() => notify, [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="v-toasts" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => <div key={t.id} className={`v-toast v-toast--${t.tone}`}>{t.text}</div>)}
      </div>
    </ToastContext.Provider>
  );
}
