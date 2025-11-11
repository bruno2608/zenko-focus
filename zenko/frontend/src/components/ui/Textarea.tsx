import { TextareaHTMLAttributes, forwardRef } from 'react';

const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className = '', ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-500 shadow-inner shadow-slate-900/5 focus:border-zenko-primary/40 focus:outline-none focus:ring-2 focus:ring-zenko-primary/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-400 dark:shadow-slate-900/40 dark:focus:border-transparent dark:focus:ring-zenko-primary/60 ${className}`}
      {...props}
    />
  );
});

export default Textarea;
