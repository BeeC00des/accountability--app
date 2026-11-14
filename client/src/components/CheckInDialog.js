import React, { useState } from 'react';
import { API, useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Dialog, Icon, TextField } from './ui';
import { MOODS, periodLabel } from '../lib/goals';
import { apiError } from '../lib/format';

/** Records today's (or this week's) check-in for a goal. Pre-fills an existing check-in so it can be edited. */
export default function CheckInDialog({ goal, onClose, onSaved }) {
  const { updateUser } = useAuth();
  const { notify } = useApp();
  const existing = goal.currentCheckIn;
  const [completed, setCompleted] = useState(existing ? existing.completed : true);
  const [mood, setMood] = useState(existing?.mood || '');
  const [note, setNote] = useState(existing?.note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await API.post(`/goals/${goal._id}/checkin`, { completed, mood, note: note.trim() });
      if (response.data.user) updateUser(response.data.user);
      notify(response.data.message);
      onSaved(response.data.goal);
    } catch (saveError) {
      setError(apiError(saveError, 'Could not save your check-in.'));
      setSaving(false);
    }
  };

  return (
    <Dialog
      as="form"
      onSubmit={save}
      title={`${goal.emoji || '🎯'} ${goal.title}`}
      description={`How did it go ${periodLabel(goal)}?`}
      onClose={onClose}
      busy={saving}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-filled state-layer" disabled={saving}>{saving ? 'Saving…' : existing ? 'Update check-in' : 'Save check-in'}</button>
      </>}
    >
      {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}
      <fieldset className="plain-fieldset">
        <legend className="title-small fieldset-legend">Result</legend>
        <div className="segmented segmented-block" role="radiogroup" aria-label="Result">
          <button type="button" role="radio" aria-checked={completed} className="state-layer" onClick={() => setCompleted(true)} data-autofocus>
            {completed && <Icon name="check" />}Done
          </button>
          <button type="button" role="radio" aria-checked={!completed} className="state-layer" onClick={() => setCompleted(false)}>
            {!completed && <Icon name="check" />}Not {goal.frequency === 'weekly' ? 'this week' : 'today'}
          </button>
        </div>
      </fieldset>
      <fieldset className="plain-fieldset">
        <legend className="title-small fieldset-legend">How did it feel? <span className="text-variant body-small">Optional</span></legend>
        <div className="chip-set">
          {MOODS.map(option => (
            <button key={option.value} type="button" className={`chip state-layer${mood === option.value ? ' selected' : ''}`} aria-pressed={mood === option.value} onClick={() => setMood(current => (current === option.value ? '' : option.value))}>
              {mood === option.value && <Icon name="check" />}<span aria-hidden="true">{option.emoji}</span>{option.label}
            </button>
          ))}
        </div>
      </fieldset>
      <TextField as="textarea" label="Note (optional)" value={note} maxLength={300} rows={3} onChange={event => setNote(event.target.value)} placeholder="What helped, or what got in the way?" counter={`${note.length}/300`} />
    </Dialog>
  );
}
