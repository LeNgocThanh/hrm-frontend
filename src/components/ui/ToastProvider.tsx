'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';

type Toast = { id: string; message: string; type?: 'success'|'error'|'info' };
type Ctx = { push: (t: Omit<Toast, 'id'>) => void; };

const ToastCtx = createContext<Ctx>({ push: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setItems(prev => [...prev, { id, ...t }]);
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 3000);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {items.map(t => (
          <div key={t.id}
               className={`rounded-lg px-4 py-2 shadow text-white ${t.type==='error'?'bg-red-600':t.type==='success'?'bg-green-600':'bg-gray-800'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(){ return useContext(ToastCtx); }
