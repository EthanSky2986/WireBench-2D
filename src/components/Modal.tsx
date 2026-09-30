import { useLayoutEffect, useRef, type ReactNode } from 'react';

export interface ModalProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/** Native modality keeps background controls inert, including in fullscreen. */
export default function Modal({ label, onClose, children }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = element.ownerDocument.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="modal-backdrop"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        // Consume Escape before the document-level fullscreen shortcut.
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onPointerDown={(event) => {
        backdropPress.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (backdropPress.current && event.target === event.currentTarget) onClose();
        backdropPress.current = false;
      }}
    >
      {children}
    </dialog>
  );
}
