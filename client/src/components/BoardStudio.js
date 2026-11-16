import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { accentHex, useTheme } from '../context/ThemeContext';
import { savePreference } from '../lib/consent';
import { plural } from '../lib/format';
import { COLLAGE_SIZES, autoLayout, canvasToBlob, defaultTitle, downloadBlob, loadBoardImages, renderComposition, wordColor } from '../lib/vision';
import { Dialog, Icon, Spinner, Switch } from './ui';

const STORE_KEY = 'accountable-studio';
const MIN_SIDE = 0.06; // smallest tile, as a share of the board
const DEFAULT_OPTIONS = { corners: 0.4, background: 'theme', showTitle: true };

const readStore = () => { try { return JSON.parse(window.localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; } };
const writeStore = (boardId, value) => {
  const store = readStore();
  store[boardId] = value;
  // Keep only the 20 most recently edited boards.
  const ids = Object.keys(store).sort((a, b) => (store[b].at || 0) - (store[a].at || 0)).slice(0, 20);
  savePreference(STORE_KEY, JSON.stringify(Object.fromEntries(ids.map(id => [id, store[id]]))));
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
/** Keeps at least half of a tile on the board so nothing gets lost off the edge. */
const fit = rect => {
  const w = clamp(rect.w, MIN_SIDE, 1);
  const h = clamp(rect.h, MIN_SIDE, 1);
  return { ...rect, w, h, x: clamp(rect.x, -w / 2, 1 - w / 2), y: clamp(rect.y, -h / 2, 1 - h / 2) };
};

/** Saved arrangement for the items still on the board; new items get placed from a fresh auto layout. */
const mergeLayout = (saved, items, fresh) => {
  const ids = new Set(items.map(item => item._id));
  const kept = (saved || []).filter(rect => ids.has(rect.id));
  const keptIds = new Set(kept.map(rect => rect.id));
  return [...kept, ...fresh.filter(rect => !keptIds.has(rect.id))];
};

/**
 * Vision board studio: every card on the board laid out as one big wallpaper.
 * Drag to move, drag the corner to resize, and download exactly what you see.
 */
export default function BoardStudio({ board, onClose }) {
  const { notify } = useApp();
  const accent = accentHex(useTheme().accent);
  const saved = useMemo(() => readStore()[board._id] || {}, [board._id]);
  const [sizeValue, setSizeValue] = useState(saved.size || 'phone');
  const [options, setOptions] = useState({ ...DEFAULT_OPTIONS, ...saved.options });
  const [layouts, setLayouts] = useState(saved.layouts || {});
  const [images, setImages] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState(1);
  const frameRef = useRef(null);
  const dragRef = useRef(null);
  const size = COLLAGE_SIZES.find(item => item.value === sizeValue);
  const items = board.items;
  const byId = useMemo(() => new Map(items.map(item => [item._id, item])), [items]);
  const rects = layouts[sizeValue];
  const dark = options.background === 'black';

  useEffect(() => {
    let alive = true;
    loadBoardImages(items).then(loaded => { if (alive) setImages(loaded); });
    return () => { alive = false; };
  }, [items]);

  // First open for this size (or new items since last time): start from the auto mosaic.
  useEffect(() => {
    if (!images) return;
    setLayouts(current => {
      const fresh = autoLayout({ items, size, images, showTitle: options.showTitle, seed: 1 });
      const merged = mergeLayout(current[sizeValue], items, fresh);
      const same = current[sizeValue] && merged.length === current[sizeValue].length && merged.every((rect, index) => rect === current[sizeValue][index]);
      return same ? current : { ...current, [sizeValue]: merged };
    });
  }, [images, items, size, sizeValue, options.showTitle]);

  // Remember the arrangement on this device.
  useEffect(() => {
    if (!rects) return undefined;
    const timer = setTimeout(() => writeStore(board._id, { at: Date.now(), size: sizeValue, options, layouts }), 400);
    return () => clearTimeout(timer);
  }, [board._id, sizeValue, options, layouts, rects]);

  const setRects = useCallback(update => setLayouts(current => ({ ...current, [sizeValue]: update(current[sizeValue] || []) })), [sizeValue]);
  const updateRect = (id, change) => setRects(list => list.map(rect => (rect.id === id ? fit({ ...rect, ...change(rect) }) : rect)));
  const toFront = id => setRects(list => [...list.filter(rect => rect.id !== id), list.find(rect => rect.id === id)]);
  const toBack = id => setRects(list => [list.find(rect => rect.id === id), ...list.filter(rect => rect.id !== id)]);

  const autoArrange = () => {
    const next = seed + 1;
    setSeed(next);
    setLayouts(current => ({ ...current, [sizeValue]: autoLayout({ items, size, images, showTitle: options.showTitle, seed: next }) }));
    setSelected(null);
  };

  /* ---------- Pointer drag (move or resize) ---------- */
  const startDrag = (event, id, mode) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const frame = frameRef.current.getBoundingClientRect();
    const rect = rects.find(item => item.id === id);
    dragRef.current = { id, mode, startX: event.clientX, startY: event.clientY, rect, frameW: frame.width, frameH: frame.height };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelected(id);
    if (mode === 'move') toFront(id);
  };
  const onDrag = event => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.startX) / drag.frameW;
    const dy = (event.clientY - drag.startY) / drag.frameH;
    if (drag.mode === 'move') updateRect(drag.id, () => ({ x: drag.rect.x + dx, y: drag.rect.y + dy }));
    else updateRect(drag.id, () => ({ w: Math.max(MIN_SIDE, drag.rect.w + dx), h: Math.max(MIN_SIDE, drag.rect.h + dy) }));
  };
  const endDrag = () => { dragRef.current = null; };

  /* ---------- Keyboard: arrows move, +/- resize ---------- */
  const onTileKey = (event, id) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      updateRect(id, rect => ({ x: rect.x + dx, y: rect.y + dy }));
    } else if (event.key === '+' || event.key === '=' || event.key === '-') {
      event.preventDefault();
      const factor = event.key === '-' ? 0.95 : 1.05;
      updateRect(id, rect => ({ w: rect.w * factor, h: rect.h * factor, x: rect.x - (rect.w * (factor - 1)) / 2, y: rect.y - (rect.h * (factor - 1)) / 2 }));
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const canvas = await renderComposition({ board, size, images, rects, accent, options });
      const filename = `vision-board-${board.year}-${size.value}.png`;
      downloadBlob(await canvasToBlob(canvas), filename);
      notify(`Saved ${filename}. Set it as your ${size.label.toLowerCase()} wallpaper.`);
    } catch {
      notify('Could not create the image. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const missing = images ? items.filter(item => item.type === 'image' && !images.has(item._id)).length : 0;
  const title = board.title || defaultTitle(board.year, board.period);
  const unit = Math.min(size.width, size.height);
  const titleFont = (size.lockScreen ? 0.06 : 0.045) * 100; // in cqmin
  const titleBand = (unit * (size.lockScreen ? 0.06 : 0.045) * 2.4) / size.height;
  const titleGap = (unit * 0.03 * 0.35) / size.height;
  const titleCenter = size.lockScreen ? 1 - titleBand / 2 - titleGap / 2 : titleBand / 2 + titleGap / 2;

  return (
    <Dialog
      wide="xl"
      icon="dashboard_customize"
      title="Your vision board"
      description="Drag images to move them, drag the corner to resize. What you see here is what downloads."
      onClose={onClose}
      busy={busy}
      actions={<>
        {missing > 0 && <span className="body-small text-error studio-missing">{plural(missing, 'image')} couldn’t load and will download blank.</span>}
        <span className="spacer" />
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={busy}>Close</button>
        <button type="button" className="btn btn-filled state-layer" onClick={download} disabled={!rects || !images || busy}><Icon name="download" />{busy ? 'Creating…' : `Download for ${size.label.toLowerCase()}`}</button>
      </>}
    >
      <div className="studio-layout">
        <div className={`studio-stage is-${size.value}`} onPointerDown={() => setSelected(null)}>
          {!rects ? <Spinner label="Arranging your board" /> : (
            <div
              ref={frameRef}
              className={`studio-frame${dark ? ' is-dark' : ''}`}
              style={{ aspectRatio: `${size.width} / ${size.height}`, '--corners': options.corners }}
              onPointerMove={onDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {options.showTitle && <p className="studio-title" style={{ top: `${titleCenter * 100}%`, fontSize: `${titleFont}cqmin` }}>{title}</p>}
              {rects.map((rect, index) => {
                const item = byId.get(rect.id);
                if (!item) return null;
                const isSelected = selected === rect.id;
                const color = item.type === 'text' ? wordColor(item.color) : null;
                const onTheme = color && color.value === 'lime' && !dark; // theme card on theme wall flips to black, as in the download
                return (
                  <div
                    key={rect.id}
                    className={`studio-tile${isSelected ? ' selected' : ''}${item.type === 'text' ? ' is-words' : ''}`}
                    style={{
                      left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%`, zIndex: index + 1,
                      ...(color ? { background: onTheme ? '#000000' : color.bg, color: onTheme ? '#ffffff' : color.fg, fontSize: `calc(min(${rect.w * 100}cqw, ${rect.h * 100}cqh) * 0.13)` } : null)
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${item.type === 'text' ? item.text : item.caption || `Image ${index + 1}`}. Arrow keys move, plus and minus resize.`}
                    aria-pressed={isSelected}
                    onPointerDown={event => startDrag(event, rect.id, 'move')}
                    onFocus={() => setSelected(rect.id)}
                    onKeyDown={event => onTileKey(event, rect.id)}
                  >
                    {item.type === 'text' ? <span>{item.text}</span> : <img src={item.imageUrl} alt="" draggable="false" />}
                    {isSelected && <span className="studio-handle" onPointerDown={event => startDrag(event, rect.id, 'resize')} aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="studio-controls">
          <div className="download-group" role="radiogroup" aria-label="Wallpaper size">
            <span className="fieldset-legend">Size</span>
            <div className="collage-sizes">
              {COLLAGE_SIZES.map(item => (
                <button key={item.value} type="button" role="radio" aria-checked={sizeValue === item.value} className={`format-option state-layer${sizeValue === item.value ? ' selected' : ''}`} onClick={() => { setSizeValue(item.value); setSelected(null); }}>
                  <Icon name={item.icon} />
                  <span className="list-item-content">
                    <span className="title-small">{item.label}</span>
                    <span className="body-small text-variant">{item.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="download-group" role="radiogroup" aria-label="Background">
            <span className="fieldset-legend">Background</span>
            <div className="segmented segmented-block">
              {[['theme', 'Theme color'], ['black', 'Black']].map(([value, label]) => (
                <button key={value} type="button" role="radio" aria-checked={options.background === value} className="state-layer" onClick={() => setOptions(current => ({ ...current, background: value }))}>
                  <span className="collage-dot" style={{ background: value === 'black' ? '#000000' : 'var(--lime)' }} aria-hidden="true" />{label}
                </button>
              ))}
            </div>
          </div>

          <label className="collage-slider">
            <span className="collage-slider-head"><span className="title-small">Rounded corners</span><span className="body-small text-variant">{options.corners ? `${Math.round(options.corners * 100)}%` : 'Square'}</span></span>
            <input type="range" min="0" max="1" step="0.05" value={options.corners} onChange={event => setOptions(current => ({ ...current, corners: Number(event.target.value) }))} />
          </label>

          <label className="setting-row collage-title-row" htmlFor="studio-title">
            <Icon name="title" className="text-variant" />
            <span className="setting-row-text"><span className="body-large">Show board title</span></span>
            <Switch id="studio-title" checked={options.showTitle} onChange={value => setOptions(current => ({ ...current, showTitle: value }))} />
          </label>

          {selected && rects?.some(rect => rect.id === selected) && (
            <div className="studio-selection" aria-label="Selected card">
              <span className="fieldset-legend">Selected card</span>
              <div className="studio-selection-actions">
                <button type="button" className="btn btn-outlined state-layer" onClick={() => toFront(selected)}><Icon name="flip_to_front" />Bring forward</button>
                <button type="button" className="btn btn-outlined state-layer" onClick={() => toBack(selected)}><Icon name="flip_to_back" />Send back</button>
              </div>
            </div>
          )}

          <button type="button" className="btn btn-tonal state-layer studio-arrange" onClick={autoArrange} disabled={!images}><Icon name="auto_awesome_mosaic" />Auto arrange</button>
          <p className="body-small text-variant">Your arrangement is remembered on this device.</p>
        </div>
      </div>
    </Dialog>
  );
}
