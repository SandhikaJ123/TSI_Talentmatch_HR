import { useState, useEffect } from 'react';
import {
  Briefcase, Plus, Search, MapPin, Calendar, Users, Trash2, CheckCircle, XCircle,
  Loader2, Upload, FileText, X, Building2, Clock, ChevronRight, ArrowLeft, Trophy, Target,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getJobs, createJob, updateJobStatus, deleteJob, parseJobDescription, getSessions } from '../api/client';
import ResultCard from '../components/ResultCard';
import toast from 'react-hot-toast';

export default function JobsView() {
  const { darkMode } = useAppStore();
  const [jobs, setJobs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsData, sessionsData] = await Promise.all([
        getJobs(),
        getSessions(),
      ]);
      setJobs(jobsData.jobs || []);
      setSessions(sessionsData.sessions || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (job) => {
    const newStatus = job.status === 'active' ? 'closed' : 'active';
    try {
      await updateJobStatus(job.id, newStatus);
      setJobs(jobs.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
      toast.success(`Job ${newStatus === 'active' ? 'activated' : 'closed'}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (jobId) => {
    if (!confirm('Delete this job posting? This cannot be undone.')) return;
    try {
      await deleteJob(jobId);
      setJobs(jobs.filter(j => j.id !== jobId));
      toast.success('Job deleted');
    } catch (err) {
      toast.error('Failed to delete job');
    }
  };

  const handleJobCreated = (newJob) => {
    setJobs([newJob, ...jobs]);
    setShowCreateModal(false);
  };

  // Get session count per job
  const getJobSessionCount = (jobId) => {
    return sessions.filter(s => s.job_id === jobId).length;
  };

  // Get sessions for selected job
  const getJobSessions = (jobId) => {
    return sessions.filter(s => s.job_id === jobId).sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
  };

  const filteredJobs = jobs.filter(j => 
    searchQuery === '' ||
    j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    j.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    j.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const bg = `rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`;
  const text = darkMode ? 'text-white' : 'text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';

  // View: Session Details (Candidates)
  if (selectedSession) {
    return (
      <SessionDetailView
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
        darkMode={darkMode}
      />
    );
  }

  // View: Job Sessions List
  if (selectedJob) {
    const jobSessions = getJobSessions(selectedJob.id);
    
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-5">
        {/* Back Button */}
        <button
          onClick={() => setSelectedJob(null)}
          className={`flex items-center gap-2 text-sm ${muted} hover:${text} transition-colors`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Postings
        </button>

        {/* Job Header */}
        <div className={`${bg} p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className={`text-2xl font-bold ${text}`}>{selectedJob.title}</h1>
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium
                  ${selectedJob.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                  }
                `}>
                  {selectedJob.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {selectedJob.status === 'active' ? 'Active' : 'Closed'}
                </span>
              </div>

              <div className={`flex items-center gap-4 mt-2 text-sm ${muted} flex-wrap`}>
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  {selectedJob.department}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {selectedJob.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {selectedJob.type}
                </span>
                <span className="flex items-center gap-1.5">
                  <Target className="w-4 h-4" />
                  {jobSessions.length} matching session{jobSessions.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div>
          <h2 className={`text-lg font-bold mb-4 ${text}`}>Matching Sessions</h2>
          {jobSessions.length === 0 ? (
            <div className={`${bg} p-12 text-center`}>
              <Target className={`w-12 h-12 mx-auto mb-3 ${muted}`} />
              <p className={`font-medium ${text}`}>No matching sessions yet</p>
              <p className={`text-sm mt-1 ${muted}`}>Run a match from the Matcher tab to see results here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {jobSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onClick={() => setSelectedSession(session)}
                  darkMode={darkMode}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // View: Jobs List (Default)
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div />
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-teal-700 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create New Job
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Jobs', value: jobs.length, icon: Briefcase, color: 'blue' },
          { label: 'Active', value: jobs.filter(j => j.status === 'active').length, icon: CheckCircle, color: 'emerald' },
          { label: 'Total Sessions', value: sessions.filter(s => s.candidate_count > 0).length, icon: Target, color: 'violet' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`${bg} p-5`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-medium ${muted}`}>{stat.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${text}`}>{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-${stat.color}-100 flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className={`${bg} p-4`}>
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${muted}`} />
          <input
            type="text"
            placeholder="Search by title, department, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500
              ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-800'}
            `}
          />
        </div>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className={`w-8 h-8 animate-spin ${muted}`} />
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className={`${bg} p-12 text-center`}>
          <Briefcase className={`w-12 h-12 mx-auto mb-3 ${muted}`} />
          <p className={`font-medium ${text}`}>No job postings found</p>
          <p className={`text-sm mt-1 ${muted}`}>
            {searchQuery ? 'Try adjusting your search' : 'Create your first job posting to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              sessionCount={getJobSessionCount(job.id)}
              darkMode={darkMode}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
              onClick={() => setSelectedJob(job)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateJobModal
          onClose={() => setShowCreateModal(false)}
          onJobCreated={handleJobCreated}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}


function JobCard({ job, sessionCount, darkMode, onToggleStatus, onDelete, onClick }) {
  const [expanded, setExpanded] = useState(false);
  const bg = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const text = darkMode ? 'text-white' : 'text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';

  // Format date properly
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Recently';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Recently';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  // Get top skills to display
  const topSkills = job.required_skills?.slice(0, 6) || [];

  return (
    <div className={`rounded-2xl border shadow-sm ${bg} p-5 space-y-4 cursor-pointer hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between gap-4" onClick={onClick}>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className={`text-lg font-bold ${text}`}>{job.title}</h3>
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium
              ${job.status === 'active'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-600'
              }
            `}>
              {job.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {job.status === 'active' ? 'Active' : 'Closed'}
            </span>
            {sessionCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-violet-100 text-violet-700">
                <Target className="w-3 h-3" />
                {sessionCount} session{sessionCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className={`flex items-center gap-4 mt-2 text-sm ${muted} flex-wrap`}>
            {job.department && job.department.trim() && (
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                {job.department}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {job.location || 'Remote'}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {job.type || 'Full-time'}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDate(job.created_at)}
            </span>
          </div>

          {/* Skills */}
          {topSkills.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {topSkills.map((skill, idx) => (
                <span
                  key={idx}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium
                    ${darkMode ? 'bg-teal-900/30 text-teal-300' : 'bg-teal-50 text-teal-700'}
                  `}
                >
                  {skill}
                </span>
              ))}
              {job.required_skills?.length > 6 && (
                <span className={`text-xs ${muted}`}>
                  +{job.required_skills.length - 6} more
                </span>
              )}
            </div>
          )}

          {expanded && (
            <div className={`mt-4 p-4 rounded-xl text-sm ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
              <p className={`font-medium mb-2 ${text}`}>Job Description:</p>
              <p className={`whitespace-pre-wrap ${muted}`}>{job.description}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setExpanded(!expanded)}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
            title="View details"
          >
            <FileText className={`w-4 h-4 ${muted}`} />
          </button>
          <button
            onClick={() => onToggleStatus(job)}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
            title={job.status === 'active' ? 'Close job' : 'Activate job'}
          >
            {job.status === 'active' ? (
              <XCircle className="w-4 h-4 text-slate-500" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            )}
          </button>
          <button
            onClick={() => onDelete(job.id)}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
            title="Delete job"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionCard({ session, onClick, darkMode }) {
  const bg = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const text = darkMode ? 'text-white' : 'text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border shadow-sm ${bg} p-5 cursor-pointer hover:shadow-md transition-all group`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className={`font-bold ${text}`}>{session.job_title || 'Untitled Session'}</h3>
              <div className={`flex items-center gap-3 text-sm ${muted} mt-1`}>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(session.created_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {session.result_count} candidate{session.result_count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
        <ChevronRight className={`w-5 h-5 ${muted} group-hover:translate-x-1 transition-transform`} />
      </div>
    </div>
  );
}

function SessionDetailView({ session, onBack, darkMode }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCandidates();
  }, [session.id]);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/sessions/${session.id}`);
      const data = await response.json();
      setCandidates(data.candidates || []);
    } catch (err) {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  const bg = `rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`;
  const text = darkMode ? 'text-white' : 'text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Back Button */}
      <button
        onClick={onBack}
        className={`flex items-center gap-2 text-sm ${muted} hover:${text} transition-colors`}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Sessions
      </button>

      {/* Session Header */}
      <div className={`${bg} p-6`}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${text}`}>{session.job_title || 'Matching Session'}</h1>
            <p className={`text-sm ${muted}`}>
              {new Date(session.created_at).toLocaleDateString()} • {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Score Distribution */}
        <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
          {[
            { label: 'Excellent', color: 'bg-emerald-100 text-emerald-700', count: candidates.filter((c) => c.final_score >= 85).length },
            { label: 'Good', color: 'bg-blue-100 text-blue-700', count: candidates.filter((c) => c.final_score >= 70 && c.final_score < 85).length },
            { label: 'Fair', color: 'bg-yellow-100 text-yellow-700', count: candidates.filter((c) => c.final_score >= 55 && c.final_score < 70).length },
            { label: 'Below Avg', color: 'bg-orange-100 text-orange-700', count: candidates.filter((c) => c.final_score >= 40 && c.final_score < 55).length },
            { label: 'Poor', color: 'bg-red-100 text-red-700', count: candidates.filter((c) => c.final_score < 40).length },
          ].map((band) => (
            <div key={band.label} className={`rounded-lg p-2 ${band.color}`}>
              <div className="font-bold text-base">{band.count}</div>
              <div className="font-medium">{band.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Candidates List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className={`w-8 h-8 animate-spin ${muted}`} />
        </div>
      ) : candidates.length === 0 ? (
        <div className={`${bg} p-12 text-center`}>
          <Users className={`w-12 h-12 mx-auto mb-3 ${muted}`} />
          <p className={`font-medium ${text}`}>No candidates found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map((candidate, i) => {
            const breakdown = typeof candidate.breakdown === 'string' 
              ? JSON.parse(candidate.breakdown) 
              : candidate.breakdown;
            const strengths  = typeof candidate.strengths  === 'string' ? JSON.parse(candidate.strengths  || '[]') : (candidate.strengths  || []);
            const weaknesses = typeof candidate.weaknesses === 'string' ? JSON.parse(candidate.weaknesses || '[]') : (candidate.weaknesses || []);

            const result = {
              name:       candidate.name,
              title:      candidate.title || '',
              location:   candidate.location || '',
              email:      candidate.email || '',
              phone:      candidate.phone || '',
              fileName:   candidate.file_name,
              finalScore: candidate.final_score,
              grade:      { label: candidate.grade_label, color: candidate.grade_color },
              breakdown,
              strengths,
              weaknesses,
              summary:    candidate.summary || '',
            };
            
            return <ResultCard key={i} result={result} rank={i + 1} darkMode={darkMode} />;
          })}
        </div>
      )}
    </div>
  );
}

