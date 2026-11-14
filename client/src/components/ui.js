import React, { useEffect, useId, useRef, useState } from 'react';
import { avatarTone, initials } from '../lib/format';

/* Material Symbols icon. Decorative by default; pass `label` to announce it. */
export const Icon = ({ name, filled = false, size, className = '', label }) => (
  <span
    className={`icon${filled ? ' filled' : ''}${size ? ` icon-${size}` : ''} ${className}`.trim()}
    aria-hidden={label ? undefined : 'true'}
    role={label ? 'img' : undefined}
    aria-label={label}
  >{name}</span>
);

/** Profile photo when `src` is set, otherwise initials on a gradient (or an icon). */
export const Avatar = ({ name, size = '', icon, src }) => (
  <span className={`avatar${size ? ` avatar-${size}` : ''}${src ? ' has-photo' : ''}`} style={icon || src ? undefined : avatarTone(name)} aria-hidden="true">
    {src ? <img src={src} alt="" /> : icon ? <Icon name={icon} /> : initials(name)}
  </span>
);

export const Spinner = ({ label = 'Loading' }) => (
  <div className="loading-state" role="status" aria-label={label}>
    <svg className="circular-progress" viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="20" /></svg>
  </div>
);

export const LinearProgress = ({ value, label }) => (
  <div className="linear-progress" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin="0" aria-valuemax="100">
    <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

export const EmptyState = ({ icon, title, children, action }) => (
  <div className="empty-state">
    <div className="empty-state-icon"><Icon name={icon} /></div>
    <h3>{title}</h3>
    {children && <p>{children}</p>}
    {action}
  </div>
);

export const ErrorBanner = ({ message, onRetry }) => (
  <div className="banner" role="alert">
    <Icon name="error" />
    <p>{message}</p>
    {onRetry && <button type="button" className="btn btn-text state-layer" onClick={onRetry}>Retry</button>}
  </div>
);

export const Switch = ({ id, checked, onChange, label, disabled }) => (
  <span className="switch">
    <input id={id} type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} aria-label={label} disabled={disabled} />
    <span className="switch-track" />
    <span className="switch-handle" />
  </span>
);

/** Outlined text field with a floating label and supporting/error text. */
export const TextField = ({ label, error, help, counter, as = 'input', className = '', id: providedId, children, ...props }) => {
  const autoId = useId();
  const id = providedId || autoId;
  const helpId = `${id}-help`;
  const Control = as;
  const describedBy = error || help || counter ? helpId : undefined;
  return (
    <div className={`field${error ? ' has-error' : ''} ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      <Control id={id} className="field-control" aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy} {...props}>{children}</Control>
      {describedBy && (
        <div className="supporting-text" id={helpId}>
          <span>{error || help}</span>
          {counter && <span>{counter}</span>}
        </div>
      )}
    </div>
  );
};

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog: traps focus, closes on Escape / scrim click, restores focus on close.
 * Becomes a bottom sheet on small screens via CSS.
 */
export const Dialog = ({ title, description, icon, onClose, children, actions, wide = false, busy = false, as = 'div', onSubmit }) => {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = busy ? () => {} : onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const node = ref.current;
    const first = node.querySelector('[autofocus], [data-autofocus]') || node.querySelector(FOCUSABLE);
    first?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = event => {
      if (event.key === 'Escape') { event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter(item => item.offsetParent !== null);
      if (!items.length) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (event.shiftKey && document.activeElement === head) { event.preventDefault(); tail.focus(); }
      else if (!event.shiftKey && document.activeElement === tail) { event.preventDefault(); head.focus(); }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  const Container = as;
  return (
    <div className="scrim" onMouseDown={event => { if (event.target === event.currentTarget) closeRef.current(); }}>
      <Container
        ref={ref}
        className={`dialog${wide ? ' dialog-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={busy || undefined}
        onSubmit={onSubmit}
        noValidate={as === 'form' ? true : undefined}
      >
        <header className="dialog-header">
          {icon && <Icon name={icon} className="dialog-icon" />}
          <div className="dialog-header-text">
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId} className="body-medium">{description}</p>}
          </div>
          <button type="button" className="icon-btn state-layer" onClick={() => closeRef.current()} aria-label="Close" disabled={busy}><Icon name="close" /></button>
        </header>
        <div className="dialog-body">{children}</div>
        {actions && <footer className="dialog-actions">{actions}</footer>}
      </Container>
    </div>
  );
};

/** Overflow menu anchored to an icon button. Items: { label, icon, onSelect, danger, divider } */
export const Menu = ({ label, items, icon = 'more_horiz', trigger, align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = event => { if (!anchor.current?.contains(event.target)) setOpen(false); };
    const onKey = event => {
      if (event.key === 'Escape') { setOpen(false); anchor.current?.querySelector('button')?.focus(); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const options = [...anchor.current.querySelectorAll('[role="menuitem"]')];
        const index = options.indexOf(document.activeElement);
        const next = event.key === 'ArrowDown' ? (index + 1) % options.length : (index - 1 + options.length) % options.length;
        options[next]?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    anchor.current?.querySelector('[role="menuitem"]')?.focus();
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="menu-anchor" ref={anchor}>
      <button type="button" className="icon-btn state-layer" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen(value => !value)}>
        {trigger || <Icon name={icon} />}
      </button>
      {open && (
        <div className={`menu${align === 'left' ? ' menu-left' : ''}`} role="menu" id={menuId}>
          {items.filter(Boolean).map((item, index) => item.header
            ? <div key={`header-${index}`} className="menu-header" role="presentation">{item.header}</div>
            : item.divider
            ? <div key={`divider-${index}`} className="menu-divider" role="separator" />
            : (
              <button key={item.label} type="button" role="menuitem" className={`menu-item state-layer${item.danger ? ' danger' : ''}`} onClick={() => { setOpen(false); item.onSelect(); }}>
                {item.icon && <Icon name={item.icon} />}{item.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

/** Confirmation dialog for destructive actions — replaces window.confirm. */
export const ConfirmDialog = ({ title, children, confirmLabel = 'Delete', onConfirm, onClose, busy }) => (
  <Dialog
    title={title}
    icon="warning"
    onClose={onClose}
    busy={busy}
    actions={<>
      <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={busy}>Cancel</button>
      <button type="button" className="btn btn-text btn-danger state-layer" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
    </>}
  >
    <p className="body-medium">{children}</p>
  </Dialog>
);
