import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'secondary';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const baseClass =
  'inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-zenko-primary/60 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50';

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-zenko-primary via-zenko-secondary to-zenko-primary text-slate-950 shadow-lg shadow-zenko-secondary/20 hover:shadow-zenko-secondary/30',
  secondary:
    'border border-slate-200 bg-white/80 text-slate-900 shadow-sm backdrop-blur hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10',
  ghost: 'text-zenko-primary hover:text-zenko-secondary'
};

export default function Button({ className = '', variant = 'primary', ...props }: Props) {
  return <button className={`${baseClass} ${variantClasses[variant]} ${className}`} {...props} />;
}
