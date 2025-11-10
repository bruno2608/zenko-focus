import { ReactNode } from 'react';

export default function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-zenko-surface p-4 shadow-lg">{children}</div>;
}
