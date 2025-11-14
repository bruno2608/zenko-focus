import { HTMLAttributes, ReactNode, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'board';
}

const baseStyles: Record<NonNullable<CardProps['variant']>, string> = {
  default:
    'min-w-0 rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-[0_20px_45px_-20px_rgba(15,23,42,0.15)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_20px_45px_-20px_rgba(15,23,42,0.8)]',
  board:
    'relative min-w-0 rounded-2xl border border-slate-200/70 bg-white px-3 py-3 text-[12px] leading-[16px] shadow-[0_8px_22px_-18px_rgba(15,23,42,0.4)] transition-all duration-200 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_16px_34px_-22px_rgba(15,23,42,0.9)] hover:shadow-[0_18px_38px_-20px_rgba(15,23,42,0.45)] dark:hover:shadow-[0_26px_42px_-24px_rgba(15,23,42,0.95)]'
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
