import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'secondary';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  isLoading?: boolean;
}

const baseClass =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50';

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-zenko-primary via-zenko-secondary to-zenko-primary text-white shadow-lg shadow-zenko-secondary/20 hover:shadow-zenko-secondary/30',
  secondary:
    'border border-slate-200 bg-white/80 text-slate-900 shadow-sm backdrop-blur hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10',
  ghost: 'text-zenko-primary hover:text-zenko-secondary'
};

export default function Button({ className = '', variant = 'primary', isLoading = false, disabled, children, ...props }: Props) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      className={`${baseClass} ${variantClasses[variant]} ${className}`}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && (
        <>
          <svg
            className="mr-2 h-4 w-4 animate-spin text-current"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="status"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              d="M4 12a8 8 0 018-8"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
          <span className="sr-only">Carregando...</span>
        </>
      )}
      <span className="inline-flex items-center gap-1">{children}</span>
    </button>
  );
}
