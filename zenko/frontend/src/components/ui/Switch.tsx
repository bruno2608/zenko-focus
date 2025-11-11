interface SwitchProps {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void | Promise<void>;
}

export default function Switch({ checked, onCheckedChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={`relative h-6 w-11 rounded-full border border-white/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-zenko-primary/60 focus:ring-offset-2 focus:ring-offset-transparent ${
        checked ? 'bg-gradient-to-r from-zenko-primary to-zenko-secondary' : 'bg-slate-300/50 dark:bg-slate-600/60'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
