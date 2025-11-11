import { SelectHTMLAttributes, forwardRef } from 'react';

const baseClass =
  'zenko-select w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner shadow-slate-900/5 transition focus:border-zenko-primary/40 focus:outline-none focus:ring-2 focus:ring-zenko-primary/40 dark:border-white/10 dark:bg-slate-900/70 dark:text-white dark:shadow-slate-900/40 dark:focus:border-transparent dark:focus:ring-zenko-primary/60 backdrop-blur';

const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = '', children, ...props },
  ref
) {
  return (
    <select ref={ref} className={`${baseClass} ${className}`} {...props}>
      {children}
    </select>
  );
});

export default Select;
