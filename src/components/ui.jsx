// مكونات واجهة أساسية قابلة لإعادة الاستخدام
import { useEffect, useRef, useState } from 'react';
import { X, Check } from 'lucide-react';
import { useStore } from '../store.js';
import { IconTile } from './Glyph.jsx';

const base = import.meta.env.BASE_URL;
export const asset = (p) => base + p;

export function Logo({ className = 'header-logo', onClick }) {
  return (
    <button className={className} onClick={onClick} aria-label="هّمة — الرئيسية">
      <img src={asset('brand/logo.webp')} alt="هّمة" width="564" height="254" />
    </button>
  );
}

export function Modal({ title, sub, onClose, children, footer, size = '', labelledBy }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.();
    window.addEventListener('keydown', onKey);
    const prev = document.activeElement;
    setTimeout(() => ref.current?.querySelector('input,textarea,select,button:not(.icon-btn)')?.focus(), 60);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, []);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : labelledBy} ref={ref}>
        {(title || onClose) && (
          <div className="modal-hd">
            <div>
              {title && <h3>{title}</h3>}
              {sub && <p className="muted small mt-s">{sub}</p>}
            </div>
            {onClose && (
              <button className="icon-btn sm" onClick={onClose} aria-label="إغلاق">
                <X />
              </button>
            )}
          </div>
        )}
        {children}
        {footer && <div className="modal-ft">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, icon, onClose, children, actions }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="drawer-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-hd">
          <div className="card-title">
            {icon && <span className="ico">{icon}</span>}
            {title}
          </div>
          <div className="row">
            {actions}
            <button className="icon-btn sm" onClick={onClose} aria-label="إغلاق">
              <X />
            </button>
          </div>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Ring({ value = 0, size = 160, stroke = 12, color = 'url(#ringGrad)', children, id = 'ringGrad' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setV(Math.max(0, Math.min(100, value))));
    return () => cancelAnimationFrame(t);
  }, [value]);
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(value)}%`}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary-soft)" />
            <stop offset="55%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="val"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color.startsWith('url') ? `url(#${id})` : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
        />
      </svg>
      <div className="center">{children}</div>
    </div>
  );
}

export function Bar({ value = 0, variant = '', className = '' }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setV(Math.max(0, Math.min(100, value))));
    return () => cancelAnimationFrame(t);
  }, [value]);
  return (
    <div className={`bar ${variant} ${className}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${v}%` }} />
    </div>
  );
}

// عدّاد متحرك للأرقام
export function Num({ value = 0, duration = 900, format = (n) => Math.round(n).toLocaleString('en-US'), className = '' }) {
  const [n, setN] = useState(value);
  const from = useRef(value);
  const motion = useStore((s) => s.settings.motion);
  const first = useRef(true);
  useEffect(() => {
    if (motion === 'off') return setN(value);
    const start = performance.now();
    const a = first.current ? 0 : from.current;
    first.current = false;
    const b = value;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setN(a + (b - a) * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = b;
    };
  }, [value, duration, motion]);
  return <span className={`num ${className}`}>{format(n)}</span>;
}

export function Switch({ on, onChange, label }) {
  return <button type="button" role="switch" aria-checked={!!on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

export function CheckBox({ on, onChange, label, round }) {
  const [pop, setPop] = useState(false);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={!!on}
      aria-label={label}
      className={`check ${round ? 'round' : ''} ${on ? 'on' : ''} ${pop ? 'pop' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!on) {
          setPop(true);
          setTimeout(() => setPop(false), 450);
        }
        onChange(!on);
      }}
    >
      <Check />
    </button>
  );
}

export function Empty({ icon, title, text, action }) {
  return (
    <div className="empty">
      <div className="e-ico">{icon}</div>
      <h3>{title}</h3>
      {text && <p className="muted small">{text}</p>}
      {action && <div className="mt-s">{action}</div>}
    </div>
  );
}

export function Avatar({ name = '', src, size = '' }) {
  return <span className={`avatar ${size}`}>{src ? <img src={src} alt={name} /> : (name || '؟').trim().charAt(0)}</span>;
}

export function CardTitle({ icon, color = '', children, sub }) {
  return (
    <div>
      <div className="card-title">
        {icon && <span className={`ico ${color}`}>{icon}</span>}
        <span>{children}</span>
      </div>
      {sub && <div className="card-sub mt-s">{sub}</div>}
    </div>
  );
}

export function useConfirm() {
  const open = useStore((s) => s.openModal);
  return (opts) => open('confirm', opts);
}

export function ConfirmModal({ title, body, confirmLabel = 'تأكيد', danger, onConfirm, icon }) {
  const close = useStore((s) => s.closeModal);
  return (
    <Modal
      title={title}
      onClose={close}
      footer={
        <>
          <button className="btn btn-ghost" onClick={close}>
            إلغاء
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => {
              close();
              onConfirm?.();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="row" style={{ alignItems: 'flex-start' }}>
        {icon && (typeof icon === 'string' ? <IconTile name={icon} size={44} /> : icon)}
        <p className="muted">{body}</p>
      </div>
    </Modal>
  );
}
