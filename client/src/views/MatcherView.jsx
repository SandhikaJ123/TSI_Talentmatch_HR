import { useState, useEffect } from 'react';
import {
  FileText, Users, SlidersHorizontal, Sparkles, AlertCircle,
  Loader2, RotateCcw, ChevronRight, Trophy, Download, Cpu, Brain, Plus, Briefcase,
} from 'lucide-react';
import FileDropZone from '../components/FileDropZone';
import PreferencesPanel from '../components/PreferencesPanel';
import ResultCard from '../components/ResultCard';
import JobPostingModal from '../components/JobPostingModal';
import { useAppStore } from '../store/useAppStore';
import { submitMatch } from '../api/client';
import { getJobs } from '../api/client';
import toast from 'react-hot-toast';

// TODO: Add client-side validation for uploaded files (check if they look like resumes)
// TODO: Show warning if uploaded file doesn't appear to be a resume
// TODO: Add file content preview before submission

const STEPS = [
  { id: 1, label: 'Requirements', icon: FileText },
  { id: 2, label: 'Resumes',      icon: Users },
  { id: 3, label: 'Preferences',  icon: SlidersHorizontal },
  { id: 4, label: 'Results',      icon: Trophy },
];

export default function MatcherView() {
  const { jobs, settings, addSession, setActiveView, darkMode } = useAppStore();
  const syncJobsToStore = useAppStore((state) => state.syncJobsFromBackend);
  const defaultPrefs = settings.defaultPreferences;

  const [activeStep, setActiveStep] = useState(1);
  const [reqMode, setReqMode]       = useState('paste');
  const [reqText, setReqText]       = useState('');
  const [reqFiles, setReqFiles]     = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [jobTitle, setJobTitle]     = useState('');
  const [resumeFiles, setResumeFiles] = useState([]);
  const [preferences, setPreferences] = useState(defaultPrefs);
  const [results, setResults]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [scoredBy, setScoredBy]     = useState('hybrid');
  const [semanticEnabled, setSemanticEnabled] = useState(false);
  const [parseErrors, setParseErrors] = useState([]);
  const [showJobModal, setShowJobModal] = useState(false);

  // Load jobs from backend when component mounts (always sync with DB)
  useEffect(() => {
    const loadJobsForDropdown = async () => {
      try {
        const data = await getJobs();
        if (data.jobs && syncJobsToStore) {
          syncJobsToStore(data.jobs);
        }
      } catch (err) {
        // Silently fail - jobs dropdown will just be empty
        console.warn('Could not load jobs for dropdown:', err);
      }
    };
    
    // Always load from backend to ensure sync with database
    loadJobsForDropdown();
  }, [syncJobsToStore]);

  // Pre-fill from job posting if navigated from Jobs view
  useEffect(() => {
    const jobId = sessionStorage.getItem('selectedJobId');
    if (jobId) {
      const job = jobs.find((j) => j.id === jobId);
      if (job) {
        setSelectedJobId(jobId);
        setReqText(job.description || job.requirementsText || '');
        setJobTitle(job.title);
        setReqMode('paste');
      }
      sessionStorage.removeItem('selectedJobId');
    }
  }, []);

const customWeightTotal =
  (preferences.customCriteria || [])
    .filter(c => c.enabled !== false)
    .reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  const weightTotal =
    (Number(preferences.skillsWeight) || 0) +
    (Number(preferences.experienceWeight) || 0) +
    (Number(preferences.educationWeight) || 0) +
    (Number(preferences.overallWeight) || 0) +
    customWeightTotal; 
  const canStep1 = reqMode === 'paste' ? reqText.trim().length > 20 : reqFiles.length > 0;
  const canStep2 = resumeFiles.length > 0;
  const canStep3 = weightTotal === 100;

  const handleMatch = async () => {
    setLoading(true);
    setError('');
    setParseErrors([]);
    try {
      const response = await submitMatch({
        requirementsFile: reqMode === 'upload' ? reqFiles[0] : null,
        requirementsText: reqMode === 'paste'  ? reqText    : '',
        resumeFiles,
        jobId:       selectedJobId || undefined,
        jobTitle:    jobTitle || 'Untitled Session',
        preferences,
      });

      setResults(response.results);
      setScoredBy(response.scoredBy || 'hybrid');
      setSemanticEnabled(response.semanticEnabled || false);
      if (response.parseErrors?.length) setParseErrors(response.parseErrors);

      // Also save to local store for dashboard/candidates views
      addSession({
        id:        response.sessionId,
        jobId:     selectedJobId || null,
        jobTitle:  jobTitle || 'Untitled Session',
        preferences,
        results:   response.results,
        createdAt: new Date().toISOString(),
      });

      setActiveStep(4);
      toast.success(`Matched ${response.results.length} candidate${response.results.length !== 1 ? 's' : ''} via Hybrid engine`);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
      toast.error('Match failed — is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setActiveStep(1);
    setReqText('');
    setReqFiles([]);
    setResumeFiles([]);
    setPreferences(defaultPrefs);
    setResults([]);
    setError('');
    setJobTitle('');
    setSelectedJobId('');
    setScoredBy('');
    setParseErrors([]);
  };

  const handleJobCreated = (job) => {
    // Reload jobs to update dropdown
    if (syncJobsToStore) {
      getJobs().then(data => {
        if (data.jobs) {
          syncJobsToStore(data.jobs);
          // Auto-select the newly created job
          setSelectedJobId(job.id);
          setReqText(job.description);
          setJobTitle(job.title);
          setReqMode('paste');
        }
      }).catch(err => console.error('Failed to reload jobs:', err));
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Rank', 'Name', 'File', 'Score', 'Grade', 'Skills Score', 'Experience Score', 'Education Score', 'Matched Skills'],
      ...results.map((r, i) => [
        i + 1, r.name, r.fileName, r.finalScore, r.grade?.label,
        r.breakdown?.skills?.score, r.breakdown?.experience?.score, r.breakdown?.education?.score,
        (r.breakdown?.skills?.matched || []).join('; '),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `match-results-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const bg = `rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`;
  const text = darkMode ? 'text-white' : 'text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const inputCls = `w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500
    ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-800'}`;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Job Posting Modal */}
      {showJobModal && (
        <JobPostingModal
          onClose={() => setShowJobModal(false)}
          onJobCreated={handleJobCreated}
          darkMode={darkMode}
        />
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = activeStep === step.id;
          const isDone = activeStep > step.id;
          // Prevent going back once results are generated (step 4)
          const canGoBack = isDone && activeStep < 4;
          return (
            <div key={step.id} className="flex items-center gap-1 flex-1">
              <button
                onClick={() => canGoBack && setActiveStep(step.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all flex-1 justify-center
                  ${isActive ? 'bg-teal-600 text-white shadow-md' : ''}
                  ${isDone && activeStep < 4 ? `${darkMode ? 'bg-teal-900 text-teal-300' : 'bg-teal-100 text-teal-700'} cursor-pointer` : ''}
                  ${isDone && activeStep === 4 ? `${darkMode ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-400'} cursor-not-allowed` : ''}
                  ${!isActive && !isDone ? `${darkMode ? 'bg-slate-700 text-slate-500' : 'bg-slate-100 text-slate-400'} cursor-default` : ''}
                `}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {i < STEPS.length - 1 && <ChevronRight className={`w-4 h-4 shrink-0 ${muted}`} />}
            </div>
          );
        })}
      </div>

      {/* Step 1 — Requirements */}
      {activeStep === 1 && (
        <div className={`${bg} p-6 space-y-5`}>
          <div>
            <h2 className={`text-xl font-bold ${text}`}>Job Requirements</h2>
            <p className={`text-sm mt-1 ${muted}`}>Provide the job description to match resumes against.</p>
          </div>

          {/* Link to existing job */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-xs font-medium ${muted}`}>Select a job posting</label>
              <button
                onClick={() => setShowJobModal(true)}
                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create New Job
              </button>
            </div>
            <select
              className={inputCls}
              value={selectedJobId}
              onChange={(e) => {
                const job = jobs.find((j) => j.id === e.target.value);
                setSelectedJobId(e.target.value);
                if (job) { 
                  setReqText(job.description || job.requirementsText || ''); 
                  setJobTitle(job.title); 
                  setReqMode('paste');
                  toast.success(`Loaded: ${job.title}`);
                }
                else { setReqText(''); setJobTitle(''); }
              }}
              disabled={jobs.length === 0}
            >
              <option value="">
                {jobs.length === 0 ? '— No job postings yet (create one above) —' : '— Select a job posting —'}
              </option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} ({j.department})</option>)}
            </select>
          </div>

          {selectedJobId && (
            <div className={`flex items-center gap-2 rounded-xl p-3 ${darkMode ? 'bg-teal-900/30 border border-teal-800' : 'bg-teal-50 border border-teal-200'}`}>
              <Briefcase className="w-4 h-4 text-teal-600 shrink-0" />
              <p className={`text-sm ${darkMode ? 'text-teal-300' : 'text-teal-700'}`}>
                <span className="font-semibold">{jobTitle}</span> loaded and ready
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={() => setActiveStep(2)} disabled={!canStep1} className="flex items-center gap-2 bg-teal-600 text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
              Next: Upload Resumes <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Resumes */}
      {activeStep === 2 && (
        <div className={`${bg} p-6 space-y-5`}>
          <div>
            <h2 className={`text-xl font-bold ${text}`}>Upload Resumes</h2>
            <p className={`text-sm mt-1 ${muted}`}>Upload one or more resumes to rank against the requirements.</p>
          </div>
          <FileDropZone label="Drop resumes here" accept=".pdf,.docx,.txt" multiple={true} files={resumeFiles} onFilesChange={(files) => {
            if (files.length > 10) {
              toast.error('Maximum 10 resumes allowed. Only the first 10 have been kept.');
              setResumeFiles(files.slice(0, 10));
            } else {
              setResumeFiles(files);
            }
          }} hint="Upload up to 10 resumes — PDF, DOCX, or TXT" icon={Users} />
          {resumeFiles.length > 0 && (
            <div className={`flex items-center gap-2 rounded-xl p-3 ${darkMode ? 'bg-teal-900/30 border border-teal-800' : 'bg-teal-50 border border-teal-200'}`}>
              <Users className="w-4 h-4 text-teal-600 shrink-0" />
              <p className={`text-sm ${darkMode ? 'text-teal-300' : 'text-teal-700'}`}>
                <span className="font-semibold">{resumeFiles.length}</span> / 10 resume{resumeFiles.length !== 1 ? 's' : ''} ready
              </p>
            </div>
          )}
          <div className="flex justify-between">
            <button onClick={() => setActiveStep(1)} className={`text-sm px-4 py-2 ${muted} hover:text-slate-700 transition-colors`}>← Back</button>
            <button onClick={() => setActiveStep(3)} disabled={!canStep2} className="flex items-center gap-2 bg-teal-600 text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
              Next: Preferences <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Preferences */}
      {activeStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className={`lg:col-span-2 ${bg} p-6 space-y-5`}>
            <div>
              <h2 className={`text-xl font-bold ${text}`}>Matching Preferences</h2>
              <p className={`text-sm mt-1 ${muted}`}>Adjust how much each factor contributes to the final score.</p>
            </div>
            <PreferencesPanel preferences={preferences} onChange={setPreferences} />

            {error && (
              <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Matching Failed</p>
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                  {error.includes('API key') && (
                    <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">How to fix:</p>
                      <ol className="text-xs text-red-700 dark:text-red-400 space-y-1 list-decimal list-inside">
                        <li>Get an OpenAI API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline font-medium">platform.openai.com</a></li>
                        <li>Add it to your <code className="px-1 py-0.5 bg-red-200 dark:bg-red-900/50 rounded font-mono">server/.env</code> file as <code className="px-1 py-0.5 bg-red-200 dark:bg-red-900/50 rounded font-mono">OPENAI_API_KEY=sk-...</code></li>
                        <li>Restart the server</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-between">
              <button onClick={() => setActiveStep(2)} className={`text-sm px-4 py-2 ${muted} hover:text-slate-700 transition-colors`}>← Back</button>
              <button onClick={handleMatch} disabled={!canStep3 || loading} className="flex items-center gap-2 bg-teal-600 text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing...</> : <><Sparkles className="w-4 h-4" />Match Resumes</>}
              </button>
            </div>
          </div>
          <div className="space-y-4">
            <div className={`${bg} p-5 space-y-3`}>
              <p className={`text-sm font-semibold ${text}`}>Session Summary</p>
              <div className={`space-y-2 text-sm ${muted}`}>
                {jobTitle && <div className="flex justify-between"><span>Job</span><span className={`font-medium ${text} truncate max-w-32`}>{jobTitle}</span></div>}
                <div className="flex justify-between"><span>Requirements</span><span className={`font-medium ${text}`}>{reqMode === 'paste' ? `${reqText.length} chars` : reqFiles[0]?.name.slice(0, 15) + '...'}</span></div>
                <div className="flex justify-between"><span>Resumes</span><span className={`font-medium ${text}`}>{resumeFiles.length} files</span></div>
                {preferences.customCriteria?.filter(c => c.enabled !== false && c.term.trim()).length > 0 && (
                  <div className="flex justify-between"><span>Custom criteria</span><span className={`font-medium ${text}`}>{preferences.customCriteria.filter(c => c.enabled !== false && c.term.trim()).length}</span></div>
                )}
              </div>
            </div>
            <div className={`rounded-2xl border p-5 space-y-2 ${darkMode ? 'bg-teal-900/20 border-teal-800' : 'bg-teal-50 border-teal-200'}`}>
              <p className={`text-sm font-semibold ${darkMode ? 'text-teal-300' : 'text-teal-800'}`}>How it works</p>
              <ul className={`text-xs space-y-1.5 ${darkMode ? 'text-teal-400' : 'text-teal-700'}`}>
                <li>• Extracts keywords from requirements</li>
                <li>• Scans each resume for skill matches</li>
                <li>• Detects years of experience</li>
                <li>• Identifies education level</li>
                <li>• Calculates weighted match score</li>
                <li>• Ranks candidates by total score</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Step 4 — Results */}
      {activeStep === 4 && results.length > 0 && (
        <div className="space-y-5">
          <div className={`${bg} p-6`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className={`text-xl font-bold flex items-center gap-2 ${text}`}>
                  <Trophy className="w-5 h-5 text-amber-500" />
                  {jobTitle || 'Match Results'}
                </h2>
                <p className={`text-sm mt-1 ${muted}`}>{results.length} candidates ranked by match score</p>
                {scoredBy && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-teal-100 text-teal-700">
                      <Sparkles className="w-3 h-3" />
                      Hybrid Scored
                    </span>
                    {semanticEnabled && (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700">
                        <Sparkles className="w-3 h-3" /> Semantic vectors applied
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-end gap-2">
                {results.slice(0, 3).map((r, i) => (
                  <div key={i} className="text-center">
                    <div className={`w-12 rounded-t-lg flex items-end justify-center pb-1 text-white text-xs font-bold ${i === 0 ? 'h-14 bg-amber-400' : i === 1 ? 'h-10 bg-slate-300' : 'h-8 bg-orange-300'}`}>
                      {r.finalScore}%
                    </div>
                    <div className={`text-xs mt-1 w-12 truncate ${muted}`}>{r.name.split(' ')[0]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
              {[
                { label: 'Excellent', color: 'bg-emerald-100 text-emerald-700', count: results.filter((r) => r.finalScore >= 85).length },
                { label: 'Good',      color: 'bg-blue-100 text-blue-700',       count: results.filter((r) => r.finalScore >= 70 && r.finalScore < 85).length },
                { label: 'Fair',      color: 'bg-yellow-100 text-yellow-700',   count: results.filter((r) => r.finalScore >= 55 && r.finalScore < 70).length },
                { label: 'Below Avg', color: 'bg-orange-100 text-orange-700',   count: results.filter((r) => r.finalScore >= 40 && r.finalScore < 55).length },
                { label: 'Poor',      color: 'bg-red-100 text-red-700',         count: results.filter((r) => r.finalScore < 40).length },
              ].map((band) => (
                <div key={band.label} className={`rounded-lg p-2 ${band.color}`}>
                  <div className="font-bold text-base">{band.count}</div>
                  <div className="font-medium">{band.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {results.map((result, i) => <ResultCard key={i} result={result} rank={i + 1} darkMode={darkMode} />)}
          </div>

          <div className="flex justify-center gap-3 pb-8 flex-wrap">
            <button onClick={exportCSV} className={`flex items-center gap-2 text-sm border px-5 py-2.5 rounded-xl transition-all ${darkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
              <Download className="w-4 h-4" />Export CSV
            </button>
            <button onClick={handleReset} className="flex items-center gap-2 text-sm bg-teal-600 text-white px-5 py-2.5 rounded-xl hover:bg-teal-700 transition-all shadow-sm">
              <RotateCcw className="w-4 h-4" />New Search
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