function CreateJobModal({ onClose, onJobCreated, darkMode }) {
  const [mode, setMode] = useState('paste');
  const [description, setDescription] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const isValid = mode === 'paste' ? description.trim().length > 20 : uploadFile;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setUploadFile(file);
  };

  const handleCreate = async () => {
    if (!isValid) return;

    setSaving(true);
    try {
      let jobDescription = description;

      // If upload mode, parse file first
      if (mode === 'upload' && uploadFile) {
        const parseResult = await parseJobDescription({
          file: uploadFile,
          text: '',
          useAI: true,
        });
        jobDescription = parseResult.parsed.rawText || parseResult.parsed.description || '';
      }

      // Parse to extract structured fields
      const parseResult = await parseJobDescription({
        file: null,
        text: jobDescription,
        useAI: true,
      });

      // Create job
      const result = await createJob({
        title: parseResult.parsed.title || 'Untitled Position',
        department: parseResult.parsed.department || 'Other',
        location: parseResult.parsed.location || 'Not specified',
        type: parseResult.parsed.type || 'Full-time',
        description: jobDescription,
      });

      toast.success('Job posting created!');
      onJobCreated(result.job);
    } catch (err) {
      toast.error(err.message || 'Failed to create job');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = `w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500
    ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-800'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Create Job Posting</h2>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Paste or upload job description — we'll extract the details
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Mode Toggle */}
          <div className={`flex gap-2 p-1 rounded-xl w-fit ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
            {[{ id: 'paste', label: 'Paste Text' }, { id: 'upload', label: 'Upload File' }].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                type="button"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${mode === m.id
                    ? `bg-white text-teal-700 shadow-sm ${darkMode ? 'bg-slate-600 text-teal-300' : ''}`
                    : `${darkMode ? 'text-slate-400' : 'text-slate-500'} hover:text-slate-700`
                  }
                `}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === 'paste' ? (
            <>
              <textarea
                className={`${inputCls} resize-none`}
                rows={12}
                placeholder="Paste the full job description here. Include title, department, location, requirements, skills..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
              />
              <p className={`text-xs text-right ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {description.length} characters
              </p>
            </>
          ) : (
            <div>
              <label
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all block
                  ${uploadFile
                    ? darkMode ? 'border-teal-600 bg-teal-900/20' : 'border-teal-500 bg-teal-50'
                    : darkMode ? 'border-slate-600 hover:border-teal-500' : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'
                  }`}
              >
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload className={`w-8 h-8 mx-auto mb-2 ${uploadFile ? 'text-teal-600' : darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <p className={`font-medium ${uploadFile ? 'text-teal-600' : darkMode ? 'text-white' : 'text-slate-700'}`}>
                  {uploadFile ? uploadFile.name : 'Drop your job description file here'}
                </p>
                <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {uploadFile ? `${(uploadFile.size / 1024).toFixed(0)} KB` : 'PDF, DOCX, or TXT — up to 10 MB'}
                </p>
              </label>
              {uploadFile && (
                <button
                  onClick={() => setUploadFile(null)}
                  className={`text-xs mt-2 ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Remove file
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex justify-end gap-2 p-5 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <button
            onClick={onClose}
            type="button"
            className={`px-4 py-2 rounded-xl text-sm ${darkMode ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-100'} transition-colors`}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid || saving}
            type="button"
            className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Briefcase className="w-4 h-4" />
                Create Job
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
