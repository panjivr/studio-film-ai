import { ReactNode } from 'react';
import { X } from 'lucide-react';

export function Field({
  label, value, onChange, placeholder, textarea, rows = 3, type = 'text', hint,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  rows?: number;
  type?: string;
  hint?: string;
}) {
  const cls =
    'w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition-colors';
  return (
    <label className="block">
      <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">
        {label}
      </span>
      {textarea ? (
        <textarea className={cls} rows={rows} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={cls} type={type} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <span className="block mt-1 text-[11px] text-zinc-600">{hint}</span>}
    </label>
  );
}

export function SelectField<T extends string | number>({
  label, value, options, onChange, allowEmpty,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: string) => void;
  allowEmpty?: boolean;
}) {
  const cls =
    'w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition-colors [&>option]:bg-zinc-900';
  return (
    <label className="block">
      <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">
        {label}
      </span>
      <select className={cls} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty !== false && <option value="">—</option>}
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[85vh] overflow-y-auto bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl shadow-black/50`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-zinc-950/95 backdrop-blur z-10">
          <h3 className="font-semibold text-zinc-100">{title}</h3>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Button({ children, onClick, variant = 'primary', type = 'button', disabled, className = '' }: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const variants: Record<string, string> = {
    primary: 'bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400 disabled:opacity-40',
    ghost: 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5',
    subtle: 'bg-white/5 border border-white/10 text-zinc-200 hover:bg-white/10 hover:border-white/20',
    danger: 'text-red-400 hover:text-red-300 hover:bg-red-500/10',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function SectionHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: {
  icon: ReactNode; title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-12 px-6 text-center">
      <div className="text-zinc-700 mb-3">{icon}</div>
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      {hint && <p className="text-xs text-zinc-600 mt-1 max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LockBadge({ locked }: { locked: boolean }) {
  return locked ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] px-2 py-0.5 font-medium tracking-wide">
      LOCKED
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 text-zinc-500 text-[10px] px-2 py-0.5">
      FREE
    </span>
  );
}
