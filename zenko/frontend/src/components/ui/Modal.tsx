import { ReactNode, useEffect, useId, useRef } from 'react';
import Button from './Button';

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  description?: string;
  onBack?: () => void;
  backLabel?: string;
}

const focusableSelector =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const getFocusableElements = (container: HTMLElement) => {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden')
  );
};

export default function Modal({
  title,
  open,
  onClose,
  children,
  description = 'Preencha os campos para atualizar sua produtividade.',
  onBack,
  backLabel
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<Element | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const shouldCloseOnPointerUp = useRef(false);

  useEffect(() => {
    if (!open) {
      if (previouslyFocusedElement.current instanceof HTMLElement) {
        previouslyFocusedElement.current.focus();
        previouslyFocusedElement.current = null;
      }
      return;
    }

    previouslyFocusedElement.current = document.activeElement;

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const focusable = getFocusableElements(dialog);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialog.focus();
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (previouslyFocusedElement.current instanceof HTMLElement) {
        previouslyFocusedElement.current.focus();
        previouslyFocusedElement.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = getFocusableElements(dialog);

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (!dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const describedBy = description ? descriptionId : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 px-4 py-6 backdrop-blur-sm transition-colors dark:bg-slate-950/80 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          shouldCloseOnPointerUp.current = true;
        }
      }}
      onMouseUp={(event) => {
        if (shouldCloseOnPointerUp.current && event.target === event.currentTarget) {
          onClose();
        }
        shouldCloseOnPointerUp.current = false;
      }}
      onTouchStart={(event) => {
        if (event.target === event.currentTarget) {
          shouldCloseOnPointerUp.current = true;
        }
      }}
      onTouchEnd={(event) => {
        if (shouldCloseOnPointerUp.current && event.target === event.currentTarget) {
          onClose();
        }
        shouldCloseOnPointerUp.current = false;
      }}
      onTouchCancel={() => {
        shouldCloseOnPointerUp.current = false;
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.18)] backdrop-blur dark:border-white/10 dark:bg-slate-900/80 dark:shadow-[0_25px_60px_-15px_rgba(15,23,42,0.8)] sm:max-w-3xl lg:max-w-4xl"
      >
        <div className="flex max-h-[calc(100vh-4rem)] flex-col">
          <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-6">
            <div className="flex flex-1 items-start gap-3">
              {onBack ? (
                <Button
                  variant="ghost"
                  className="h-11 w-11 rounded-full border border-transparent text-slate-500 transition hover:border-slate-300 hover:text-slate-900 focus-visible:ring-zenko-primary/50 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
                  aria-label={backLabel ?? 'Voltar'}
                  onClick={onBack}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </Button>
              ) : null}
              <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
                {title}
              </h2>
            </div>
            <Button
              variant="ghost"
              className="text-2xl leading-none text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              aria-label="Fechar"
              onClick={onClose}
              title="Fechar"
            >
              ×
            </Button>
          </div>
          {description ? (
            <p id={descriptionId} className="px-6 text-xs text-slate-500 dark:text-slate-400">
              {description}
            </p>
          ) : null}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
