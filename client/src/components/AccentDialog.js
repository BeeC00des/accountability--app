import React, { useState } from 'react';
import { ACCENT_PRESETS, accentHex, useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { Dialog, Icon } from './ui';

/** White-label brand color: pick a preset or any custom color; the whole dashboard re-themes live. */
export default function AccentDialog({ onClose }) {
  const { accent, setAccent } = useTheme();
  const { notify } = useApp();
  const [original] = useState(accent);
  const isCustom = !ACCENT_PRESETS.some(preset => preset.value === accent);

  const cancel = () => { if (accent !== original) setAccent(original); onClose(); };
  const done = () => { notify('Theme color saved'); onClose(); };

  return (
    <Dialog
      icon="palette"
      title="Theme color"
      description="Make the dashboard yours. Changes preview instantly and work in light and dark mode."
      onClose={cancel}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={cancel}>Cancel</button>
        <button type="button" className="btn btn-filled state-layer" onClick={done}>Done</button>
      </>}
    >
      <div className="accent-grid" role="radiogroup" aria-label="Brand color">
        {ACCENT_PRESETS.map(preset => (
          <button key={preset.value} type="button" role="radio" aria-checked={accent === preset.value} className={`accent-option state-layer${accent === preset.value ? ' selected' : ''}`} onClick={() => setAccent(preset.value)}>
            <span className="accent-swatch" style={{ background: preset.hex }}>{accent === preset.value && <Icon name="check" />}</span>
            <span className="label-medium">{preset.label}</span>
          </button>
        ))}
        <label className={`accent-option state-layer${isCustom ? ' selected' : ''}`}>
          <span className="accent-swatch custom" style={{ background: isCustom ? accentHex(accent) : undefined }}>
            <Icon name={isCustom ? 'check' : 'colorize'} />
          </span>
          <span className="label-medium">Custom</span>
          <input type="color" className="visually-hidden" value={accentHex(accent)} onChange={event => setAccent(event.target.value)} aria-label="Pick a custom color" />
        </label>
      </div>
      <div className="accent-preview" aria-hidden="true">
        <span className="accent-preview-hero"><span className="title-small">Imagine your future</span></span>
        <span className="btn btn-tonal btn-sm">Get inspired</span>
        <span className="btn btn-filled btn-sm">Act</span>
        <span className="tag tag-primary"><Icon name="local_fire_department" filled />7 days</span>
      </div>
    </Dialog>
  );
}
