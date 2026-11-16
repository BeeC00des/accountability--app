import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { playAlarm, unlockAudio } from '../lib/alarm';
import { Dialog, Icon } from './ui';

const RUNG_KEY = 'accountable-alarm-rung';
const SNOOZE_MINUTES = 10;

const localParts = (timezone, date = new Date()) => {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(part => [part.type, part.value]));
    return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  } catch {
    const iso = date.toISOString();
    return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
  }
};
const readRung = () => { try { return JSON.parse(window.localStorage.getItem(RUNG_KEY) || '[]'); } catch { return []; } };
const markRung = key => { try { window.localStorage.setItem(RUNG_KEY, JSON.stringify([...readRung(), key].slice(-10))); } catch { /* storage unavailable: may ring again after reload */ } };

/**
 * Rings an alarm at the morning and evening reminder times while the app is open in a tab,
 * and shows a system notification when the browser allows it.
 */
export default function ReminderAlarm() {
  const { user } = useAuth();
  const { refreshUnread } = useApp();
  const navigate = useNavigate();
  const [ringing, setRinging] = useState(null); // { slot, blocked }
  const alarmRef = useRef(null);
  const snoozeRef = useRef(null);

  const enabled = Boolean(user) && user.notificationsEnabled !== false && user.alarmSound !== false;
  const timezone = user?.timezone || 'UTC';
  const morning = user?.reminderTime || '08:00';
  const evening = user?.reminderTime2 || '20:00';
  const times = [morning, evening];

  const stopSound = () => { alarmRef.current?.stop(); alarmRef.current = null; };

  const ring = useCallback(slot => {
    stopSound();
    const alarm = playAlarm();
    alarmRef.current = alarm;
    setRinging({ slot, blocked: alarm.blocked });
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        const note = new Notification(slot === 2 ? 'Evening check-in ⏰' : 'Time to check in ⏰', { body: 'A small step still counts. Open accounTable to check in.', tag: 'accountable-reminder', requireInteraction: true });
        note.onclick = () => { window.focus(); note.close(); };
      }
    } catch { /* notifications unavailable */ }
    setTimeout(refreshUnread, 5000); // the server adds the reminder to the Inbox in the same minute
  }, [refreshUnread]);

  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => {
      const { day, time } = localParts(timezone);
      const slot = time === morning ? 1 : time === evening ? 2 : 0;
      if (!slot) return;
      const key = `${day}:${slot}:${time}`;
      if (readRung().includes(key)) return;
      markRung(key);
      ring(slot);
    };
    // First check shortly after load (not during mount, so a remount can't cancel a ring it just started).
    const first = setTimeout(tick, 1500);
    const interval = setInterval(tick, 15000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [enabled, timezone, morning, evening, ring]);

  useEffect(() => () => { stopSound(); clearTimeout(snoozeRef.current); }, []);

  if (!ringing) return null;
  const close = () => { stopSound(); setRinging(null); };
  const snooze = () => {
    const { slot } = ringing;
    close();
    clearTimeout(snoozeRef.current);
    snoozeRef.current = setTimeout(() => ring(slot), SNOOZE_MINUTES * 60000);
  };

  return (
    <Dialog
      icon="alarm"
      title={ringing.slot === 2 ? 'Evening check-in' : 'Time to check in'}
      description={`Your ${ringing.slot === 2 ? 'evening' : 'morning'} reminder (${times[ringing.slot - 1]}). A small step still counts.`}
      onClose={close}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={snooze}><Icon name="snooze" />Snooze {SNOOZE_MINUTES} min</button>
        <button type="button" className="btn btn-filled state-layer" onClick={() => { close(); navigate('/today'); }} data-autofocus><Icon name="check_circle" />Check in now</button>
      </>}
    >
      <div className="alarm-ring" aria-hidden="true"><Icon name="alarm" filled /></div>
      {ringing.blocked && (
        <button type="button" className="btn btn-tonal state-layer alarm-sound-btn" onClick={() => { unlockAudio(); stopSound(); alarmRef.current = playAlarm(); setRinging(current => ({ ...current, blocked: false })); }}>
          <Icon name="volume_up" />Play alarm sound
        </button>
      )}
      <button type="button" className="btn btn-outlined state-layer alarm-stop-btn" onClick={close}><Icon name="alarm_off" />Stop alarm</button>
    </Dialog>
  );
}
