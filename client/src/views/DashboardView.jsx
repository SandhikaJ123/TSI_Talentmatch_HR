import { Briefcase, Users, Sparkles, TrendingUp, Clock, ChevronRight, Trophy, FileText, Target, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useState, useEffect } from 'react';
import { getJobs, getSessions, getCandidates } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const PIPELINE_STATUSES = ['new', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'];

const STATUS_COLORS = {
  new:         'bg-slate-100 text-slate-700',
  shortlisted: 'bg-blue-100 text-blue-700',
  interview:   'bg-violet-100 text-violet-700',
  offered:     'bg-amber-100 text-amber-700',
  hired:       'bg-emerald-100 text-emerald-700',
  rejected:    'bg-red-100 text-red-700',
};

export default function DashboardView() {
  const { setActiveView, darkMode, activeView } = useAppStore();
  const [jobs, setJobs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load all data from database
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load data with individual error handling
      const jobsData = await getJobs().catch(err => {
        console.error('Failed to load jobs:', err);
        return { jobs: [] };
      });
      
      const sessionsData = await getSessions().catch(err => {
        console.error('Failed to load sessions:', err);
        return { sessions: [] };
      });
      
      const candidatesData = await getCandidates().catch(err => {
        console.error('Failed to load candidates:', err);
        return { candidates: [] };
      });
      
      setJobs(jobsData.jobs || []);
      setSessions(sessionsData.sessions || []);
      setCandidates(candidatesData.candidates || []);
      
      console.log('Dashboard data loaded:', {
        jobs: jobsData.jobs?.length || 0,
        sessions: sessionsData.sessions?.length || 0,
        candidates: candidatesData.candidates?.length || 0
      });
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      toast.error('Failed to load dashboard data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount and whenever dashboard becomes active
  useEffect(() => {
    loadDashboardData();
  }, [activeView]);

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className={`w-8 h-8 mx-auto mb-2 animate-spin ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const totalResumes = candidates.length;
  const activeJobs = jobs.filter((j) => j.status === 'active').length;
  const totalJobs = jobs.length;
  const totalSessions = sessions.filter(s => s.candidate_count > 0).length;

  // Calculate resumes per job
  const resumesPerJob = totalJobs > 0 ? (totalResumes / totalJobs).toFixed(1) : 0;

  // Top performing resumes - filtered by selected job or all jobs
  const filteredCandidates = selectedJobId 
    ? candidates.filter(c => {
        const session = sessions.find(s => s.id === c.session_id);
        return session?.job_id === selectedJobId;
      })
    : candidates;
  
  const topResumes = [...filteredCandidates]
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, 5)
    .map(c => ({
      name: c.name,
      finalScore: c.final_score,
      status: c.status,
      sessionId: c.session_id,
      jobTitle: sessions.find(s => s.id === c.session_id)?.job_title || 'Unknown'
    }));

  // Job postings with resume counts
  const jobsWithResumes = jobs.map(job => {
    const jobSessions = sessions.filter(s => s.job_id === job.id);
    const resumeCount = jobSessions.reduce((sum, s) => sum + (s.result_count || 0), 0);
    const jobCandidates = candidates.filter(c => {
      const session = sessions.find(s => s.id === c.session_id);
      return session?.job_id === job.id;
    });
    const avgJobScore = jobCandidates.length > 0
      ? Math.round(jobCandidates.reduce((sum, c) => sum + c.final_score, 0) / jobCandidates.length)
      : 0;
    return { ...job, resumeCount, avgJobScore };
  }).sort((a, b) => b.resumeCount - a.resumeCount).slice(0, 5);

  // Pipeline counts
  const pipelineCounts = PIPELINE_STATUSES.reduce((acc, s) => {
    acc[s] = candidates.filter((c) => c.status === s).length;
    return acc;
  }, {});

  // Get candidates for selected job
  const selectedJob = jobs.find(j => j.id === selectedJobId);
  const selectedJobCandidates = selectedJobId 
    ? candidates.filter(c => {
        const session = sessions.find(s => s.id === c.session_id);
        return session?.job_id === selectedJobId;
      })
    : [];

  // Score distribution for selected job
  const jobScoreDistribution = selectedJobId ? [
    { range: '0-20',  count: selectedJobCandidates.filter((c) => c.final_score < 20).length },
    { range: '20-40', count: selectedJobCandidates.filter((c) => c.final_score >= 20 && c.final_score < 40).length },
    { range: '40-55', count: selectedJobCandidates.filter((c) => c.final_score >= 40 && c.final_score < 55).length },
    { range: '55-70', count: selectedJobCandidates.filter((c) => c.final_score >= 55 && c.final_score < 70).length },
    { range: '70-85', count: selectedJobCandidates.filter((c) => c.final_score >= 70 && c.final_score < 85).length },
    { range: '85-100',count: selectedJobCandidates.filter((c) => c.final_score >= 85).length },
  ] : [];

  const card = `rounded-2xl border p-5 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`;
  const text = darkMode ? 'text-white' : 'text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const gridColor = darkMode ? '#334155' : '#f1f5f9';
  const axisColor = darkMode ? '#64748b' : '#94a3b8';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Empty State */}
      {totalResumes === 0 && totalJobs === 0 && (
        <div className={`${card} p-12 text-center`}>
          <Briefcase className={`w-16 h-16 mx-auto mb-4 ${muted}`} />
          <h3 className={`text-xl font-bold mb-2 ${text}`}>No Data Yet</h3>
          <p className={`${muted} mb-6`}>Start by creating a job posting and matching resumes</p>
          <button
            onClick={() => setActiveView('matcher')}
            className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition-colors font-medium"
          >
            Go to Matcher
          </button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Resumes',   value: totalResumes,   icon: FileText,  color: 'violet', action: 'resumes' },
          { label: 'Job Postings',    value: totalJobs,      icon: Briefcase, color: 'teal',   action: 'postings' },
          { label: 'Total Sessions',  value: totalSessions,  icon: Trophy,    color: 'amber',  action: 'postings' },
          { label: 'Resumes/Job',     value: resumesPerJob,  icon: Target,    color: 'blue',   action: 'matcher' },
        ].map(({ label, value, icon: Icon, color, action }) => (
          <button
            key={label}
            onClick={() => setActiveView(action)}
            className={`${card} text-left hover:shadow-md transition-shadow group`}
          >
            <div className="flex items-start justify-between">
              <div className={`p-2.5 rounded-xl bg-${color}-100`}>
                <Icon className={`w-5 h-5 text-${color}-600`} />
              </div>
              <ChevronRight className={`w-4 h-4 ${muted} group-hover:text-teal-500 transition-colors`} />
            </div>
            <p className={`text-2xl font-bold mt-3 ${text}`}>{value}</p>
            <p className={`text-sm ${muted} mt-0.5`}>{label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Job Postings with Resume Counts */}
        <div className={card}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${text}`}>Job Postings & Resumes</h3>
            <button
              onClick={() => setActiveView('matcher')}
              className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
            >
              New Match <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {jobsWithResumes.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase className={`w-8 h-8 mx-auto mb-2 ${muted}`} />
              <p className={`text-sm ${muted}`}>No job postings yet</p>
              <button
                onClick={() => setActiveView('matcher')}
                className="mt-3 text-xs bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
              >
                Create First Job
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {jobsWithResumes.map((job) => (
                <div
                  key={job.id}
                  onClick={() => setActiveView('postings')}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:shadow-sm transition-shadow ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-50 hover:bg-slate-100'}`}
                >
                  <div className={`w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center shrink-0`}>
                    <Briefcase className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${text}`}>{job.title}</p>
                    <p className={`text-xs ${muted}`}>
                      {job.department} · {job.resumeCount} resume{job.resumeCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className={`text-lg font-bold ${job.avgJobScore >= 70 ? 'text-emerald-600' : job.avgJobScore >= 50 ? 'text-yellow-600' : 'text-slate-500'}`}>
                        {job.resumeCount > 0 ? `${job.avgJobScore}%` : '—'}
                      </p>
                      <p className={`text-xs ${muted}`}>avg score</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      job.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Job Match Distribution & Top Performing Resumes */}
      {jobs.length > 0 && candidates.length > 0 && (
        <div className={card}>
          <div className="space-y-6">
            {/* Match Score Distribution */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-semibold ${text}`}>Match Score Distribution</h3>
              </div>
              <div className="mb-4">
                <label className={`text-sm font-medium ${muted} block mb-2`}>Select Job</label>
                <select
                  value={selectedJobId || ''}
                  onChange={(e) => setSelectedJobId(e.target.value || null)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode 
                      ? 'bg-slate-700 border-slate-600 text-white' 
                      : 'bg-white border-slate-300 text-slate-900'
                  } focus:outline-none focus:ring-2 focus:ring-teal-500`}
                >
                  <option value="">-- Select a job --</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} ({job.department})
                    </option>
                  ))}
                </select>
              </div>
              {selectedJobId && selectedJobCandidates.length > 0 ? (
                <div>
                  <div className="mb-3 grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${text}`}>{selectedJobCandidates.length}</p>
                      <p className={`text-xs ${muted}`}>Total Candidates</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-2xl font-bold text-emerald-600`}>
                        {selectedJobCandidates.filter(c => c.final_score >= 70).length}
                      </p>
                      <p className={`text-xs ${muted}`}>Strong Matches (70+)</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-2xl font-bold text-yellow-600`}>
                        {selectedJobCandidates.filter(c => c.final_score >= 55 && c.final_score < 70).length}
                      </p>
                      <p className={`text-xs ${muted}`}>Good Matches (55-69)</p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={jobScoreDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis 
                        dataKey="range" 
                        tick={{ fontSize: 12, fill: axisColor }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: axisColor }} 
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{ 
                          background: darkMode ? '#1e293b' : '#fff', 
                          border: 'none', 
                          borderRadius: 8, 
                          fontSize: 12 
                        }}
                        labelStyle={{ color: darkMode ? '#e2e8f0' : '#1e293b' }}
                      />
                      <Bar dataKey="count" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : selectedJobId ? (
                <div className="text-center py-12">
                  <p className={`text-sm ${muted}`}>No candidates matched for this job yet</p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className={`text-sm ${muted}`}>Select a job to view match distribution</p>
                </div>
              )}
            </div>

            {/* Top Performing Resumes - shown only when job is selected */}
            {selectedJobId && topResumes.length > 0 && (
              <div className={`pt-6 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-semibold flex items-center gap-2 ${text}`}>
                    <Trophy className="w-4 h-4 text-amber-500" />
                    Top Performing Candidates
                  </h3>
                  <button
                    onClick={() => setActiveView('candidates')}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                  >
                    View All <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {topResumes.map((c, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-700 text-lg' :
                        i === 1 ? 'bg-slate-200 text-slate-700' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${text}`}>{c.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-lg font-bold ${
                            c.finalScore >= 70 ? 'text-emerald-600' :
                            c.finalScore >= 50 ? 'text-yellow-600' : 'text-red-500'
                          }`}>{c.finalScore}%</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_COLORS[c.status]}`}>
                            {c.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
