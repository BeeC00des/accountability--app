import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { accentHex, useTheme } from '../context/ThemeContext';
import { ConfirmDialog, Dialog, EmptyState, ErrorBanner, Icon, Menu, Spinner, TextField } from '../components/ui';
import { apiError, plural } from '../lib/format';
import GalleryDialog from '../components/GalleryDialog';
import BoardStudio from '../components/BoardStudio';
import SuggestedGoals from '../components/SuggestedGoals';
import {
  FORMATS, PERIOD_GROUPS, THEMES, WORD_COLORS, canvasToBlob, defaultTitle, downloadBlob,
  loadBoardImages, periodOf, printBlob, rangeLabel, renderBoard, resizeUpload, wordColor
} from '../lib/vision';

const DEFAULT_YEAR = 2027;
const MIN_YEAR = 2024;
const MAX_YEAR = 2035;

/* ---------- Words card / caption editor ---------- */
function WordsDialog({ item, onClose, onSave }) {
  const isImage = item?.type === 'image';
  const [text, setText] = useState(item?.text || '');
  const [caption, setCaption] = useState(item?.caption || '');
  const [color, setColor] = useState(item?.color || 'lime');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const swatch = wordColor(color);

  const save = async event => {
    event.preventDefault();
    if (!isImage && !text.trim()) { setError('Write a few words.'); return; }
    setBusy(true);
    const ok = await onSave(isImage ? { caption: caption.trim() } : { type: 'text', text: text.trim(), color });
    if (ok) onClose(); else setBusy(false);
  };

  return (
    <Dialog
      as="form"
      onSubmit={save}
      icon={isImage ? 'edit' : 'format_quote'}
      title={isImage ? 'Edit caption' : item ? 'Edit words' : 'Add words'}
      description={isImage ? 'Captions appear on the image in your download.' : 'An affirmation, a word for the year, or a goal in your own words.'}
      onClose={onClose}
      busy={busy}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-filled state-layer" disabled={busy}>{busy ? 'Saving…' : item ? 'Save' : 'Add to board'}</button>
      </>}
    >
      {isImage ? (
        <TextField label="Caption" value={caption} onChange={event => setCaption(event.target.value)} maxLength={80} counter={`${caption.length}/80`} data-autofocus />
      ) : (
        <>
          <div className="words-preview" style={{ background: swatch.bg, color: swatch.fg }} aria-hidden="true">{text.trim() || 'Your words here'}</div>
          <TextField as="textarea" label="Words" rows={2} value={text} onChange={event => { setText(event.target.value); setError(''); }} maxLength={120} placeholder="e.g. Strong, calm, and consistent" counter={`${text.length}/120`} error={error} data-autofocus />
          <fieldset className="plain-fieldset">
            <legend className="fieldset-legend">Color</legend>
            <div className="swatch-row" role="radiogroup" aria-label="Card color">
              {WORD_COLORS.map(option => (
                <button key={option.value} type="button" role="radio" aria-checked={color === option.value} aria-label={option.label} title={option.label} className={`swatch state-layer${color === option.value ? ' selected' : ''}`} style={{ background: option.bg, color: option.fg }} onClick={() => setColor(option.value)}>
                  {color === option.value && <Icon name="check" />}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </Dialog>
  );
}

/* ---------- Download / print ---------- */
function DownloadDialog({ board, onClose }) {
  const { notify } = useApp();
  const accent = accentHex(useTheme().accent);
  const [formatValue, setFormatValue] = useState('print-a4');
  const [images, setImages] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState('');
  const format = FORMATS.find(item => item.value === formatValue);

  useEffect(() => {
    let alive = true;
    loadBoardImages(board.items).then(loaded => { if (alive) setImages(loaded); });
    return () => { alive = false; };
  }, [board.items]);

  useEffect(() => {
    if (!images) return undefined;
    let alive = true;
    renderBoard({ board, format, images, accent, scale: 420 / Math.max(format.width, format.height) })
      .then(canvas => { if (alive) setPreview(canvas.toDataURL('image/png')); });
    return () => { alive = false; };
  }, [board, format, images, accent]);

  const missing = images ? board.items.filter(item => item.type === 'image' && !images.has(item._id)).length : 0;
  const filename = `vision-${board.year}-${board.period}-${format.value}.png`;

  const run = async mode => {
    setBusy(mode);
    try {
      const canvas = await renderBoard({ board, format, images, accent });
      const blob = await canvasToBlob(canvas);
      if (mode === 'print') await printBlob(blob, format.print.size);
      else { downloadBlob(blob, filename); notify(`Saved ${filename}`); }
    } catch {
      notify('Could not create the image. Try again.');
    } finally {
      setBusy('');
    }
  };

  return (
    <Dialog
      wide
      icon="download"
      title="Download your board"
      description="High-resolution PNG, ready to print or set as your wallpaper."
      onClose={onClose}
      busy={Boolean(busy)}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={Boolean(busy)}>Close</button>
        {format.print && <button type="button" className="btn btn-tonal state-layer" onClick={() => run('print')} disabled={!images || Boolean(busy)}><Icon name="print" />{busy === 'print' ? 'Preparing…' : 'Print'}</button>}
        <button type="button" className="btn btn-filled state-layer" onClick={() => run('download')} disabled={!images || Boolean(busy)}><Icon name="download" />{busy === 'download' ? 'Creating…' : 'Download PNG'}</button>
      </>}
    >
      <div className="download-layout">
        <div className="download-preview" aria-live="polite">
          {preview
            ? <img src={preview} alt={`Preview of ${format.label}`} style={{ aspectRatio: `${format.width} / ${format.height}` }} />
            : <Spinner label="Preparing preview" />}
        </div>
        <div className="download-options" role="radiogroup" aria-label="Format">
          {['Print', 'Wallpaper'].map(group => (
            <div key={group} className="download-group">
              <span className="fieldset-legend">{group}</span>
              {FORMATS.filter(item => item.group === group).map(item => (
                <button key={item.value} type="button" role="radio" aria-checked={formatValue === item.value} className={`format-option state-layer${formatValue === item.value ? ' selected' : ''}`} onClick={() => setFormatValue(item.value)}>
                  <Icon name={item.icon} />
                  <span className="list-item-content">
                    <span className="title-small">{item.label}</span>
                    <span className="body-small text-variant">{item.detail}</span>
                  </span>
                  {formatValue === item.value && <Icon name="check_circle" filled />}
                </button>
              ))}
            </div>
          ))}
          {missing > 0 && <p className="body-small text-error">{plural(missing, 'image')} couldn’t be loaded and will show as blank tiles.</p>}
        </div>
      </div>
    </Dialog>
  );
}

/* ---------- New board (from the sidebar's "Add vision board") ---------- */
function NewBoardDialog({ initialYear, onClose, onCreate }) {
  const [year, setYear] = useState(initialYear);
  const [period, setPeriod] = useState('year');
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('lime');
  const [busy, setBusy] = useState(false);

  const create = async event => {
    event.preventDefault();
    setBusy(true);
    const ok = await onCreate({ year, period, title: title.trim(), theme });
    if (ok) onClose(); else setBusy(false);
  };

  return (
    <Dialog
      as="form"
      onSubmit={create}
      icon="auto_awesome_mosaic"
      title="New vision board"
      description="Pick the season you’re dreaming about. You can have one board per year, half and quarter."
      onClose={onClose}
      busy={busy}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-filled state-layer" disabled={busy}>{busy ? 'Creating…' : 'Create board'}</button>
      </>}
    >
      <div className="field-row">
        <TextField as="select" label="Year" value={year} onChange={event => setYear(Number(event.target.value))}>
          {Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, index) => MIN_YEAR + index).map(value => <option key={value} value={value}>{value}</option>)}
        </TextField>
        <TextField as="select" label="Period" value={period} onChange={event => setPeriod(event.target.value)}>
          {PERIOD_GROUPS.flatMap(group => group.values).map(value => <option key={value} value={value}>{periodOf(value).label}{periodOf(value).short !== periodOf(value).label ? ` (${periodOf(value).short})` : ''}</option>)}
        </TextField>
      </div>
      <p className="body-small text-variant new-board-range">{rangeLabel(year, period)}</p>
      <TextField label="Title (optional)" value={title} onChange={event => setTitle(event.target.value)} maxLength={60} placeholder={defaultTitle(year, period)} data-autofocus />
      <fieldset className="plain-fieldset">
        <legend className="fieldset-legend">Theme</legend>
        <div className="swatch-row" role="radiogroup" aria-label="Board theme">
          {THEMES.map(option => (
            <button key={option.value} type="button" role="radio" aria-checked={theme === option.value} aria-label={option.label} title={option.label} className={`swatch state-layer${theme === option.value ? ' selected' : ''}`} style={{ background: option.swatch }} onClick={() => setTheme(option.value)} />
          ))}
        </div>
      </fieldset>
    </Dialog>
  );
}

