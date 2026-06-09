import {
  LayoutDashboard,
  Sparkles,
  Briefcase,
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import tsiLogo from '../../assets/TSI_only.png';
import tsiFullLogo from '../../assets/tsi-logo.png';

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { id: 'postings',    label: 'Postings',    icon: Briefcase },
  { id: 'matcher',     label: 'New Match',   icon: Sparkles },
  { id: 'resumes',     label: 'Resumes',     icon: Users },
];

export default function Sidebar() {
  const { activeView, setActiveView, sidebarOpen, toggleSidebar, darkMode, settings } = useAppStore();

  return (
    <aside
      className={`
        flex flex-col h-screen sticky top-0 transition-all duration-300 shrink-0 z-30
        ${sidebarOpen ? 'w-56' : 'w-16'}
        ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}
        border-r
      `}
    >
      {/* Logo */}
      <div className={`flex ${sidebarOpen ? 'flex-col items-center' : 'items-center justify-center'} gap-2 px-4 py-5 ${darkMode ? '' : ''}`}>
        <div className={`${sidebarOpen ? 'w-40 h-20' : 'w-12 h-12'} rounded-lg flex items-center justify-center shrink-0 overflow-hidden p-2 bg-white transition-all duration-300`}>
          <img src={sidebarOpen ? tsiFullLogo : tsiLogo} alt="TPF Software Inc" className="w-full h-full object-contain" />
        </div>
        {sidebarOpen && (
          <div className="text-center">
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              title={!sidebarOpen ? label : undefined}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : darkMode
                    ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }
                ${!sidebarOpen ? 'justify-center' : ''}
              `}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className={`px-2 py-3 border-t ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
        <button
          onClick={toggleSidebar}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs transition-all
            ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}
          `}
        >
          {sidebarOpen ? (
            <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
