import { Moon, Sun, User } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import tsiLogo from '../../assets/tsi-logo.png';

const VIEW_TITLES = {
  dashboard:  { title: 'Dashboard',     subtitle: 'Overview of your hiring pipeline' },
  matcher:    { title: 'Resume Matcher', subtitle: 'Match candidates to job requirements' },
  postings:   { title: 'Job Postings',  subtitle: 'Manage postings and sessions' },
  resumes:    { title: 'Resumes',       subtitle: 'All matched candidates' },
  analytics:  { title: 'Analytics',     subtitle: 'Hiring insights and trends' },
};

export default function TopBar() {
  const { activeView, darkMode, toggleDarkMode, settings } = useAppStore();
  const { title, subtitle } = VIEW_TITLES[activeView] || VIEW_TITLES.dashboard;

  return (
    <header className={`sticky top-0 z-20 border-b px-6 py-4 flex items-center justify-between
      ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}
    `}>

      <div className="flex items-center gap-4">
        <div>
          <h1 className={`text-2xl font-bold leading-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>TalentMatch</h1>
          <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={toggleDarkMode}
          className={`p-2 rounded-lg transition-colors
            ${darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100'}
          `}
          title="Toggle dark mode"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
          <span className="text-xs font-bold">HR</span>
        </div>
      </div>
    </header>
  );
}
