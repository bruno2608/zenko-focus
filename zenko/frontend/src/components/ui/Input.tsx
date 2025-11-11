import { InputHTMLAttributes, forwardRef } from 'react';

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-slate-400 shadow-inner shadow-slate-900/40 backdrop-blur focus:border-transparent focus:outline-none focus:ring-2 focus:ring-zenko-primary/60 ${className}`}
      {...props}
    />
  );
});

export default Input;
