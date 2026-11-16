import React, { useCallback, useEffect, useState } from 'react';
import { API } from '../context/AuthContext';
import { Dialog, Icon, Spinner } from './ui';
import { apiError, plural } from '../lib/format';

// [chip label, search words that return the best inspiration photos]
const TOPICS = [
  ['Travel', 'travel'], ['Education', 'education'], ['Fitness', 'fitness'], ['Career', 'office work'],
  ['Wellness', 'yoga spa'], ['Home', 'home interior'], ['Money', 'money savings'], ['Style', 'fashion style'],
  ['Healthy food', 'healthy food'], ['Nature', 'nature'], ['Family', 'family'], ['Mindset', 'meditation']
];
const pickTopic = () => { const [label, value] = TOPICS[Math.floor(Math.random() * 2)]; return { type: 'search', value, label }; }; // opens on Travel or Education

/**
 * Inspiration gallery: search any keyword (openly licensed photos via Openverse) or browse featured Pinterest boards.
 * Every search pulls a fresh random set, so reloading shows new images. Tap to select, then add them in one go.
 */
export default function GalleryDialog({ onClose, onAddMany }) {
  const [featured, setFeatured] = useState([]);
  const [active, setActive] = useState(pickTopic);
  const [queryText, setQueryText] = useState('');
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => new Map());
  const [adding, setAdding] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    API.get('/vision/sources').then(response => setFeatured(response.data.featured || [])).catch(() => {});
  }, []);

  const load = useCallback(async source => {
    setLoading(true);
    setError('');
    setPins([]);
    try {
      const response = source.type === 'search'
        ? await API.get('/vision/search', { params: { q: source.value } })
        : await API.get('/vision/gallery', { params: { source: source.value } });
      setPins(response.data.pins.map(pin => ({ ...pin, key: pin.id || pin.pinUrl, source: source.type === 'search' ? 'openverse' : 'pinterest' })));
    } catch (loadError) {
      setError(apiError(loadError, 'Could not load images. Try again.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(active); }, [active, round, load]);

  const search = event => {
    event.preventDefault();
    const value = queryText.trim();
    if (value.length < 2) return;
    setActive({ type: 'search', value, label: value });
    setRound(count => count + 1);
  };
  const choose = source => { setActive(source); setRound(count => count + 1); };

  const toggle = pin => setSelected(current => {
    const next = new Map(current);
    if (next.has(pin.key)) next.delete(pin.key); else next.set(pin.key, pin);
    return next;
  });

  const addSelected = async () => {
    setAdding(true);
    const added = await onAddMany([...selected.values()].map(pin => (pin.source === 'openverse'
      ? { type: 'image', source: 'openverse', imageUrl: pin.imageUrl, width: pin.width, height: pin.height }
      : { type: 'image', source: 'pinterest', imageUrl: pin.imageUrl, sourceUrl: pin.pinUrl })));
    setAdding(false);
    if (added > 0) onClose();
  };

  const isActive = (type, value) => active.type === type && active.value.toLowerCase() === value.toLowerCase();
  const heading = active.type === 'search' ? active.label || active.value : featured.find(source => source.id === active.value)?.label || 'Pinterest';

  return (
    <Dialog
      wide
      icon="photo_library"
      title="Inspiration gallery"
      description="Search any topic, tap the images that feel like your future, then add them to your board."
      onClose={onClose}
      busy={adding}
      actions={<>
        <span className="body-small text-variant gallery-count">{selected.size ? `${plural(selected.size, 'image')} selected` : 'Tap images to select'}</span>
        <span className="spacer" />
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={adding}>Close</button>
        <button type="button" className="btn btn-filled state-layer" onClick={addSelected} disabled={!selected.size || adding}><Icon name="add" />{adding ? 'Adding…' : selected.size ? `Add ${selected.size} to board` : 'Add to board'}</button>
      </>}
    >
      <div className="gallery-layout">
        <aside className="gallery-sources" aria-label="Find images">
          <form className="gallery-search" onSubmit={search} role="search">
            <Icon name="search" />
            <label className="visually-hidden" htmlFor="gallery-search-input">Search images</label>
            <input id="gallery-search-input" className="field-control" value={queryText} onChange={event => setQueryText(event.target.value)} placeholder="Search any topic" maxLength={60} enterKeyHint="search" data-autofocus />
            <button type="submit" className="icon-btn filled state-layer" disabled={queryText.trim().length < 2} aria-label="Search"><Icon name="arrow_forward" /></button>
          </form>
          <span className="fieldset-legend">Topics</span>
          <div className="chip-set gallery-topics">
            {TOPICS.map(([label, value]) => (
              <button key={label} type="button" className={`chip state-layer${isActive('search', value) ? ' selected' : ''}`} aria-pressed={isActive('search', value)} onClick={() => choose({ type: 'search', value, label })}>{label}</button>
            ))}
          </div>
          {featured.length > 0 && <>
            <span className="fieldset-legend">Pinterest boards</span>
            <ul role="list">
              {featured.map(source => (
                <li key={source.id} className="gallery-source-row">
                  <button type="button" className={`gallery-source state-layer${isActive('pinterest', source.id) ? ' active' : ''}`} onClick={() => choose({ type: 'pinterest', value: source.id })}>
                    <Icon name="push_pin" />
                    <span className="gallery-source-label">{source.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>}
        </aside>

        <section className="gallery-pins" aria-live="polite" aria-busy={loading}>
          <div className="gallery-pins-head">
            <h3 className="title-medium gallery-heading">{heading}</h3>
            <button type="button" className="btn btn-text state-layer" onClick={() => setRound(count => count + 1)} disabled={loading}><Icon name="refresh" />New images</button>
          </div>
          {loading && <Spinner label="Loading images" />}
          {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}
          {!loading && !error && !pins.length && <p className="body-medium text-variant">No images found. Try another word.</p>}
          {!loading && !error && pins.length > 0 && (
            <>
              <ul className="gallery-grid" role="list">
                {pins.map(pin => {
                  const isSelected = selected.has(pin.key);
                  return (
                    <li key={pin.key}>
                      <button type="button" className={`gallery-pin${isSelected ? ' selected' : ''}`} onClick={() => toggle(pin)} aria-pressed={isSelected} aria-label={pin.title || `${heading} image`}>
                        <img src={pin.thumbUrl} alt="" loading="lazy" />
                        <span className="gallery-pin-check" aria-hidden="true"><Icon name="check" /></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {active.type === 'search' && <p className="body-small text-variant gallery-credit">Openly licensed photos via Openverse</p>}
            </>
          )}
        </section>
      </div>
    </Dialog>
  );
}
