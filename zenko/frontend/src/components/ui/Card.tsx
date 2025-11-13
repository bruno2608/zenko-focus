import { HTMLAttributes, ReactNode, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'board';
}

const baseStyles: Record<NonNullable<CardProps['variant']>, string> = {
  default:
    'min-w-0 rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-[0_20px_45px_-20px_rgba(15,23,42,0.15)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_20px_45px_-20px_rgba(15,23,42,0.8)]',
  board:
    'min-w-0 rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-[13px] leading-5 shadow-[0_10px_25px_-20px_rgba(15,23,42,0.35)] transition-colors dark:border-white/10 dark:bg-slate-900/80 dark:shadow-[0_14px_30px_-18px_rgba(15,23,42,0.85)]'
};

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className = '', children, variant = 'default', ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`${baseStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

export default Card;