/* ---------- Page ---------- */
export default function Vision() {
  const { notify } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const fileInput = useRef(null);
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [period, setPeriod] = useState('year');
  const [board, setBoard] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [dialog, setDialog] = useState(null); // { type: 'gallery' | 'words' | 'edit' | 'download' | 'remove', item? }
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [boardResponse, listResponse] = await Promise.all([
        API.get('/vision', { params: { year, period } }),
        API.get('/vision/boards', { params: { year } })
      ]);
      setBoard(boardResponse.data.board);
      setTitle(boardResponse.data.board.title || '');
      setSummaries(listResponse.data.boards || []);
    } catch (loadError) {
      setError(apiError(loadError, 'Could not load your vision board.'));
    } finally {
      setLoading(false);
    }
  }, [year, period]);
  useEffect(() => { load(); }, [load]);

  // Sidebar "Add vision board" → /board?new=1
  useEffect(() => {
    if (params.get('new')) { setDialog({ type: 'new' }); setParams({}, { replace: true }); }
  }, [params, setParams]);

  const countFor = value => summaries.find(summary => summary.period === value)?.count || 0;
  const applyBoard = next => {
    setBoard(next);
    setSummaries(current => {
      const others = current.filter(summary => summary.period !== next.period);
      return [...others, { period: next.period, count: next.items.length }];
    });
  };

  const addItem = async (item, { silent = false } = {}) => {
    try {
      const response = await API.post('/vision/items', { year, period, item });
      applyBoard(response.data.board);
      if (!silent) notify('Added to your board');
      return true;
    } catch (addError) {
      notify(apiError(addError, 'Could not add this to your board.'));
      return false;
    }
  };

  /** Adds several gallery pins in order; stops at the first failure (e.g. board full). */
  const addMany = async items => {
    let added = 0;
    for (const item of items) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await addItem(item, { silent: true }))) break;
      added += 1;
    }
    if (added) notify(`Added ${plural(added, 'image')} to your board`);
    return added;
  };

  const createBoard = async ({ year: nextYear, period: nextPeriod, title: nextTitle, theme }) => {
    try {
      await API.put('/vision', { year: nextYear, period: nextPeriod, title: nextTitle, theme });
      setYear(nextYear);
      setPeriod(nextPeriod);
      if (nextYear === year && nextPeriod === period) load();
      notify('Board ready — now get inspired');
      return true;
    } catch (createError) {
      notify(apiError(createError, 'Could not create the board.'));
      return false;
    }
  };

  const turnIntoGoal = item => {
    const title = (item.type === 'text' ? item.text : item.caption || '').slice(0, 100);
    navigate(`/goals?new=1&title=${encodeURIComponent(title)}`);
  };

  const updateItem = async (item, changes) => {
    try {
      const response = await API.patch(`/vision/${board._id}/items/${item._id}`, changes);
      applyBoard(response.data.board);
      return true;
    } catch (updateError) {
      notify(apiError(updateError, 'Could not update this item.'));
      return false;
    }
  };

  const removeItem = async item => {
    try {
      const response = await API.delete(`/vision/${board._id}/items/${item._id}`);
      applyBoard(response.data.board);
      notify('Removed from your board');
    } catch (removeError) {
      notify(apiError(removeError, 'Could not remove this item.'));
    }
    setDialog(null);
  };

  const move = async (index, delta) => {
    const items = [...board.items];
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    setBoard(current => ({ ...current, items })); // optimistic
    try {
      const response = await API.put(`/vision/${board._id}/order`, { order: items.map(item => item._id) });
      setBoard(response.data.board);
    } catch (moveError) {
      notify(apiError(moveError, 'Could not reorder your board.'));
      load();
    }
  };

  const saveSettings = async changes => {
    try {
      const response = await API.put('/vision', { year, period, ...changes });
      applyBoard(response.data.board);
    } catch (saveError) {
      notify(apiError(saveError, 'Could not save your board.'));
    }
  };

  const commitTitle = () => {
    const next = title.trim();
    if (next !== (board?.title || '')) saveSettings({ title: next });
  };

  const upload = async event => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (!files.length) return;
    setUploading(true);
    for (const file of files.slice(0, 10)) {
      if (!file.type.startsWith('image/')) { notify(`${file.name} isn’t an image.`); continue; }
      try {
        const { dataUrl, width, height } = await resizeUpload(file);
        // eslint-disable-next-line no-await-in-loop
        await addItem({ type: 'image', source: 'upload', imageUrl: dataUrl, width, height });
      } catch {
        notify(`Couldn’t read ${file.name}. Try a JPEG or PNG.`);
      }
    }
    setUploading(false);
  };

  const currentPeriod = periodOf(period);
  const placeholderTitle = defaultTitle(year, period);
  const items = board?.items || [];
  const themeClass = `vision-board theme-${board?.theme || 'lime'}`;

  const addActions = (
    <div className="vision-add-actions">
      <button type="button" className="btn btn-filled state-layer" onClick={() => setDialog({ type: 'gallery' })}><Icon name="image_search" />Find images</button>
      <button type="button" className="btn btn-outlined state-layer" onClick={() => fileInput.current?.click()} disabled={uploading}><Icon name="upload" />{uploading ? 'Uploading…' : 'Upload'}</button>
      <button type="button" className="btn btn-outlined state-layer" onClick={() => setDialog({ type: 'words' })}><Icon name="format_quote" />Add words</button>
    </div>
  );

  const sortedPeriods = useMemo(() => PERIOD_GROUPS.map(group => ({ ...group, periods: group.values.map(periodOf) })), []);

  return (
    <div className="page vision-page">
      <header className="page-header">
        <div>
          <h1 className="headline-medium">Imagine your future<span className="italic-accent">.</span></h1>
        </div>
        <button type="button" className="btn btn-outlined state-layer" onClick={() => setDialog({ type: 'download' })} disabled={!items.length}><Icon name="download" />Download</button>
      </header>

      <ol className="vision-steps" role="list" aria-label="How it works">
        <li className="vision-step"><span className="vision-step-num">1</span><span className="vision-step-text"><strong className="title-small">Imagine</strong><span className="body-small text-variant">Name your season and write the words you want to live by.</span></span></li>
        <li><button type="button" className="vision-step-link state-layer" onClick={() => setDialog({ type: 'gallery' })}><span className="vision-step-num">2</span><span className="vision-step-text"><strong className="title-small">Get inspired</strong><span className="body-small text-variant">Search Travel, Education or any topic and add images.</span></span><Icon name="arrow_forward" /></button></li>
        <li className="vision-step"><span className="vision-step-num">3</span><span className="vision-step-text"><strong className="title-small">Act</strong><span className="body-small text-variant">Turn any pin or words into a goal with daily steps.</span></span></li>
      </ol>

      <section className="card vision-controls" aria-label="Choose a board">
        <div className="year-stepper" role="group" aria-label="Year">
          <button type="button" className="icon-btn state-layer" onClick={() => setYear(value => Math.max(MIN_YEAR, value - 1))} disabled={year <= MIN_YEAR} aria-label="Previous year"><Icon name="chevron_left" /></button>
          <span className="year-value" aria-live="polite">{year}</span>
          <button type="button" className="icon-btn state-layer" onClick={() => setYear(value => Math.min(MAX_YEAR, value + 1))} disabled={year >= MAX_YEAR} aria-label="Next year"><Icon name="chevron_right" /></button>
        </div>
        <div className="period-groups" role="radiogroup" aria-label="Board period">
          {sortedPeriods.map(group => (
            <div key={group.label} className="period-group">
              <span className="label-small text-variant period-group-label">{group.label}</span>
              <div className="chip-set">
                {group.periods.map(option => {
                  const count = countFor(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={period === option.value}
                      className={`chip state-layer${period === option.value ? ' selected' : ''}`}
                      onClick={() => setPeriod(option.value)}
                      title={`${option.label} · ${rangeLabel(year, option.value)}${count ? ` · ${plural(count, 'item')}` : ''}`}
                    >
                      {option.short}
                      {count > 0 && <span className="chip-dot" aria-label={`${plural(count, 'item')}`} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? <Spinner label="Loading vision board" /> : board && (
        <section className={themeClass} aria-labelledby="board-title">
          <div className="vision-board-head">
            <div className="vision-title-block">
              <label htmlFor="board-title" className="visually-hidden">Board title</label>
              <input
                id="board-title"
                className="vision-title-input"
                value={title}
                maxLength={60}
                placeholder={placeholderTitle}
                onChange={event => setTitle(event.target.value)}
                onBlur={commitTitle}
                onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
              />
              <p className="vision-range"><span className="italic-accent">{currentPeriod.label}</span> · {rangeLabel(year, period)} · {plural(items.length, 'item')}</p>
            </div>
            <div className="theme-picker" role="radiogroup" aria-label="Board theme">
              {THEMES.map(theme => (
                <button key={theme.value} type="button" role="radio" aria-checked={(board.theme || 'lime') === theme.value} aria-label={`${theme.label} theme`} title={theme.label} className={`swatch state-layer${(board.theme || 'lime') === theme.value ? ' selected' : ''}`} style={{ background: theme.swatch }} onClick={() => saveSettings({ theme: theme.value })} />
              ))}
            </div>
          </div>

          {items.length > 0 && addActions}

          {items.length === 0 ? (
            <div className="vision-empty">
              <EmptyState icon="auto_awesome" title={`Imagine your ${currentPeriod.short === 'Full year' ? year : `${currentPeriod.short} ${year}`}`} action={addActions}>
                Open the gallery and collect pins that capture the life you’re building — places, habits, style, feelings. Then turn them into goals and act.
              </EmptyState>
            </div>
          ) : (
            <ul className="vision-grid" role="list">
              {items.map((item, index) => {
                const color = wordColor(item.color);
                return (
                  <li key={item._id} className={`vision-item${item.type === 'text' ? ' is-words' : ''}`}>
                    {item.type === 'text' ? (
                      <div className="vision-words" style={{ background: color.bg, color: color.fg }}>{item.text}</div>
                    ) : (
                      <figure className="vision-figure">
                        <img src={item.imageUrl} alt={item.caption || 'Vision board image'} loading="lazy" width={item.width || undefined} height={item.height || undefined} />
                        {item.caption && <figcaption>{item.caption}</figcaption>}
                      </figure>
                    )}
                    <div className="vision-item-menu">
                      <Menu
                        label={`Options for ${item.type === 'text' ? item.text : item.caption || 'image'}`}
                        items={[
                          { label: 'Turn into a goal', icon: 'flag', onSelect: () => turnIntoGoal(item) },
                          { label: item.type === 'text' ? 'Edit words' : item.caption ? 'Edit caption' : 'Add caption', icon: 'edit', onSelect: () => setDialog({ type: 'edit', item }) },
                          index > 0 && { label: 'Move earlier', icon: 'arrow_back', onSelect: () => move(index, -1) },
                          index < items.length - 1 && { label: 'Move later', icon: 'arrow_forward', onSelect: () => move(index, 1) },
                          { divider: true },
                          { label: 'Remove', icon: 'delete', danger: true, onSelect: () => setDialog({ type: 'remove', item }) }
                        ]}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {items.length > 0 && (
            <div className="vision-generate">
              <button type="button" className="btn btn-filled state-layer vision-generate-btn" onClick={() => setDialog({ type: 'studio' })}>
                <Icon name="dashboard_customize" />Generate vision board
              </button>
              <span className="body-small vision-generate-hint">Puts all {plural(items.length, 'card')} on one big board you can arrange and download.</span>
            </div>
          )}
        </section>
      )}

      {board && items.length > 0 && <SuggestedGoals year={year} period={period} itemCount={items.length} />}

      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/*" multiple className="visually-hidden" onChange={upload} tabIndex={-1} aria-hidden="true" />

      {dialog?.type === 'new' && <NewBoardDialog initialYear={year} onClose={() => setDialog(null)} onCreate={createBoard} />}
      {dialog?.type === 'gallery' && <GalleryDialog onClose={() => setDialog(null)} onAddMany={addMany} />}
      {dialog?.type === 'words' && <WordsDialog onClose={() => setDialog(null)} onSave={addItem} />}
      {dialog?.type === 'edit' && <WordsDialog item={dialog.item} onClose={() => setDialog(null)} onSave={changes => updateItem(dialog.item, changes)} />}
      {dialog?.type === 'download' && board && <DownloadDialog board={{ ...board, title: board.title || placeholderTitle }} onClose={() => setDialog(null)} />}
      {dialog?.type === 'studio' && board && <BoardStudio board={{ ...board, title: board.title || placeholderTitle }} onClose={() => setDialog(null)} />}
      {dialog?.type === 'remove' && (
        <ConfirmDialog title="Remove from board?" confirmLabel="Remove" onClose={() => setDialog(null)} onConfirm={() => removeItem(dialog.item)}>
          This removes it from your {currentPeriod.label.toLowerCase()} {year} board.
        </ConfirmDialog>
      )}
    </div>
  );
}
