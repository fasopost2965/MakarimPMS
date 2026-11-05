// Primitives d'interface du prototype (boutons, cartes, pastilles, barres,
// panneaux, modales, toasts). Toutes les couleurs viennent des tokens définis
// dans `src/index.css` : aucun écran n'utilise une couleur Tailwind brute.
//
// Accessibilité : focus visible, fermeture des panneaux par `Échap`,
// informations jamais portées par la seule couleur.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function Card({ className, children, ...rest }) {
  return (
    <section
      className={cx(
        'rounded-2xl border border-line bg-white shadow-card',
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}

export function CardHeader({ titre, sousTitre, action, className }) {
  return (
    <header
      className={cx(
        'flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[15px] leading-5 font-semibold tracking-[-0.01em] text-ink">
          {titre}
        </h2>
        {sousTitre && (
          <p className="mt-0.5 text-xs text-ink-3">{sousTitre}</p>
        )}
      </div>
      {action}
    </header>
  );
}

export function Pill({ tone = 'neutral', children, className }) {
  const tones = {
    neutral: 'bg-sand-200 text-ink-2',
    maj: 'bg-maj-100 text-maj',
    jade: 'bg-jade-100 text-jade',
    saffron: 'bg-saffron-100 text-saffron',
    crimson: 'bg-crimson-100 text-crimson',
    terra: 'bg-terra-100 text-terra',
    outline: 'border border-line text-ink-2',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}) {
  const variants = {
    primary:
      'bg-maj text-white hover:bg-maj-700 active:translate-y-px shadow-[0_1px_2px_rgba(47,64,144,.25)]',
    soft: 'bg-maj-50 text-maj hover:bg-maj-100',
    outline: 'border border-line bg-white text-ink hover:bg-sand-100',
    ghost: 'text-ink-2 hover:bg-sand-200/70',
    danger: 'bg-crimson text-white hover:brightness-95',
    terra: 'bg-terra text-white hover:brightness-95',
  };
  const sizes = {
    sm: 'h-8 px-3 text-xs rounded-lg',
    md: 'h-9 px-4 text-[13px] rounded-xl',
    lg: 'h-11 px-5 text-sm rounded-xl',
  };
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Chiffres                                                            */
/* ------------------------------------------------------------------ */

export function Stat({ label, value, unit, delta, tone = 'neutral', hint }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium tracking-[0.06em] text-ink-3 uppercase">
        {label}
      </p>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="tnum text-[26px] leading-none font-semibold tracking-[-0.02em] text-ink">
          {value}
        </span>
        {unit && <span className="text-xs font-medium text-ink-3">{unit}</span>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {delta != null && (
          <Pill tone={tone === 'neutral' ? 'jade' : tone}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
          </Pill>
        )}
        {hint && <span className="truncate text-[11px] text-ink-3">{hint}</span>}
      </div>
    </Card>
  );
}

export function Bar({ value, max = 100, tone = 'bg-maj', className }) {
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-sand-200', className)}>
      <div
        className={cx('h-full rounded-full transition-[width] duration-500', tone)}
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
      />
    </div>
  );
}

export function Ring({ value, size = 56, stroke = 6, tone = 'var(--color-maj)' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sand-200)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function Sparkline({ points, tone = 'var(--color-maj)', width = 320, height = 84 }) {
  const max = Math.max(...points.map((p) => p.valeur)) * 1.12;
  const min = Math.min(...points.map((p) => p.valeur)) * 0.82;
  const x = (i) => (i / (points.length - 1)) * (width - 8) + 4;
  const y = (v) => height - 10 - ((v - min) / (max - min)) * (height - 22);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.valeur).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${height - 6} L${x(0)},${height - 6} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Prévision d'occupation sur 14 jours">
      <defs>
        <linearGradient id="grad-occ" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.18" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={width} y1={height * f} y2={height * f} stroke="var(--color-line-soft)" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#grad-occ)" />
      <path d={line} fill="none" stroke={tone} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.jour + i}>
          <circle cx={x(i)} cy={y(p.valeur)} r="2.6" fill="white" stroke={tone} strokeWidth="1.8" />
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Panneau latéral & modale                                            */
/* ------------------------------------------------------------------ */

// Fermeture au clavier (Échap) — attendu par les utilisateurs de logiciels de
// réception qui travaillent au clavier. Branché avant le rendu conditionnel
// pour respecter les règles des hooks.
function useEchap(actif, onClose) {
  useEffect(() => {
    if (!actif) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actif, onClose]);
}

export function Drawer({ open, onClose, title, subtitle, children, footer }) {
  useEchap(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fermer le panneau"
        onClick={onClose}
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-slide-in relative flex h-full w-full max-w-[440px] flex-col bg-sand-50 shadow-pop"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line bg-white px-5 py-4">
          <div>
            <h2 className="font-display text-xl text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-ink-3">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">
            <X className="size-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <footer className="border-t border-line bg-white px-5 py-4">{footer}</footer>
        )}
      </aside>
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }) {
  useEchap(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'animate-fade-up relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-pop',
          width,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
          <div>
            <h2 className="font-display text-xl text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-ink-3">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">
            <X className="size-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="border-t border-line-soft bg-sand-50 px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

const ToastContext = createContext({ push: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = 'success') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] lg:bottom-5 flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className="animate-fade-up pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line bg-ink px-4 py-3 text-[13px] text-white shadow-pop"
          >
            {t.tone === 'info' ? (
              <Info className="mt-0.5 size-4 shrink-0 text-saffron" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-jade-100" />
            )}
            <span className="leading-5">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Divers                                                              */
/* ------------------------------------------------------------------ */

export function Divider({ label }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-line-soft" />
      {label && <span className="text-[10px] font-medium tracking-[0.1em] text-ink-3 uppercase">{label}</span>}
      <span className="h-px flex-1 bg-line-soft" />
    </div>
  );
}

export function Kbd({ children }) {
  return (
    <kbd className="rounded-md border border-line bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-ink-3">
      {children}
    </kbd>
  );
}
