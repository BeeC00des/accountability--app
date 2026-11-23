import React, { useEffect, useState } from 'react';
import { Icon } from './ui';

const KEY = 'accountable-install-dismissed';
const DAYS_30 = 30 * 86400000;
const dismissedRecently = () => { try { return Date.now() - Number(window.localStorage.getItem(KEY) || 0) < DAYS_30; } catch { return false; } };
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;

/** "Install doerstab" — one tap on Android/desktop Chrome; Share → Add to Home Screen tip on iPhone. */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return undefined;
    const onPrompt = event => { event.preventDefault(); setDeferred(event); setShow(true); };
    const onInstalled = () => setShow(false);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (isIos() && /safari/i.test(window.navigator.userAgent)) { setIos(true); setShow(true); }
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const dismiss = () => { setShow(false); try { window.localStorage.setItem(KEY, String(Date.now())); } catch { /* shows again next visit */ } };
  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice.catch(() => null);
    setDeferred(null);
    if (choice?.outcome === 'accepted') setShow(false); else dismiss();
  };

  if (!show) return null;
  return (
    <aside className="install-prompt" aria-label="Install the app">
      <img src="/icon-192.png" alt="" width="40" height="40" />
      <span className="install-text">
        <strong className="title-small">Install doerstab</strong>
        <span className="body-small text-variant">{ios ? <>Tap <Icon name="ios_share" size="16" /> Share, then <strong>Add to Home Screen</strong>.</> : 'Open it from your home screen like an app.'}</span>
      </span>
      {!ios && <button type="button" className="btn btn-filled btn-sm state-layer" onClick={install}>Install</button>}
      <button type="button" className="icon-btn state-layer" onClick={dismiss} aria-label="Not now"><Icon name="close" /></button>
    </aside>
  );
}
