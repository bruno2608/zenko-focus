interface SwitchProps {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void | Promise<void>;
  disabled?: boolean;
  title?: string;
}

export default function Switch({ checked, onCheckedChange, disabled = false, title }: SwitchProps) {
  const baseStyles =
    'relative inline-flex h-7 w-12 items-center rounded-full border transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';
  const checkedStyles =
    'bg-gradient-to-r from-zenko-primary to-zenko-secondary border-white/30 shadow-[0_8px_20px_rgba(34,211,238,0.45)]';
  const uncheckedStyles =
    'bg-white/25 dark:bg-slate-700/60 border-white/20 dark:border-slate-900/40 backdrop-blur-sm shadow-[0_6px_18px_rgba(15,23,42,0.25)]';
  const disabledStyles = 'cursor-not-allowed opacity-60';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onCheckedChange?.(!checked);
      }}
      className={`${baseStyles} ${checked ? checkedStyles : uncheckedStyles} ${disabled ? disabledStyles : ''}`}
      title={title}
    >
      <span className="sr-only">Alternar preferência</span>
      <span
        className={`inline-block h-5 w-5 transform rounded-full transition-all duration-300 ${
          checked
            ? 'translate-x-6 bg-white shadow-[0_5px_15px_rgba(56,189,248,0.4)]'
            : 'translate-x-1 bg-white/90 dark:bg-slate-100 shadow-[0_4px_12px_rgba(15,23,42,0.35)]'
        }`}
      />
    </button>
  );
}
