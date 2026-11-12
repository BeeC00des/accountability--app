import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../context/AuthContext';

const CATEGORIES = ['fitness', 'learning', 'health', 'career', 'personal', 'finance', 'other'];
const EMOJIS = ['🎯', '💪', '📚', '🏃', '🧘', '💼', '💰', '🌱', '✍️', '🎨', '🎵', '🍎'];
const MOODS = [{ label: '🚀 Great', value: 'great' }, { label: '😊 Good', value: 'good' }, { label: '😐 Okay', value: 'okay' }, { label: '😔 Tough', value: 'tough' }];
const DURATION_PRESETS = [
  { label: '1 week', value: 7 },
  { label: '1 month', value: 30 },
  { label: '3 months', value: 90 },
  { label: '6 months', value: 180 },
  { label: '1 year', value: 365 },
];

const categoryColors = {
  fitness: '#4ade80', learning: '#60a5fa', health: '#f472b6',
  career: '#a78bfa', personal: '#fb923c', finance: '#34d399', other: '#888'
};
const getCurrentYear = () => new Date().getFullYear();
const formatGoalDate = value => {
  if (!value) return 'No end date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No end date' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};
const getDurationLabel = days => {
  const value = Number(days) || 30;
  return DURATION_PRESETS.find(preset => preset.value === value)?.label || `${value} days`;
};
const getEndDateFromDays = days => {
  const date = new Date();
  date.setDate(date.getDate() + (Number(days) || 30));
  return date;
};
const emptyForm = () => ({ title: '', description: '', category: 'personal', frequency: 'daily', targetDays: 365, year: getCurrentYear(), emoji: '🎯', isPublic: false, todos: [] });

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [checkInModal, setCheckInModal] = useState(null);
  const [newTodoText, setNewTodoText] = useState('');
  const [todoDrafts, setTodoDrafts] = useState({});
  const [savingTodo, setSavingTodo] = useState('');
  const [selectedYear, setSelectedYear] = useState(String(getCurrentYear()));
  const [form, setForm] = useState(emptyForm);
  const [checkInForm, setCheckInForm] = useState({ completed: true, note: '', mood: 'good' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadGoals = async () => {
    try {
      setLoadError('');
      const response = await API.get('/goals');
      setGoals(response.data.goals || []);
    } catch (err) {
      setLoadError('We couldn’t load your goals. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadGoals(); }, []);

  const years = useMemo(() => [...new Set([getCurrentYear(), ...goals.map(goal => goal.year || getCurrentYear())])].sort((a, b) => b - a), [goals]);
  const visibleGoals = useMemo(() => selectedYear === 'all'
    ? goals
    : goals.filter(goal => (goal.year || getCurrentYear()) === Number(selectedYear)), [goals, selectedYear]);
  const yearTodos = visibleGoals.flatMap(goal => goal.todos || []);
  const completedTodos = yearTodos.filter(todo => todo.done).length;

  const updateFormValue = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const set = key => event => updateFormValue(key, ['targetDays', 'year'].includes(key) ? Number(event.target.value) : event.target.value);
  const selectPreset = days => updateFormValue('targetDays', Number(days));

  const addTodo = () => {
    const title = newTodoText.trim();
    if (!title) return;
    setForm(current => ({ ...current, todos: [...current.todos, { title, done: false }] }));
    setNewTodoText('');
  };
  const removeTodo = index => setForm(current => ({ ...current, todos: current.todos.filter((_, itemIndex) => itemIndex !== index) }));

  const createGoal = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await API.post('/goals', {
        ...form,
        targetDays: Number(form.targetDays),
        year: Number(form.year),
        todos: form.todos.map(todo => ({ ...todo, title: todo.title.trim() })).filter(todo => todo.title)
      });
      setShowCreate(false);
      setForm(emptyForm());
      setNewTodoText('');
      await loadGoals();
    } catch (err) {
      const validationMessage = err.response?.data?.errors?.[0]?.msg;
      setError(validationMessage || err.response?.data?.message || 'Could not create this goal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const doCheckIn = async () => {
    if (!checkInModal) return;
    setSaving(true);
    setError('');
    try {
      await API.post(`/goals/${checkInModal._id}/checkin`, checkInForm);
      setCheckInModal(null);
      setCheckInForm({ completed: true, note: '', mood: 'good' });
      await loadGoals();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save your check-in. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteGoal = async id => {
    if (!window.confirm('Remove this goal?')) return;
    try {
      await API.delete(`/goals/${id}`);
      await loadGoals();
    } catch {
      setLoadError('Could not remove this goal. Please try again.');
    }
  };

  const saveTodos = async (goal, todos) => {
    setSavingTodo(goal._id);
    try {
      const response = await API.put(`/goals/${goal._id}`, { ...goal, todos });
      setGoals(current => current.map(item => item._id === goal._id ? response.data.goal : item));
      return true;
    } catch {
      setLoadError('Could not update this to-do. Please try again.');
      return false;
    } finally {
      setSavingTodo('');
    }
  };

  const toggleTodo = async (goal, todoIndex) => {
    const todos = (goal.todos || []).map((todo, index) => index === todoIndex ? { ...todo, done: !todo.done } : todo);
    await saveTodos(goal, todos);
  };

  const addCardTodo = async goal => {
    const title = (todoDrafts[goal._id] || '').trim();
    if (!title) return;
    const success = await saveTodos(goal, [...(goal.todos || []), { title, done: false }]);
    if (success) setTodoDrafts(current => ({ ...current, [goal._id]: '' }));
  };

  const isCheckedToday = goal => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (goal.checkIns || []).some(checkIn => {
      const date = new Date(checkIn.date);
      date.setHours(0, 0, 0, 0);
      return date.getTime() === today.getTime() && checkIn.completed;
    });
  };

  if (loading) return <div className="page loading-state"><div className="spinner" role="status" aria-label="Loading goals" /></div>;

  return (
    <div className="page goals-page">
      <header className="page-header goals-header">
        <div>
          <span className="eyebrow">MAKE THIS YEAR COUNT</span>
          <h2>My goals</h2>
          <p>Turn the things you care about into small, trackable steps.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setError(''); setShowCreate(true); }}>＋ Create a goal</button>
      </header>

      {loadError && <div className="alert alert-error" role="alert">{loadError} <button type="button" className="inline-link" onClick={loadGoals}>Try again</button></div>}

      <section className="goal-overview" aria-label="Goal overview">
        <div className="goal-overview-copy"><span className="goal-overview-icon">🌱</span><div><strong>{selectedYear === 'all' ? 'All your goals' : `${selectedYear} at a glance`}</strong><p>A little progress, repeated, adds up.</p></div></div>
        <div className="goal-overview-stats">
          <div><strong>{visibleGoals.length}</strong><span>goals</span></div>
          <div><strong>{completedTodos}<small>/{yearTodos.length}</small></strong><span>to-dos done</span></div>
        </div>
      </section>

      <div className="goals-toolbar">
        <div><h3>{selectedYear === 'all' ? 'Your goals' : `${selectedYear} goals`}</h3><span>{visibleGoals.length} {visibleGoals.length === 1 ? 'goal' : 'goals'}</span></div>
        <div className="goals-toolbar-actions">
          <label className="visually-hidden" htmlFor="goal-year-filter">Filter goals by year</label>
          <select id="goal-year-filter" className="form-select goals-year-filter" value={selectedYear} onChange={event => setSelectedYear(event.target.value)}>
            <option value="all">All years</option>
            {years.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => { setError(''); setShowCreate(true); }}>＋ New goal</button>
        </div>
      </div>

      {visibleGoals.length === 0 ? (
        <div className="empty-state card goals-empty">
          <div className="empty-icon" aria-hidden="true">🎯</div>
          <h3>{goals.length ? `No goals for ${selectedYear}` : 'Start with one meaningful goal'}</h3>
          <p>{goals.length ? 'Choose another year or create a goal for this one.' : 'Give your goal a clear name, then break it into smaller tasks you can finish.'}</p>
          <button className="btn btn-primary" onClick={() => { setError(''); setShowCreate(true); }}>Create your first goal</button>
        </div>
      ) : (
        <div className="goals-list">
          {visibleGoals.map(goal => {
            const doneToday = isCheckedToday(goal);
            const checkIns = goal.checkIns || [];
            const completion = checkIns.length ? Math.round(checkIns.filter(item => item.completed).length / checkIns.length * 100) : 0;
            const todos = goal.todos || [];
            const todoCount = todos.filter(todo => todo.done).length;
            const endDate = goal.endDate || getEndDateFromDays(goal.targetDays || 30);
            return (
              <article key={goal._id} className="goal-card">
                <div className="goal-card-header">
                  <span className="goal-emoji" aria-hidden="true">{goal.emoji || '🎯'}</span>
                  <div className="goal-info">
                    <div className="goal-title-row"><h4>{goal.title}</h4>{doneToday && <span className="badge badge-success">✓ Done today</span>}</div>
                    {goal.description && <p>{goal.description}</p>}
                    <div className="goal-tags">
                      <span className="goal-category" style={{ '--category-color': categoryColors[goal.category] || categoryColors.other }}>{goal.category || 'personal'}</span>
                      <span className="badge badge-accent">{goal.year || getCurrentYear()}</span>
                      <span>{goal.frequency === 'weekly' ? 'Weekly' : 'Daily'}</span>
                      {(goal.streak || 0) > 0 && <span className="streak">🔥 {goal.streak} {goal.frequency === 'weekly' ? 'week' : 'day'} streak</span>}
                    </div>
                  </div>
                  <div className="goal-actions">
                    {!doneToday && <button className="btn btn-primary btn-sm" onClick={() => { setError(''); setCheckInModal(goal); }}>Check in</button>}
                    <button className="btn btn-ghost btn-icon goal-delete" onClick={() => deleteGoal(goal._id)} title={`Delete ${goal.title}`} aria-label={`Delete ${goal.title}`}>✕</button>
                  </div>
                </div>

                <div className="goal-progress-block">
                  <div className="goal-progress-label"><span>Check-in progress</span><strong>{completion}%</strong></div>
                  <div className="progress-bar" role="progressbar" aria-label={`${goal.title} completion rate`} aria-valuenow={completion} aria-valuemin="0" aria-valuemax="100"><div className="progress-fill" style={{ width: `${completion}%` }} /></div>
                </div>

                <section className="goal-todos" aria-label={`To-dos for ${goal.title}`}>
                  <div className="goal-todos-heading"><div><h5>Next steps</h5><span>{todoCount} of {todos.length} complete</span></div>{todos.length > 0 && <span className="todo-count-badge">{todos.length}</span>}</div>
                  {todos.length > 0 && <div className="goal-todo-list">
                    {todos.map((todo, index) => <label key={todo._id || `${goal._id}-${index}`} className={`goal-todo${todo.done ? ' complete' : ''}`}>
                      <input type="checkbox" checked={Boolean(todo.done)} onChange={() => toggleTodo(goal, index)} disabled={savingTodo === goal._id} />
                      <span>{todo.title}</span>
                    </label>)}
                  </div>}
                  <form className="goal-add-todo" onSubmit={event => { event.preventDefault(); addCardTodo(goal); }}>
                    <label className="visually-hidden" htmlFor={`todo-${goal._id}`}>Add a next step to {goal.title}</label>
                    <input id={`todo-${goal._id}`} className="form-input" value={todoDrafts[goal._id] || ''} maxLength={200} onChange={event => setTodoDrafts(current => ({ ...current, [goal._id]: event.target.value }))} placeholder="Add a next step…" />
                    <button className="btn btn-ghost btn-sm" type="submit" disabled={savingTodo === goal._id || !(todoDrafts[goal._id] || '').trim()}>{savingTodo === goal._id ? 'Saving…' : 'Add task'}</button>
                  </form>
                </section>

                <footer className="goal-meta-row"><span>📅 {checkIns.length} check-ins</span><span>⭐ Best: {goal.longestStreak || 0} {goal.frequency === 'weekly' ? 'weeks' : 'days'}</span><span>📆 {getDurationLabel(goal.targetDays || 30)}</span><span>⏳ Ends {formatGoalDate(endDate)}</span>{goal.isPublic && <span>👥 Shared with friends</span>}</footer>
              </article>
            );
          })}
        </div>
      )}

      {showCreate && <div className="modal-backdrop" onClick={event => event.target === event.currentTarget && !saving && setShowCreate(false)}>
        <section className="modal goal-modal" role="dialog" aria-modal="true" aria-labelledby="create-goal-title">
          <div className="modal-header"><div><span className="eyebrow">A GOOD PLAN STARTS SMALL</span><h3 id="create-goal-title">Create a goal</h3></div><button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)} aria-label="Close" disabled={saving}>✕</button></div>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <form onSubmit={createGoal}>
            <div className="form-group"><label className="form-label" htmlFor="goal-title">What do you want to achieve?</label><input id="goal-title" className="form-input" value={form.title} onChange={set('title')} placeholder="e.g. Build a consistent fitness routine" maxLength={100} required autoFocus /></div>
            <div className="form-group"><label className="form-label" htmlFor="goal-description">Why does it matter? <span className="optional-label">Optional</span></label><textarea id="goal-description" className="form-textarea" value={form.description} onChange={set('description')} placeholder="A little context can help you stay focused…" maxLength={500} rows={2} /></div>
            <div className="goal-form-grid">
              <div className="form-group"><label className="form-label" htmlFor="goal-category">Category</label><select id="goal-category" className="form-select" value={form.category} onChange={set('category')}>{CATEGORIES.map(category => <option key={category} value={category}>{category.charAt(0).toUpperCase() + category.slice(1)}</option>)}</select></div>
              <div className="form-group"><label className="form-label" htmlFor="goal-year">Year</label><input id="goal-year" className="form-input" type="number" min="2020" max="2100" value={form.year} onChange={set('year')} required /></div>
              <div className="form-group"><label className="form-label" htmlFor="goal-frequency">Check-in rhythm</label><select id="goal-frequency" className="form-select" value={form.frequency} onChange={set('frequency')}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>
              <div className="form-group"><label className="form-label" htmlFor="goal-emoji">Choose an icon</label><select id="goal-emoji" className="form-select" value={form.emoji} onChange={set('emoji')}>{EMOJIS.map(emoji => <option key={emoji} value={emoji}>{emoji}</option>)}</select></div>
            </div>
            <div className="form-group"><div className="goal-form-section-title"><label className="form-label">Timeframe</label><span>{getDurationLabel(form.targetDays)}</span></div><div className="duration-presets">{DURATION_PRESETS.map(preset => <button key={preset.value} type="button" className={`duration-chip ${form.targetDays === preset.value ? 'selected' : ''}`} aria-pressed={form.targetDays === preset.value} onClick={() => selectPreset(preset.value)}>{preset.label}</button>)}</div><div className="duration-summary"><span>Target end date</span><strong>{formatGoalDate(getEndDateFromDays(form.targetDays))}</strong></div></div>
            <section className="goal-form-todos"><div className="goal-form-section-title"><div><h4>Break it into steps</h4><p>Add a few small tasks to make progress easier.</p></div><span className="todo-count-badge">{form.todos.length}</span></div><div className="goal-add-todo"><label className="visually-hidden" htmlFor="new-goal-todo">Add a goal task</label><input id="new-goal-todo" className="form-input" value={newTodoText} maxLength={200} onChange={event => setNewTodoText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addTodo(); } }} placeholder="e.g. Schedule a weekly workout" /><button type="button" className="btn btn-ghost btn-sm" onClick={addTodo} disabled={!newTodoText.trim()}>Add</button></div>{form.todos.length > 0 && <ul className="goal-draft-todos">{form.todos.map((todo, index) => <li key={`${todo.title}-${index}`}><span>{todo.title}</span><button type="button" className="inline-link" onClick={() => removeTodo(index)} aria-label={`Remove ${todo.title}`}>Remove</button></li>)}</ul>}</section>
            <label className="goal-share-toggle"><input type="checkbox" checked={form.isPublic} onChange={event => setForm(current => ({ ...current, isPublic: event.target.checked }))} /><span><strong>Share with friends</strong><small>Let your friends see and encourage your progress.</small></span></label>
            <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving || !form.title.trim()}>{saving ? 'Creating…' : 'Create goal'}</button></div>
          </form>
        </section>
      </div>}

      {checkInModal && <div className="modal-backdrop" onClick={event => event.target === event.currentTarget && !saving && setCheckInModal(null)}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
          <div className="modal-header"><div><span className="eyebrow">YOUR PROGRESS COUNTS</span><h3 id="checkin-title">{checkInModal.emoji} Check in</h3><p className="checkin-goal-title">{checkInModal.title}</p></div><button type="button" className="btn btn-ghost btn-icon" onClick={() => setCheckInModal(null)} aria-label="Close" disabled={saving}>✕</button></div>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="form-group"><span className="form-label">How did it go?</span><div className="checkin-choice-row">{[true, false].map(value => <button key={String(value)} type="button" className={`btn ${checkInForm.completed === value ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={checkInForm.completed === value} onClick={() => setCheckInForm(current => ({ ...current, completed: value }))}>{value ? '✓ I did it' : 'Not this time'}</button>)}</div></div>
          <div className="form-group"><span className="form-label">How did it feel?</span><div className="mood-options">{MOODS.map(mood => <button key={mood.value} type="button" className={`mood-btn ${checkInForm.mood === mood.value ? 'selected' : ''}`} aria-pressed={checkInForm.mood === mood.value} onClick={() => setCheckInForm(current => ({ ...current, mood: mood.value }))}>{mood.label}</button>)}</div></div>
          <div className="form-group"><label className="form-label" htmlFor="checkin-note">Add a note <span className="optional-label">Optional</span></label><textarea id="checkin-note" className="form-textarea" value={checkInForm.note} maxLength={300} onChange={event => setCheckInForm(current => ({ ...current, note: event.target.value }))} placeholder="Anything you want to remember?" rows={3} /></div>
          <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setCheckInModal(null)} disabled={saving}>Cancel</button><button className="btn btn-primary" onClick={doCheckIn} disabled={saving}>{saving ? 'Saving…' : 'Save check-in'}</button></div>
        </section>
      </div>}
    </div>
  );
}
