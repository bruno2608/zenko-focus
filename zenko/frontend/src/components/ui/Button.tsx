import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'secondary';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-zenko-primary text-black',
  secondary: 'bg-slate-700 text-white',
  ghost: 'bg-transparent text-zenko-primary'
};

export default function Button({ className = '', variant = 'primary', ...props }: Props) {
  return (
    <button
      className={`rounded-md px-4 py-2 font-semibold transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
