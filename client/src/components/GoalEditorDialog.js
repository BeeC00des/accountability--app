import React, { useMemo, useState } from 'react';
import { API } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Dialog, Icon, LinearProgress, Switch, TextField } from './ui';
import { CATEGORIES, DURATIONS, EMOJIS, durationLabel } from '../lib/goals';
import { apiError, formatDate } from '../lib/format';

const STEPS = [
  { key: 'what', title: 'What do you want to achieve?', hint: 'Name it clearly so it’s easy to act on.' },
  { key: 'rhythm', title: 'Set your rhythm', hint: 'How often will you check in, and for how long?' },
  { key: 'plan', title: 'Plan and share', hint: 'Break it into steps and invite support.' }
];

const thisYear = () => new Date().getFullYear();
const fromGoal = goal => ({
  title: goal?.title || '',
  description: goal?.description || '',
  emoji: goal?.emoji || '🎯',
  category: goal?.category || 'personal',
  frequency: goal?.frequency || 'daily',
  targetDays: goal?.targetDays || 30,
  year: goal?.year || thisYear(),
  isPublic: Boolean(goal?.isPublic),
  todos: []
});

/**
 * Three-step goal editor. Creating walks through every step; editing lets you jump
 * between steps and save at any point. Steps on existing goals are managed on the goal card.
 */
