import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API, useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Avatar, EmptyState, ErrorBanner, Icon, Menu, Spinner } from '../components/ui';
import NudgeDialog from '../components/NudgeDialog';
import { apiError, formatDateTime, relativeTime } from '../lib/format';

const BOXES = [
  { value: 'inbox', label: 'Inbox', icon: 'inbox' },
  { value: 'sent', label: 'Sent', icon: 'send' }
];
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'friends', label: 'From friends' },
  { value: 'nudges', label: 'Daily reminders' }
];

const kindOf = reminder => {
  if (reminder.type === 'automated') return { label: 'Daily reminder', icon: 'alarm' };
  if (reminder.type === 'encouragement') return { label: 'Cheer', icon: 'celebration' };
  if (reminder.type === 'challenge') return { label: 'Challenge', icon: 'emoji_events' };
  return { label: 'Nudge', icon: null };
};

export default function Inbox() {
  const { user } = useAuth();
  const { notify, refreshUnread, setUnread } = useApp();
  const navigate = useNavigate();
  const [box, setBox] = useState('inbox');
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reply, setReply] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get('/reminders', { params: { box, filter: box === 'inbox' ? filter : 'all' } });
      setItems(response.data.reminders || []);
    } catch (loadError) {
      setError(apiError(loadError, 'Could not load your messages.'));
    } finally {
      setLoading(false);
    }
  }, [box, filter]);
  useEffect(() => { load(); }, [load]);

  const setRead = async (reminder, isRead) => {
    if (reminder.isRead === isRead) return;
    setItems(current => current.map(item => (item._id === reminder._id ? { ...item, isRead } : item)));
    setUnread(count => Math.max(0, count + (isRead ? -1 : 1)));
    try {
      await API.put(`/reminders/${reminder._id}/read`, { isRead });
    } catch (updateError) {
      notify(apiError(updateError, 'Could not update this message.'));
      load();
      refreshUnread();
    }
  };

  const markAllRead = async () => {
    try {
      await API.put('/reminders/read-all');
      setItems(current => (filter === 'unread' ? [] : current.map(item => ({ ...item, isRead: true }))));
      setUnread(0);
      notify('All caught up');
    } catch (updateError) {
      notify(apiError(updateError, 'Could not update your inbox.'));
    }
  };

  const remove = async reminder => {
    const previous = items;
    setItems(current => current.filter(item => item._id !== reminder._id));
    try {
      await API.delete(`/reminders/${reminder._id}`);
      if (!reminder.isRead) setUnread(count => Math.max(0, count - 1));
      notify('Message deleted');
    } catch (deleteError) {
      setItems(previous);
      notify(apiError(deleteError, 'Could not delete this message.'));
    }
  };

  const checkIn = reminder => {
    setRead(reminder, true);
    navigate(reminder.goal?._id && reminder.goal.isActive !== false ? `/goals?checkin=${reminder.goal._id}` : '/today');
  };

  const unreadHere = items.filter(item => !item.isRead).length;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="headline-medium">Inbox</h1>
          <p className="body-large text-variant">Nudges and cheers from friends, plus your daily reminders.</p>
        </div>
        <Link to="/profile#settings" className="btn btn-outlined state-layer hide-compact"><Icon name="schedule" />Reminder time</Link>
      </header>

      <div className="tabs" role="tablist" aria-label="Mailbox">
        {BOXES.map(item => (
          <button key={item.value} type="button" role="tab" aria-selected={box === item.value} className="tab state-layer" onClick={() => setBox(item.value)}>
            <Icon name={item.icon} size="20" />{item.label}
          </button>
        ))}
      </div>

      {box === 'inbox' && (
        <div className="toolbar inbox-toolbar">
          <div className="chip-set" role="group" aria-label="Filter messages">
            {FILTERS.map(item => (
              <button key={item.value} type="button" className={`chip state-layer${filter === item.value ? ' selected' : ''}`} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>
                {filter === item.value && <Icon name="check" />}{item.label}
              </button>
            ))}
          </div>
          {unreadHere > 0 && <button type="button" className="btn btn-text state-layer" onClick={markAllRead}><Icon name="done_all" />Mark all read</button>}
        </div>
      )}

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? <Spinner label="Loading messages" /> : items.length === 0 ? (
        <div className="card card-outlined">
          {box === 'sent' ? (
            <EmptyState icon="send" title="Nothing sent yet" action={<Link to="/friends" className="btn btn-tonal state-layer"><Icon name="group" />Go to friends</Link>}>
              Nudge a friend who hasn’t checked in, or cheer someone on.
            </EmptyState>
          ) : (
            <EmptyState icon="mark_email_read" title={filter === 'all' ? 'No messages yet' : 'Nothing here'}>
              {filter === 'all'
                ? `Friends’ nudges appear here, along with your daily reminder at ${user?.reminderTime || '08:00'} when goals still need a check-in.`
                : 'Try another filter.'}
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="card card-outlined list-card">
          <ul className="list" role="list">
            {items.map((reminder, index) => {
              const kind = kindOf(reminder);
              const automated = reminder.type === 'automated';
              const person = box === 'sent' ? reminder.to : reminder.from;
              const headline = box === 'sent' ? `To ${person?.name || 'a friend'}` : automated ? 'Accountable' : person?.name || 'A friend';
              const canCheckIn = box === 'inbox' && (automated || reminder.type === 'manual');
              const isChallenge = reminder.type === 'challenge';
              const canReply = box === 'inbox' && !automated && !isChallenge && person?._id;
              return (
                <React.Fragment key={reminder._id}>
                  {index > 0 && <li className="list-divider" role="separator" />}
                  <li className={`list-item three-line message-row${box === 'inbox' && !reminder.isRead ? ' unread' : ''}`}>
                    <Avatar name={person?.name} icon={automated ? 'alarm' : kind.icon || undefined} />
                    <div className="list-item-content">
                      <span className="message-head">
                        <span className="list-item-headline">{headline}</span>
                        <time className="body-small text-variant" dateTime={reminder.createdAt} title={formatDateTime(reminder.createdAt)}>{relativeTime(reminder.createdAt)}</time>
                      </span>
                      <span className="list-item-supporting">{reminder.message}</span>
                      <span className="message-meta">
                        <span className="tag">{kind.icon && <Icon name={kind.icon} />}{kind.label}</span>
                        {reminder.goal && <span className="tag tag-primary"><span aria-hidden="true">{reminder.goal.emoji}</span>{reminder.goal.title}</span>}
                        {box === 'sent' && <span className="body-small text-variant">{reminder.isRead ? 'Seen' : 'Delivered'}</span>}
                      </span>
                      {(canCheckIn || canReply || isChallenge) && box === 'inbox' && (
                        <span className="message-actions">
                          {isChallenge && box === 'inbox' && <button type="button" className="btn btn-tonal btn-sm state-layer" onClick={event => { event.stopPropagation(); setRead(reminder, true); navigate('/compete?tab=challenges'); }}><Icon name="emoji_events" />Open challenge</button>}
                          {canCheckIn && <button type="button" className="btn btn-tonal btn-sm state-layer" onClick={event => { event.stopPropagation(); checkIn(reminder); }}><Icon name="check" />Check in</button>}
                          {canReply && <button type="button" className="btn btn-text btn-sm state-layer" onClick={event => { event.stopPropagation(); setRead(reminder, true); setReply(person); }}><Icon name="reply" />Say thanks</button>}
                        </span>
                      )}
                    </div>
                    {box === 'inbox' && (
                      <div className="list-item-trailing">
                        {!reminder.isRead && (
                          <button type="button" className="icon-btn state-layer unread-dot-btn" onClick={() => setRead(reminder, true)} aria-label="Mark as read" title="Mark as read">
                            <span className="badge badge-dot" />
                          </button>
                        )}
                        <Menu
                          label="Message actions"
                          items={[
                            reminder.isRead
                              ? { label: 'Mark as unread', icon: 'mark_email_unread', onSelect: () => setRead(reminder, false) }
                              : { label: 'Mark as read', icon: 'mark_email_read', onSelect: () => setRead(reminder, true) },
                            { label: 'Delete', icon: 'delete', danger: true, onSelect: () => remove(reminder) }
                          ]}
                        />
                      </div>
                    )}
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        </div>
      )}

      {reply && <NudgeDialog friend={reply} mode="cheer" onClose={() => setReply(null)} />}
    </div>
  );
}
