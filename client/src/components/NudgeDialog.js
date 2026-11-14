import React, { useState } from 'react';
import { API } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Avatar, Dialog, Icon, TextField } from './ui';
import { CHEER_TEMPLATES, NUDGE_TEMPLATES } from '../lib/goals';
import { apiError, firstName } from '../lib/format';

/**
 * Sends a reminder ("nudge") or encouragement ("cheer") to a friend,
 * optionally about one of their shared goals.
 */
export default function NudgeDialog({ friend, mode = 'nudge', goals = [], initialGoalId = '', onClose, onSent }) {
  const { notify } = useApp();
  const isCheer = mode === 'cheer';
  const templates = isCheer ? CHEER_TEMPLATES : NUDGE_TEMPLATES;
  const [message, setMessage] = useState(templates[0]);
  const [goalId, setGoalId] = useState(initialGoalId);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async event => {
    event.preventDefault();
    if (!message.trim()) { setError('Write a short message.'); return; }
    setSending(true);
    setError('');
    try {
      const response = await API.post('/reminders', { to: friend._id, goalId: goalId || undefined, message: message.trim(), type: isCheer ? 'encouragement' : 'manual' });
      notify(`${isCheer ? 'Cheer' : 'Nudge'} sent to ${firstName(friend.name)}`);
      onSent?.(response.data.reminder);
      onClose();
    } catch (sendError) {
      setError(apiError(sendError, 'Could not send this message.'));
      setSending(false);
    }
  };

  const activeGoals = goals.filter(goal => !goal.isCompleted);
  return (
    <Dialog
      as="form"
      onSubmit={send}
      icon={isCheer ? 'celebration' : 'notifications_active'}
      title={isCheer ? `Cheer on ${firstName(friend.name)}` : `Nudge ${firstName(friend.name)}`}
      description={isCheer ? 'Celebrate their progress — a little encouragement goes a long way.' : 'Send a friendly reminder to check in.'}
      onClose={onClose}
      busy={sending}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={sending}>Cancel</button>
        <button type="submit" className="btn btn-filled state-layer" disabled={sending || !message.trim()}><Icon name="send" />{sending ? 'Sending…' : 'Send'}</button>
      </>}
    >
      <div className="nudge-recipient">
        <Avatar name={friend.name} size="sm" />
        <span className="title-small">{friend.name}</span>
      </div>
      {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}
      {activeGoals.length > 0 && (
        <TextField as="select" label="About a goal (optional)" value={goalId} onChange={event => setGoalId(event.target.value)}>
          <option value="">Any goal</option>
          {activeGoals.map(goal => <option key={goal._id} value={goal._id}>{goal.emoji} {goal.title}</option>)}
        </TextField>
      )}
      <TextField as="textarea" label="Message" value={message} maxLength={300} rows={3} onChange={event => setMessage(event.target.value)} counter={`${message.length}/300`} data-autofocus />
      <div className="chip-set" aria-label="Suggestions">
        {templates.map(template => (
          <button type="button" key={template} className={`chip chip-assist state-layer${message === template ? ' selected' : ''}`} onClick={() => setMessage(template)}>{template}</button>
        ))}
      </div>
    </Dialog>
  );
}
