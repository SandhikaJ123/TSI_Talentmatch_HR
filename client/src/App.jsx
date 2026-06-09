import { Toaster } from 'react-hot-toast';
import { useAppStore } from './store/useAppStore';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import DashboardView from './views/DashboardView';
import MatcherView from './views/MatcherView';
import JobsView from './views/JobsView';
import CandidatesView from './views/CandidatesView';
import AnalyticsView from './views/AnalyticsView';

const VIEWS = {
  dashboard:  DashboardView,
  matcher:    MatcherView,
  postings:   JobsView,
  resumes:    CandidatesView,
  analytics:  AnalyticsView,
};

export default function App() {
  const { activeView, darkMode } = useAppStore();
  const ActiveView = VIEWS[activeView] ?? DashboardView;

  return (
    <div className={`flex h-screen overflow-hidden ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: darkMode ? '#1e293b' : '#fff',
            color: darkMode ? '#e2e8f0' : '#1e293b',
            border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '13px',
          },
        }}
      />

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className={`flex-1 overflow-y-auto ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <ActiveView />
        </main>
      </div>
    </div>
  );
}
