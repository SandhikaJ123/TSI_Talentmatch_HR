import { useState } from 'react';
import { Save, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import PreferencesPanel from '../components/PreferencesPanel';
import { getSessions, deleteSession, getJobs, deleteJob, clearAllData } from '../api/client';
import toast from 'react-hot-toast';

export default function SettingsView() {
  const { settings, updateSettings, updateDefaultPreferences, darkMode, toggleDarkMode } = useAppStore();
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [prefs, setPrefs] = useState(settings.defaultPreferences);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleSave = () => {
    updateSettings({ companyName });
    updateDefaultPreferences(prefs);
    toast.success('Settings saved');
  };

  const handleClearData = async () => {
    setClearing(true);
    try {
      await clearAllData();
      localStorage.removeItem('client-store');
      toast.success('All data cleared');
      window.location.href = window.location.href;
    } catch (err) {
      toast.error('Failed to clear data: ' + err.message);
      setClearing(false);
      setShowClearConfirm(false);
    }
  };

  const bg = `rounded-2xl border p-6 shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`;
  const text = darkMode ? 'text-white' : 'text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const input = `w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500
    ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'}`;

  return (
    <div className="p-6 space-y-5 max-w-2xl mx-auto">
      {/* General */}
      <div className={bg}>
        <h3 className={`font-semibold mb-4 ${text}`}>General</h3>
        <div className="space-y-4">
          <div>
            <label className={`text-xs font-medium block mb-1.5 ${muted}`}>Company Name</label>
            <input
              className={input}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your company name"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${text}`}>Dark Mode</p>
              <p className={`text-xs ${muted}`}>Switch between light and dark theme</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative w-11 h-6 rounded-full transition-colors ${darkMode ? 'bg-teal-600' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Default matching preferences */}
      <div className={bg}>
        <h3 className={`font-semibold mb-4 ${text}`}>Default Matching Preferences</h3>
        <p className={`text-xs mb-4 ${muted}`}>These weights will be pre-filled when you start a new match session.</p>
        <PreferencesPanel preferences={prefs} onChange={setPrefs} />
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-3 rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-sm"
      >
        <Save className="w-4 h-4" />
        Save Settings
      </button>

      {/* Danger zone */}
      <div className={`rounded-2xl border border-red-200 p-6 ${darkMode ? 'bg-red-950/20' : 'bg-red-50'}`}>
        <h3 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Danger Zone
        </h3>
        <p className={`text-xs mb-4 ${muted}`}>
          Clear all stored data including jobs, sessions, and candidates. This cannot be undone.
        </p>
        {showClearConfirm ? (
          <div className="flex gap-2">
            <button
              onClick={handleClearData}
              disabled={clearing}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {clearing ? <><Loader2 className="w-4 h-4 animate-spin" />Clearing...</> : 'Yes, clear everything'}
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className={`flex-1 py-2 rounded-xl text-sm ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'} transition-colors`}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 text-red-600 border border-red-300 px-4 py-2 rounded-xl text-sm hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear All Data
          </button>
        )}
      </div>
    </div>
  );
}
