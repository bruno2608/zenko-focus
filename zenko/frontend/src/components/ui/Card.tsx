import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export default function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_45px_-20px_rgba(15,23,42,0.8)] backdrop-blur ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
