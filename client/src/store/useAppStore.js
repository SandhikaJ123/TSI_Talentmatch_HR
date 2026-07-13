import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Central Zustand store with selective localStorage persistence.
 * Manages: jobs (in-memory only), candidates, sessions (in-memory only), UI state, settings.
 * 
 * NOTE: Jobs and sessions are NOT persisted to localStorage since they're stored in the database.
 * Only UI preferences and candidate statuses are persisted.
 */

const generateId = () =>
  typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export const useAppStore = create(
  persist(
    (set, get) => ({
      // ─── UI ───────────────────────────────────────────────
      activeView: 'dashboard',
      sidebarOpen: true,
      darkMode: false,

      setActiveView: (view) => {
        const valid = ['dashboard','matcher','postings','resumes','analytics'];
        set({ activeView: valid.includes(view) ? view : 'dashboard' });
      },
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

      // ─── Job Postings (NOT persisted - loaded from DB) ────────────────────
      jobs: [],   // { id, title, department, location, type, requirementsText, createdAt, status }

      // These functions are kept for backward compatibility but jobs should be managed via API
      addJob: (job) =>
        set((s) => ({
          jobs: [
            { ...job, id: generateId(), createdAt: new Date().toISOString(), status: 'active' },
            ...s.jobs,
          ],
        })),

      updateJob: (id, updates) =>
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)) })),

      deleteJob: (id) =>
        set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),

      // Sync jobs from backend API to local store (for MatcherView dropdown)
      syncJobsFromBackend: (backendJobs) =>
        set({ jobs: backendJobs.map(j => ({
          id: j.id,
          title: j.title,
          department: j.department || 'Engineering',
          location: j.location || '',
          type: j.type || 'Full-time',
          description: j.description || '',
          requirementsText: j.description || '',
          createdAt: j.created_at || j.createdAt || '',
          status: j.status || 'active',
          required_skills: j.required_skills || [],
        })) }),

      // ─── Match Sessions (NOT persisted - loaded from DB) ──────────────────
      sessions: [],  // { id, jobId, jobTitle, createdAt, preferences, results[] }

      addSession: (session) =>
        set((s) => ({
          sessions: [
            { ...session, id: generateId(), createdAt: new Date().toISOString() },
            ...s.sessions,
          ],
        })),

      deleteSession: (id) =>
        set((s) => ({ sessions: s.sessions.filter((sess) => sess.id !== id) })),

      // ─── Candidates (Pipeline status only - persisted) ────────────────────
      // Candidates are derived from sessions but can have pipeline status overrides
      candidateStatuses: {},  // { `${sessionId}-${fileName}`: status }

      setCandidateStatus: (sessionId, fileName, status) =>
        set((s) => ({
          candidateStatuses: {
            ...s.candidateStatuses,
            [`${sessionId}-${fileName}`]: status,
          },
        })),

      getCandidateStatus: (sessionId, fileName) => {
        const key = `${sessionId}-${fileName}`;
        return get().candidateStatuses[key] || 'new';
      },

      // ─── Settings (persisted) ─────────────────────────────────────────────
      settings: {
        companyName: 'TPF Software Inc',
        defaultPreferences: {
          skillsWeight: 40,
          experienceWeight: 25,
          educationWeight: 20,
          overallWeight: 15,
          customCriteria: [],
        },
      },

      updateSettings: (updates) =>
        set((s) => ({ settings: { ...s.settings, ...updates } })),

      updateDefaultPreferences: (prefs) =>
        set((s) => ({
          settings: { ...s.settings, defaultPreferences: { ...s.settings.defaultPreferences, ...prefs } },
        })),
    }),
    {
      name: 'client-store',
      // Only persist UI preferences, settings, and candidate statuses
      // Jobs and sessions are loaded from the database
      partialize: (state) => ({
        activeView: state.activeView,
        candidateStatuses: state.candidateStatuses,
        settings: state.settings,
        darkMode: state.darkMode,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
