import React, { useCallback, useEffect, useState } from 'react';
import { API } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Dialog, Icon, Spinner } from './ui';
import { apiError, plural } from '../lib/format';

const SEARCH_THEMES = ['Fitness', 'Wellness', 'Travel', 'Career', 'Home', 'Money', 'Style', 'Mindset', 'Morning routine', 'Healthy food'];

/**
 * Inspiration gallery powered by public Pinterest feeds.
 * Browse featured boards or your own Pinterest profiles/boards, tap pins, add them in one go.
 */
export default function GalleryDialog({ onClose, onAddMany }) {
  const { notify } = useApp();
  const [sources, setSources] = useState({ featured: [], mine: [] });
  const [active, setActive] = useState('featured:0');
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => new Map());
  const [newSource, setNewSource] = useState('');
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    API.get('/vision/sources').then(response => setSources(response.data)).catch(() => {});
  }, []);

  const load = useCallback(async source => {
    setLoading(true);
    setError('');
    setPins([]);
    try {
      const response = await API.get('/vision/gallery', { params: { source } });
      setPins(response.data.pins);
    } catch (loadError) {
      setError(apiError(loadError, 'Could not load pins from Pinterest.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(active); }, [active, load]);

  const toggle = pin => setSelected(current => {
    const next = new Map(current);
    if (next.has(pin.pinUrl)) next.delete(pin.pinUrl); else next.set(pin.pinUrl, pin);
    return next;
  });

  const saveSource = async event => {
    event.preventDefault();
    if (!newSource.trim()) return;
    setSaving(true);
    try {
      const response = await API.post('/vision/sources', { url: newSource.trim() });
      setSources(current => ({ ...current, mine: response.data.mine }));
      const added = response.data.mine[response.data.mine.length - 1];
      setNewSource('');
      if (added) setActive(added.url);
    } catch (saveError) {
      notify(apiError(saveError, 'Could not add that Pinterest link.'));
    } finally {
      setSaving(false);
    }
  };

  const removeSource = async url => {
    try {
      const response = await API.delete('/vision/sources', { params: { url } });
      setSources(current => ({ ...current, mine: response.data.mine }));
      if (active === url) setActive('featured:0');
    } catch { notify('Could not remove that source.'); }
  };

  const addSelected = async () => {
    setAdding(true);
    const added = await onAddMany([...selected.values()].map(pin => ({
      type: 'image', source: 'pinterest', imageUrl: pin.imageUrl, sourceUrl: pin.pinUrl
    })));
    setAdding(false);
    if (added > 0) onClose();
  };

  const sourceButton = (id, label, removable) => (
    <li key={id} className="gallery-source-row">
      <button type="button" className={`gallery-source state-layer${active === id ? ' active' : ''}`} onClick={() => setActive(id)} aria-current={active === id ? 'true' : undefined}>
        <Icon name={id.startsWith('featured') ? 'auto_awesome' : 'push_pin'} />
        <span className="gallery-source-label">{label}</span>
      </button>
      {removable && <button type="button" className="icon-btn state-layer" onClick={() => removeSource(id)} aria-label={`Remove ${label}`}><Icon name="close" size="18" /></button>}
    </li>
  );

  return (
    <Dialog
      wide
      icon="photo_library"
      title="Inspiration gallery"
      description="Pins from Pinterest. Tap the ones that feel like your future, then add them to your board."
      onClose={onClose}
      busy={adding}
      actions={<>
        <span className="body-small text-variant gallery-count">{selected.size ? `${plural(selected.size, 'pin')} selected` : 'Tap pins to select'}</span>
        <span className="spacer" />
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={adding}>Close</button>
        <button type="button" className="btn btn-filled state-layer" onClick={addSelected} disabled={!selected.size || adding}><Icon name="add" />{adding ? 'Adding…' : `Add ${selected.size || ''} to board`.replace('  ', ' ')}</button>
      </>}
    >
      <div className="gallery-layout">
        <aside className="gallery-sources" aria-label="Pinterest sources">
          <span className="fieldset-legend">Featured</span>
          <ul role="list">{sources.featured.map(source => sourceButton(source.id, source.label, false))}</ul>
          <span className="fieldset-legend">Your Pinterest</span>
          {sources.mine.length > 0 && <ul role="list">{sources.mine.map(source => sourceButton(source.url, source.label, true))}</ul>}
          <form className="gallery-add-source" onSubmit={saveSource}>
            <label className="visually-hidden" htmlFor="gallery-source-input">Pinterest profile or board link</label>
            <input id="gallery-source-input" className="field-control" value={newSource} onChange={event => setNewSource(event.target.value)} placeholder="pinterest.com/you/board" inputMode="url" />
            <button type="submit" className="icon-btn tonal state-layer" disabled={saving || !newSource.trim()} aria-label="Add Pinterest source"><Icon name="add" /></button>
          </form>
          <p className="body-small text-variant gallery-hint">Add your own profile or any public board — new pins show up here.</p>
          <span className="fieldset-legend">Find more on Pinterest</span>
          <div className="chip-set">
            {SEARCH_THEMES.map(theme => (
              <a key={theme} className="chip chip-assist state-layer" href={`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(`${theme} vision board`)}`} target="_blank" rel="noopener noreferrer">
                {theme}<Icon name="open_in_new" size="18" />
              </a>
            ))}
          </div>
        </aside>

        <section className="gallery-pins" aria-live="polite" aria-busy={loading}>
          {loading && <Spinner label="Loading pins" />}
          {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}
          {!loading && !error && (
            <ul className="gallery-grid" role="list">
              {pins.map(pin => {
                const isSelected = selected.has(pin.pinUrl);
                return (
                  <li key={pin.pinUrl}>
                    <button type="button" className={`gallery-pin${isSelected ? ' selected' : ''}`} onClick={() => toggle(pin)} aria-pressed={isSelected} aria-label={pin.title || 'Pinterest pin'}>
                      <img src={pin.thumbUrl} alt="" loading="lazy" />
                      <span className="gallery-pin-check" aria-hidden="true"><Icon name="check" /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  );
}
