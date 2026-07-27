import { useState, useEffect } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Standard four-color Microsoft logo, used on "Sign in with Microsoft" buttons
// per Microsoft's own branding guidelines.
function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

/**
 * Wraps the whole app. Checks for an active Entra ID session on mount via
 * GET /api/auth/me. Renders a sign-in screen if there's no session, or the
 * app's children once signed in.
 *
 * Also exports useAuthUser() for any component (e.g. TopBar) that wants to
 * show the signed-in user's name or a sign-out button.
 */
export default function AuthGate({ children }) {
  const darkMode = useAppStore((state) => state.darkMode);
  const [status, setStatus] = useState('checking'); // 'checking' | 'signedIn' | 'signedOut'
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('not signed in');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setStatus('signedIn');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('signedOut');
      });
    return () => { cancelled = true; };
  }, []);

  const handleSignIn = () => {
    window.location.href = `${API_BASE}/auth/login`;
  };

  const bgPage = darkMode ? 'bg-slate-900' : 'bg-slate-50';
  const cardBg = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const text = darkMode ? 'text-white' : 'text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';

  if (status === 'checking') {
    return (
      <div className={`min-h-screen flex items-center justify-center ${bgPage}`}>
        <Loader2 className={`w-6 h-6 animate-spin ${muted}`} />
      </div>
    );
  }

  if (status === 'signedOut') {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${bgPage}`}>
        <div className={`w-full max-w-sm rounded-2xl border shadow-sm p-8 text-center ${cardBg}`}>
          <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className={`text-lg font-bold mb-1 ${text}`}>TalentMatch HR</h1>
          <p className={`text-sm mb-6 ${muted}`}>Sign in with your work account to continue.</p>
          <button
            onClick={handleSignIn}
            className={`w-full flex items-center justify-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors
              ${darkMode ? 'border-slate-600 text-white hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            <MicrosoftLogo />
            Sign in with Microsoft
          </button>
          <p className={`text-xs mt-5 ${muted}`}>
            You'll be redirected to your organization's sign-in page.
          </p>
        </div>
      </div>
    );
  }

  // signedIn
  return children;
}

/**
 * Lightweight hook for any component that wants the signed-in user's info
 * (e.g. TopBar showing a name/avatar) or a way to sign out. Re-fetches
 * /api/auth/me itself rather than relying on context, since this is meant
 * to be usable from anywhere without prop drilling.
 */
export function useAuthUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setUser(data.user); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const signOut = async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  };

  return { user, signOut };
}
