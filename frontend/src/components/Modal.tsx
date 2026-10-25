import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  return (
    <dialog ref={dialog} className="modal" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="modal-header">
        <div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>
      </div>
      {children}
    </dialog>
  );
}
