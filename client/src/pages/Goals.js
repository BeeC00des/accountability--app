import React, { useState, useEffect } from 'react';
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

const formatGoalDate = (dateValue) => {
  if (!dateValue) return 'No end date';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'No end date';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

const getDurationLabel = (days) => {
  const numDays = Number(days) || 30;
  const matchedPreset = DURATION_PRESETS.find(preset => preset.value === numDays);
  return matchedPreset ? matchedPreset.label : `${numDays} days`;
};

const getEndDateFromDays = (days) => {
  const targetDays = Number(days) || 30;
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + targetDays);
  return endDate;
};

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [checkInModal, setCheckInModal] = useState(null);
  const [newTodoText, setNewTodoText] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'personal',
    frequency: 'daily',
    targetDays: 30,
    year: getCurrentYear(),
    emoji: '🎯',
    isPublic: false,
    todos: []
  });
  const [checkInForm, setCheckInForm] = useState({ completed: true, note: '', mood: 'good' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadGoals = () => API.get('/goals').then(r => setGoals(r.data.goals)).finally(() => setLoading(false));
  useEffect(() => { loadGoals(); }, []);

  const updateFormValue = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const set = k => e => updateFormValue(k, ['targetDays', 'year'].includes(k) ? Number(e.target.value) : e.target.value);

  const selectPreset = (days) => updateFormValue('targetDays', Number(days));

  const addTodo = () => {
    const draft = newTodoText.trim();
    if (!draft) return;
    setForm(f => ({
      ...f,
      todos: [...(f.todos || []), { title: draft, done: false }]
    }));
    setNewTodoText('');
  };

  const removeTodo = (index) => {
    setForm(f => ({ ...f, todos: (f.todos || []).filter((_, todoIndex) => todoIndex !== index) }));
  };

  const createGoal = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await API.post('/goals', {
        ...form,
        targetDays: Number(form.targetDays),
        year: Number(form.year),
        todos: (form.todos || []).map(todo => ({ ...todo, title: String(todo.title || '').trim() })).filter(todo => todo.title)
      });
      setShowCreate(false);
      setForm({
        title: '',
        description: '',
        category: 'personal',
        frequency: 'daily',
        targetDays: 30,
        year: getCurrentYear(),
        emoji: '🎯',
        isPublic: false,
        todos: []
      });
      setNewTodoText('');
      loadGoals();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create goal.');
    } finally {
      setSaving(false);
    }
  };

  const doCheckIn = async () => {
    if (!checkInModal) return;
    setSaving(true);
    try {
      await API.post(`/goals/${checkInModal._id}/checkin`, checkInForm);
      setCheckInModal(null);
      setCheckInForm({ completed: true, note: '', mood: 'good' });
      loadGoals();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const deleteGoal = async id => {
    if (!window.confirm('Remove this goal?')) return;
    await API.delete(`/goals/${id}`);
    loadGoals();
  };

  const toggleTodo = async (goalId, todoIndex) => {
    const goal = goals.find(item => item._id === goalId);
    if (!goal) return;

    const nextTodos = (goal.todos || []).map((todo, index) => {
      if (index !== todoIndex) return todo;
      return { ...todo, done: !todo.done };
    });

    try {
      const response = await API.put(`/goals/${goalId}`, { ...goal, todos: nextTodos });
      setGoals(current => current.map(item => item._id === goalId ? response.data.goal : item));
    } catch (err) {
      console.error(err);
    }
  };

  const isCheckedToday = (goal) => {
    const today = new Date(); today.setHours(0,0,0,0);
    return (goal.checkIns || []).some(c => {
      const d = new Date(c.date); d.setHours(0,0,0,0);
      return d.getTime() === today.getTime() && c.completed;
    });
  };

  if (loading) return <div className="page" style={{ display:'flex', justifyContent:'center', paddingTop:'4rem' }}><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h2>My goals</h2>
          <p>{goals.length} active goal{goals.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New goal</button>
      </div>

      {goals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <h3>No goals yet</h3>
          <p>Create your first goal and start building a streak!</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ marginTop: '1rem' }}>Create a goal</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {goals.map(goal => {
            const done = isCheckedToday(goal);
            const pct = (goal.checkIns || []).length > 0
              ? Math.round((goal.checkIns || []).filter(c => c.completed).length / (goal.checkIns || []).length * 100)
              : 0;
            const endDate = goal.endDate || getEndDateFromDays(goal.targetDays || 30);
            return (
              <div key={goal._id} className="goal-card">
                <div className="goal-card-header">
                  <span className="goal-emoji">{goal.emoji}</span>
                  <div className="goal-info" style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text-muted)' : 'var(--text)' }}>{goal.title}</h4>
                    {goal.description && <p>{goal.description}</p>}
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: categoryColors[goal.category], fontWeight: 500, textTransform: 'capitalize' }}>{goal.category}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📅 {goal.year || getCurrentYear()}</span>
                      {goal.streak > 0 && <span className="streak" style={{ fontSize: '0.75rem' }}>🔥 {goal.streak} day streak</span>}
                      {done && <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>✓ Done today</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    {!done && (
                      <button className="btn btn-primary btn-sm" onClick={() => setCheckInModal(goal)}>Check in</button>
                    )}
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => deleteGoal(goal._id)} title="Delete goal">✕</button>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Completion rate</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {(goal.todos || []).length > 0 && (
                  <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Yearly to-dos</div>
                    {goal.todos.map((todo, index) => (
                      <label key={todo._id || `${goal._id}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}>
                        <input type="checkbox" checked={Boolean(todo.done)} onChange={() => toggleTodo(goal._id, index)} />
                        <span style={{ textDecoration: todo.done ? 'line-through' : 'none', color: todo.done ? 'var(--text-muted)' : 'var(--text)' }}>
                          {todo.title}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                <div className="goal-meta-row">
                  <span>📅 {(goal.checkIns || []).length} check-ins</span>
                  <span>⭐ Best: {goal.longestStreak || 0} days</span>
                  <span>🔄 {goal.frequency}</span>
                  <span>📆 {getDurationLabel(goal.targetDays || 30)}</span>
                  <span>⏳ Ends {formatGoalDate(endDate)}</span>
                  {goal.isPublic && <span>👥 Public</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>New goal</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={createGoal}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Goal title</label>
                  <input className="form-input" value={form.title} onChange={set('title')} placeholder="Run 5km every day" required autoFocus />
                </div>
                <div style={{ width: '100px' }}>
                  <label className="form-label">Emoji</label>
                  <select className="form-select" value={form.emoji} onChange={set('emoji')}>
                    {EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea className="form-textarea" value={form.description} onChange={set('description')} placeholder="Why this goal matters to you…" rows={2} />
              </div>

              <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={set('category')}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Year</label>
                  <input className="form-input" type="number" min={2020} max={2100} value={form.year} onChange={set('year')} />
                </div>
              </div>

              <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label">Frequency</label>
                  <select className="form-select" value={form.frequency} onChange={set('frequency')}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Duration</label>
                  <select className="form-select" value={form.targetDays} onChange={set('targetDays')}>
                    {DURATION_PRESETS.map(preset => (
                      <option key={preset.value} value={preset.value}>{preset.label}</option>
                    ))}
                    <option value={3650}>Custom</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Goal duration</label>
                <div className="duration-presets">
                  {DURATION_PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      type="button"
                      className={`duration-chip ${form.targetDays === preset.value ? 'selected' : ''}`}
                      onClick={() => selectPreset(preset.value)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="duration-summary">
                  <span>{getDurationLabel(form.targetDays)}</span>
                  <span>Ends {formatGoalDate(getEndDateFromDays(form.targetDays))}</span>
                </div>
                <label className="form-label range-label">Custom range: {form.targetDays} days</label>
                <input type="range" min={7} max={365} value={form.targetDays} onChange={set('targetDays')} style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>7 days</span><span>1 year</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Yearly to-dos</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    className="form-input"
                    value={newTodoText}
                    onChange={e => setNewTodoText(e.target.value)}
                    placeholder="Add a task for this year"
                  />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addTodo}>Add</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {(form.todos || []).length === 0 ? (
                    <small style={{ color: 'var(--text-muted)' }}>No to-dos yet. Add tasks to keep your year on track.</small>
                  ) : (
                    (form.todos || []).map((todo, index) => (
                      <div key={`${todo.title}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ flex: 1 }}>{todo.title}</span>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeTodo(index)}>Remove</button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <input type="checkbox" id="public" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} />
                <label htmlFor="public" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>Share with friends (public)</label>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Creating…' : 'Create goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {checkInModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setCheckInModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{checkInModal.emoji} {checkInModal.title}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setCheckInModal(null)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Did you complete it today?</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[true, false].map(v => (
                  <button key={String(v)} type="button"
                    className={`btn ${checkInForm.completed === v ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1 }}
                    onClick={() => setCheckInForm(f => ({ ...f, completed: v }))}>
                    {v ? '✅ Yes!' : '❌ Not today'}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">How did it feel?</label>
              <div className="mood-options">
                {MOODS.map(m => (
                  <button key={m.value} type="button"
                    className={`mood-btn ${checkInForm.mood === m.value ? 'selected' : ''}`}
                    onClick={() => setCheckInForm(f => ({ ...f, mood: m.value }))}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Note (optional)</label>
              <textarea className="form-textarea" value={checkInForm.note} onChange={e => setCheckInForm(f => ({ ...f, note: e.target.value }))} placeholder="How did it go? Any reflections…" rows={2} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setCheckInModal(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={doCheckIn} disabled={saving}>
                {saving ? 'Saving…' : 'Save check-in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