export default function GoalEditorDialog({ goal, initial, onClose, onSaved }) {
  const { notify } = useApp();
  const isEdit = Boolean(goal);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => ({ ...fromGoal(goal), ...(goal ? {} : Object.fromEntries(Object.entries(initial || {}).filter(([, value]) => value))) }));
  const [todoDraft, setTodoDraft] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const titleError = touched && !form.title.trim() ? 'Give your goal a name.' : '';
  const endDate = useMemo(() => {
    const start = goal?.startDate ? new Date(goal.startDate) : new Date();
    start.setDate(start.getDate() + Number(form.targetDays));
    return start;
  }, [goal, form.targetDays]);

  const addTodo = () => {
    const title = todoDraft.trim();
    if (!title) return;
    set('todos', [...form.todos, { title, done: false }]);
    setTodoDraft('');
  };

  const canAdvance = () => {
    if (step === 0 && !form.title.trim()) { setTouched(true); return false; }
    return true;
  };
  const next = () => { if (canAdvance()) setStep(current => Math.min(current + 1, STEPS.length - 1)); };

  const save = async event => {
    event?.preventDefault();
    if (!form.title.trim()) { setTouched(true); setStep(0); return; }
    if (!isEdit && step < STEPS.length - 1) { next(); return; }
    setSaving(true);
    setError('');
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      emoji: form.emoji,
      category: form.category,
      frequency: form.frequency,
      targetDays: Number(form.targetDays),
      year: Number(form.year),
      isPublic: form.isPublic
    };
    try {
      const response = isEdit
        ? await API.patch(`/goals/${goal._id}`, payload)
        : await API.post('/goals', { ...payload, todos: form.todos });
      notify(isEdit ? 'Goal updated' : 'Goal created — your first check-in is ready');
      onSaved(response.data.goal);
    } catch (saveError) {
      setError(apiError(saveError, 'Could not save this goal.'));
      setSaving(false);
    }
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog
      as="form"
      onSubmit={save}
      wide
      title={isEdit ? 'Edit goal' : 'New goal'}
      description={current.hint}
      onClose={onClose}
      busy={saving}
      actions={<>
        {step > 0 && <button type="button" className="btn btn-text state-layer" onClick={() => setStep(step - 1)} disabled={saving}><Icon name="arrow_back" />Back</button>}
        <span className="spacer" />
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={saving}>Cancel</button>
        {isEdit && !isLast && <button type="button" className="btn btn-tonal state-layer" onClick={next} disabled={saving}>Next</button>}
        <button type="submit" className="btn btn-filled state-layer" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save' : isLast ? 'Create goal' : 'Next'}
        </button>
      </>}
    >
      <nav className="stepper" aria-label="Goal setup steps">
        <ol role="list">
          {STEPS.map((item, index) => (
            <li key={item.key}>
              <button
                type="button"
                className={`stepper-step${index === step ? ' current' : ''}${index < step ? ' done' : ''}`}
                aria-current={index === step ? 'step' : undefined}
                onClick={() => { if (index <= step || isEdit || canAdvance()) setStep(index); }}
              >
                <span className="stepper-dot">{index < step ? <Icon name="check" size="18" /> : index + 1}</span>
                <span className="stepper-label">{['Goal', 'Rhythm', 'Plan'][index]}</span>
              </button>
            </li>
          ))}
        </ol>
        <LinearProgress value={((step + 1) / STEPS.length) * 100} label={`Step ${step + 1} of ${STEPS.length}`} />
      </nav>

      {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}

      {step === 0 && (
        <div className="editor-step">
          <h3 className="title-medium editor-step-title">{current.title}</h3>
          <TextField label="Goal name" value={form.title} maxLength={100} onChange={event => set('title', event.target.value)} onBlur={() => setTouched(true)} placeholder="e.g. Run 3 times a week" error={titleError} counter={`${form.title.length}/100`} required data-autofocus />
          <TextField as="textarea" label="Why it matters (optional)" value={form.description} maxLength={500} rows={2} onChange={event => set('description', event.target.value)} placeholder="Your reason will keep you going on tough days." />
          <fieldset className="plain-fieldset">
            <legend className="title-small fieldset-legend">Icon</legend>
            <div className="emoji-grid" role="radiogroup" aria-label="Goal icon">
              {EMOJIS.map(emoji => (
                <button key={emoji} type="button" role="radio" aria-checked={form.emoji === emoji} aria-label={`Icon ${emoji}`} className={`emoji-option state-layer${form.emoji === emoji ? ' selected' : ''}`} onClick={() => set('emoji', emoji)}>{emoji}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="plain-fieldset">
            <legend className="title-small fieldset-legend">Category</legend>
            <div className="chip-set">
              {CATEGORIES.map(category => (
                <button key={category.value} type="button" className={`chip state-layer${form.category === category.value ? ' selected' : ''}`} aria-pressed={form.category === category.value} onClick={() => set('category', category.value)}>
                  <Icon name={form.category === category.value ? 'check' : category.icon} />{category.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {step === 1 && (
        <div className="editor-step">
          <h3 className="title-medium editor-step-title">{current.title}</h3>
          <fieldset className="plain-fieldset">
            <legend className="title-small fieldset-legend">Check-in rhythm</legend>
            <div className="segmented segmented-block" role="radiogroup" aria-label="Check-in rhythm">
              {[['daily', 'Daily', 'today'], ['weekly', 'Weekly', 'date_range']].map(([value, label, icon]) => (
                <button key={value} type="button" role="radio" aria-checked={form.frequency === value} className="state-layer" onClick={() => set('frequency', value)} data-autofocus={value === form.frequency ? true : undefined}>
                  <Icon name={form.frequency === value ? 'check' : icon} />{label}
                </button>
              ))}
            </div>
            <p className="body-small text-variant fieldset-help">{form.frequency === 'daily' ? 'One check-in each day. Your streak grows every day you show up.' : 'One check-in per week (Mon–Sun). Great for bigger habits.'}</p>
          </fieldset>
          <fieldset className="plain-fieldset">
            <legend className="title-small fieldset-legend">Timeframe</legend>
            <div className="chip-set">
              {DURATIONS.map(duration => (
                <button key={duration.value} type="button" className={`chip state-layer${Number(form.targetDays) === duration.value ? ' selected' : ''}`} aria-pressed={Number(form.targetDays) === duration.value} onClick={() => set('targetDays', duration.value)}>
                  {Number(form.targetDays) === duration.value && <Icon name="check" />}{duration.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="field-row">
            <TextField label="Year" type="number" min="2020" max="2100" value={form.year} onChange={event => set('year', event.target.value)} />
            <div className="summary-tile">
              <Icon name="event" />
              <div><span className="body-small text-variant">Target end date · {durationLabel(form.targetDays)}</span><strong className="title-small">{formatDate(endDate)}</strong></div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="editor-step">
          <h3 className="title-medium editor-step-title">{current.title}</h3>
          {!isEdit && (
            <section className="todo-builder" aria-labelledby="todo-builder-title">
              <div className="todo-builder-head">
                <h4 id="todo-builder-title" className="title-small">First steps <span className="text-variant body-small">Optional</span></h4>
                <span className="count-pill">{form.todos.length}</span>
              </div>
              <div className="inline-add">
                <TextField label="Add a step" value={todoDraft} maxLength={200} onChange={event => setTodoDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addTodo(); } }} placeholder="e.g. Buy running shoes" data-autofocus />
                <button type="button" className="icon-btn tonal state-layer" onClick={addTodo} disabled={!todoDraft.trim()} aria-label="Add step"><Icon name="add" /></button>
              </div>
              {form.todos.length > 0 && (
                <ul className="list draft-list" role="list">
                  {form.todos.map((todo, index) => (
                    <li key={`${todo.title}-${index}`} className="list-item">
                      <Icon name="radio_button_unchecked" className="text-variant" />
                      <span className="list-item-content list-item-headline">{todo.title}</span>
                      <button type="button" className="icon-btn state-layer" onClick={() => set('todos', form.todos.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${todo.title}`}><Icon name="close" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {isEdit && <p className="body-medium text-variant editor-note"><Icon name="info" size="20" />Add, tick off and remove steps directly on the goal card.</p>}
          <label className="setting-row" htmlFor="goal-share">
            <Icon name="group" className="text-variant" />
            <span className="setting-row-text">
              <span className="body-large">Share with friends</span>
              <span className="body-medium text-variant">Friends can see your progress and cheer you on. Notes stay private.</span>
            </span>
            <Switch id="goal-share" checked={form.isPublic} onChange={value => set('isPublic', value)} />
          </label>
        </div>
      )}
    </Dialog>
  );
}
