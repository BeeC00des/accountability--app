import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API, useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { ConfirmDialog, EmptyState, ErrorBanner, Icon, LinearProgress, Menu, Spinner } from '../components/ui';
import CheckInDialog from '../components/CheckInDialog';
import GoalEditorDialog from '../components/GoalEditorDialog';
import { apiError, formatDate, plural } from '../lib/format';
import { categoryOf, durationLabel, periodLabel, periodWord, tileClass } from '../lib/goals';

const FILTERS = [
  { value: 'active', label: 'Active', icon: 'radio_button_checked' },
  { value: 'completed', label: 'Completed', icon: 'task_alt' },
  { value: 'all', label: 'All', icon: 'list' }
];

const daysBetween = (start, end) => Math.max(0, Math.round((end - start) / 86400000));

function GoalSteps({ goal, onChange }) {
  const { notify } = useApp();
  const { user, updateUser } = useAuth();
  const [open, setOpen] = useState(goal.todoProgress.total > 0 && goal.todoProgress.done < goal.todoProgress.total);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState('');

  const run = async (key, request, failure) => {
    setBusy(key);
    try {
      const response = await request();
      onChange(response.data.goal);
      // Finishing a step counts toward today's streak (Duolingo-style).
      if (response.data.user) {
        const extended = response.data.user.streakToday && !user?.streakToday;
        updateUser(response.data.user);
        if (extended) notify(`🔥 Streak extended — ${response.data.user.streak} ${response.data.user.streak === 1 ? 'day' : 'days'}!`);
      }
      return true;
    } catch (error) {
      notify(apiError(error, failure));
      return false;
    } finally {
      setBusy('');
    }
  };

  const add = async event => {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    if (await run('add', () => API.post(`/goals/${goal._id}/todos`, { title }), 'Could not add this step.')) setDraft('');
  };

  const { done, total } = goal.todoProgress;
  return (
    <section className="goal-steps" aria-label={`Steps for ${goal.title}`}>
      <button type="button" className="goal-steps-toggle state-layer" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <Icon name="checklist" className="text-variant" />
        <span className="label-large">Steps</span>
        <span className="body-small text-variant">{total ? `${done} of ${total} done` : 'Break it down'}</span>
        <span className="top-app-bar-spacer" />
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-variant" />
      </button>
      {open && (
        <div className="goal-steps-body">
          {total > 0 && (
            <ul className="list step-list" role="list">
              {goal.todos.map(todo => (
                <li key={todo._id} className={`list-item step-item${todo.done ? ' is-done' : ''}`}>
                  <input
                    type="checkbox"
                    id={`step-${todo._id}`}
                    checked={Boolean(todo.done)}
                    disabled={busy === todo._id}
                    onChange={() => run(todo._id, () => API.patch(`/goals/${goal._id}/todos/${todo._id}`, { done: !todo.done }), 'Could not update this step.')}
                  />
                  <label htmlFor={`step-${todo._id}`} className="list-item-content body-medium">{todo.title}{todo.dueDate && <span className={`step-due${!todo.done && new Date(todo.dueDate) < new Date(new Date().toDateString()) ? ' overdue' : ''}`}><Icon name="event" size="14" />{formatDate(todo.dueDate, { day: 'numeric', month: 'short' })}</span>}{todo.addedByName && <span className="step-by">from {todo.addedByName}</span>}</label>
                  <button type="button" className="icon-btn state-layer step-remove" aria-label={`Remove step ${todo.title}`} disabled={busy === todo._id} onClick={() => run(todo._id, () => API.delete(`/goals/${goal._id}/todos/${todo._id}`), 'Could not remove this step.')}>
                    <Icon name="delete" size="20" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="step-add" onSubmit={add}>
            <Icon name="add" className="text-variant" />
            <label className="visually-hidden" htmlFor={`new-step-${goal._id}`}>Add a step to {goal.title}</label>
            <input id={`new-step-${goal._id}`} className="step-add-input body-medium" value={draft} maxLength={200} placeholder="Add a step" onChange={event => setDraft(event.target.value)} />
            {draft.trim() && <button type="submit" className="btn btn-text btn-sm state-layer" disabled={busy === 'add'}>{busy === 'add' ? 'Adding…' : 'Add'}</button>}
          </form>
        </div>
      )}
    </section>
  );
}

function GoalCard({ goal, onCheckIn, onEdit, onToggleComplete, onDelete, onChange }) {
  const category = categoryOf(goal.category);
  const now = new Date();
  const start = new Date(goal.startDate);
  const end = goal.endDate ? new Date(goal.endDate) : null;
  const totalDays = goal.targetDays || (end ? daysBetween(start, end) : 30);
  const elapsed = Math.max(0, Math.min(totalDays, daysBetween(start, now) + 1));
  const timeline = Math.round((elapsed / totalDays) * 100);

  return (
    <article className={`card card-outlined goal-card${goal.isCompleted ? ' is-completed' : ''}`}>
      <div className="goal-card-top">
        <span className={`tile tile-lg ${tileClass(goal)}`} aria-hidden="true">{goal.emoji || '🎯'}</span>
        <div className="goal-card-heading">
          <h3 className="title-medium">{goal.title}</h3>
          {goal.createdByExpertName && <p className="body-small step-by goal-by"><Icon name="badge" size="16" />Drafted by {goal.createdByExpertName}</p>}
          {goal.description && <p className="body-medium text-variant clamp-2">{goal.description}</p>}
          <div className="goal-tags">
            <span className="tag"><Icon name={category.icon} />{category.label}</span>
            <span className="tag"><Icon name={goal.frequency === 'weekly' ? 'date_range' : 'today'} />{goal.frequency === 'weekly' ? 'Weekly' : 'Daily'}</span>
            {goal.startDate && end && <span className="tag"><Icon name="event" />{formatDate(start, { day: 'numeric', month: 'short' })} – {formatDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
            {goal.isPublic && <span className="tag tag-primary"><Icon name="group" />Shared</span>}
            {goal.streak > 0 && <span className="tag tag-warning"><Icon name="local_fire_department" filled />{plural(goal.streak, periodWord(goal))}</span>}
            {goal.isCompleted && <span className="tag tag-success"><Icon name="emoji_events" filled />Completed {formatDate(goal.completedAt, { month: 'short', day: 'numeric' })}</span>}
          </div>
        </div>
        <Menu
          label={`More actions for ${goal.title}`}
          items={[
            { label: 'Edit', icon: 'edit', onSelect: onEdit },
            goal.checkedInThisPeriod && !goal.isCompleted && { label: 'Edit check-in', icon: 'edit_note', onSelect: onCheckIn },
            { label: goal.isCompleted ? 'Reopen goal' : 'Mark as completed', icon: goal.isCompleted ? 'replay' : 'emoji_events', onSelect: onToggleComplete },
            { divider: true },
            { label: 'Delete', icon: 'delete', danger: true, onSelect: onDelete }
          ]}
        />
      </div>

      <div className="goal-metrics">
        <div className="goal-metric">
          <div className="goal-metric-label"><span className="body-small text-variant">Consistency</span><span className="label-large">{goal.completionRate}%</span></div>
          <LinearProgress value={goal.completionRate} label={`${goal.title} consistency`} />
        </div>
        <div className="goal-metric">
          <div className="goal-metric-label"><span className="body-small text-variant">{start > now ? `Starts ${formatDate(start, { month: 'short', day: 'numeric' })}` : `Day ${elapsed} of ${totalDays}`}</span><span className="body-small text-variant">{end ? `Ends ${formatDate(end, { month: 'short', day: 'numeric' })}` : durationLabel(totalDays)}</span></div>
          <LinearProgress value={timeline} label={`${goal.title} timeline`} />
        </div>
      </div>

      <GoalSteps goal={goal} onChange={onChange} />

      <footer className="goal-card-footer">
        <span className="body-small text-variant">
          {plural(goal.completedCheckIns, 'check-in')} · Best {plural(goal.longestStreak || 0, periodWord(goal))}
        </span>
        {!goal.isCompleted && (goal.checkedInThisPeriod
          ? <button type="button" className="btn btn-tonal state-layer" onClick={onCheckIn}><Icon name="check_circle" filled />Done {periodLabel(goal)}</button>
          : <button type="button" className="btn btn-filled state-layer" onClick={onCheckIn}><Icon name="check" />Check in</button>)}
      </footer>
    </article>
  );
}

export default function Goals() {
  const { notify } = useApp();
  const [params, setParams] = useSearchParams();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active');
  const [year, setYear] = useState('all');
  const [editor, setEditor] = useState(null); // { goal?: Goal }
  const [checkInGoal, setCheckInGoal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await API.get('/goals', { params: { status: 'all' } });
      setGoals(response.data.goals || []);
    } catch (loadError) {
      setError(apiError(loadError, 'Could not load your goals.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Deep links: /goals?new=1 opens the editor, /goals?checkin=<id> opens a check-in.
  useEffect(() => {
    if (loading) return;
    const checkinId = params.get('checkin');
    if (params.get('new')) setEditor({ initial: { title: params.get('title') || '', emoji: params.get('emoji') || undefined } });
    else if (checkinId) {
      const goal = goals.find(item => item._id === checkinId);
      if (goal && !goal.isCompleted) setCheckInGoal(goal);
      else notify('That goal is no longer active.');
    } else return;
    setParams({}, { replace: true });
  }, [loading, params, goals, setParams, notify]);

  const replaceGoal = updated => setGoals(current => current.map(goal => (goal._id === updated._id ? updated : goal)));

  const years = useMemo(() => [...new Set(goals.map(goal => goal.year).filter(Boolean))].sort((a, b) => b - a), [goals]);
  const visible = useMemo(() => goals.filter(goal =>
    (filter === 'all' || (filter === 'completed' ? goal.isCompleted : !goal.isCompleted)) &&
    (year === 'all' || goal.year === Number(year))
  ), [goals, filter, year]);
  const active = goals.filter(goal => !goal.isCompleted);
  const stats = [
    { icon: 'flag', value: active.length, label: 'Active goals' },
    { icon: 'task_alt', value: `${active.filter(goal => goal.checkedInThisPeriod).length}/${active.length}`, label: 'Checked in' },
    { icon: 'local_fire_department', value: Math.max(0, ...goals.map(goal => goal.longestStreak || 0)), label: 'Best streak' },
    { icon: 'checklist', value: `${goals.reduce((sum, goal) => sum + goal.todoProgress.done, 0)}/${goals.reduce((sum, goal) => sum + goal.todoProgress.total, 0)}`, label: 'Steps done' }
  ];

  const toggleComplete = async goal => {
    try {
      const response = await API.patch(`/goals/${goal._id}`, { isCompleted: !goal.isCompleted });
      replaceGoal(response.data.goal);
      notify(goal.isCompleted ? 'Goal reopened' : `🏆 “${goal.title}” completed`, goal.isCompleted ? {} : { actionLabel: 'Undo', onAction: () => toggleComplete(response.data.goal) });
    } catch (toggleError) {
      notify(apiError(toggleError, 'Could not update this goal.'));
    }
  };

  const deleteGoal = async () => {
    setDeleting(true);
    try {
      await API.delete(`/goals/${confirmDelete._id}`);
      setGoals(current => current.filter(goal => goal._id !== confirmDelete._id));
      notify('Goal deleted');
      setConfirmDelete(null);
    } catch (deleteError) {
      notify(apiError(deleteError, 'Could not delete this goal.'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Spinner label="Loading goals" />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="headline-medium">Goals</h1>
          <p className="body-large text-variant">Turn what matters into small, trackable steps.</p>
        </div>
        <button type="button" className="btn btn-filled state-layer hide-compact" onClick={() => setEditor({})}><Icon name="add" />New goal</button>
      </header>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {goals.length > 0 && (
        <>
          <section className="stat-grid" aria-label="Goal summary">
            {stats.map(stat => (
              <div key={stat.label} className="card card-tonal stat-tile">
                <Icon name={stat.icon} className="text-primary" />
                <strong className="title-large">{stat.value}</strong>
                <span className="body-small text-variant">{stat.label}</span>
              </div>
            ))}
          </section>

          <div className="toolbar">
            <div className="segmented" role="group" aria-label="Filter goals">
              {FILTERS.map(option => (
                <button key={option.value} type="button" className="state-layer" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>
                  {filter === option.value && <Icon name="check" />}{option.label}
                </button>
              ))}
            </div>
            {years.length > 1 && (
              <label className="compact-select">
                <span className="visually-hidden">Filter by year</span>
                <Icon name="calendar_month" size="20" className="text-variant" />
                <select value={year} onChange={event => setYear(event.target.value)}>
                  <option value="all">All years</option>
                  {years.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            )}
          </div>
        </>
      )}

      {goals.length === 0 ? (
        <div className="card card-outlined">
          <EmptyState icon="flag" title="Start with one meaningful goal" action={<button type="button" className="btn btn-filled state-layer" onClick={() => setEditor({})}><Icon name="add" />Create a goal</button>}>
            Pick something you care about, choose a daily or weekly rhythm, and break it into small steps.
          </EmptyState>
        </div>
      ) : visible.length === 0 ? (
        <div className="card card-outlined">
          <EmptyState icon={filter === 'completed' ? 'emoji_events' : 'search_off'} title={filter === 'completed' ? 'No completed goals yet' : 'Nothing here'}>
            {filter === 'completed' ? 'When you finish a goal, mark it complete from its menu to celebrate it here.' : 'Try a different filter or year.'}
          </EmptyState>
        </div>
      ) : (
        <div className="goal-grid">
          {visible.map(goal => (
            <GoalCard
              key={goal._id}
              goal={goal}
              onCheckIn={() => setCheckInGoal(goal)}
              onEdit={() => setEditor({ goal })}
              onToggleComplete={() => toggleComplete(goal)}
              onDelete={() => setConfirmDelete(goal)}
              onChange={replaceGoal}
            />
          ))}
        </div>
      )}


      {editor && (
        <GoalEditorDialog
          goal={editor.goal}
          initial={editor.initial}
          onClose={() => setEditor(null)}
          onSaved={saved => {
            setGoals(current => (current.some(goal => goal._id === saved._id) ? current.map(goal => (goal._id === saved._id ? saved : goal)) : [saved, ...current]));
            if (!editor.goal) { setFilter('active'); setYear('all'); }
            setEditor(null);
          }}
        />
      )}
      {checkInGoal && <CheckInDialog goal={checkInGoal} onClose={() => setCheckInGoal(null)} onSaved={saved => { replaceGoal(saved); setCheckInGoal(null); }} />}
      {confirmDelete && (
        <ConfirmDialog title="Delete this goal?" onClose={() => setConfirmDelete(null)} onConfirm={deleteGoal} busy={deleting}>
          “{confirmDelete.title}” and its {plural(confirmDelete.completedCheckIns, 'check-in')} will be removed. Friends will no longer see it.
        </ConfirmDialog>
      )}
    </div>
  );
}
