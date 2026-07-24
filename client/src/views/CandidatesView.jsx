import { useState, useEffect } from 'react';
import { Search, Download, GitCompare, Trash2, Eye } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getCandidates, deleteCandidate } from '../api/client';
import toast from 'react-hot-toast';
import CandidateInsightsModal from '../components/CandidateInsightsModal';
import CandidateComparisonModal from '../components/CandidateComparisonModal';

const STATUSES = ['new', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'];

const STATUS_STYLES = {
  new:         'bg-slate-100 text-slate-700 border-slate-200',
  shortlisted: 'bg-blue-100 text-blue-700 border-blue-200',
  interview:   'bg-violet-100 text-violet-700 border-violet-200',
  offered:     'bg-amber-100 text-amber-700 border-amber-200',
  hired:       'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected:    'bg-red-100 text-red-700 border-red-200',
};

const GRADE_COLORS = {
  emerald: 'text-emerald-600',
  blue:    'text-blue-600',
  yellow:  'text-yellow-600',
  orange:  'text-orange-600',
  red:     'text-red-500',
};

// Reads a list field that may arrive as either shape depending on backend version:
//   - new backend (routes/candidates.py, patched): already a camelCase parsed array
//   - old backend: a snake_case JSON-string column
// Tries the camelCase key first (already-parsed array), then falls back to the
// snake_case key (parsing it if it's still a JSON string), then [].
function readListField(c, camelKey, snakeKey) {
  if (Array.isArray(c[camelKey])) return c[camelKey];
  const raw = c[snakeKey];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
}

export default function CandidatesView() {
  const { candidateStatuses, setCandidateStatus, darkMode } = useAppStore();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [selected, setSelected] = useState(null);
  const [selectedForComparison, setSelectedForComparison] = useState([]);
  const [showComparison, setShowComparison] = useState(false);

  // Load candidates from database
  useEffect(() => {
    const loadCandidates = async () => {
      try {
        setLoading(true);
        const data = await getCandidates();
        setCandidates(data.candidates || []);
      } catch (err) {
        console.error('Failed to load candidates:', err);
        toast.error('Failed to load candidates');
      } finally {
        setLoading(false);
      }
    };
    loadCandidates();
  }, []);

  const allCandidates = candidates.map((c) => {
    const breakdown = typeof c.breakdown === 'string' ? JSON.parse(c.breakdown) : (c.breakdown || {});
    const strengths  = typeof c.strengths  === 'string' ? JSON.parse(c.strengths)  : (c.strengths  || []);
    const weaknesses = typeof c.weaknesses === 'string' ? JSON.parse(c.weaknesses) : (c.weaknesses || []);
    const grade      = typeof c.grade      === 'string' ? JSON.parse(c.grade)      : (c.grade      || { label: c.grade_label || 'N/A', color: c.grade_color || 'red' });
    return {
      id:         c.id,
      name:       c.name,
      fileName:   c.file_name,
      finalScore: c.final_score,
      grade,
      breakdown,
      strengths,
      weaknesses,
      summary:    c.summary || '',
      interviewFocusAreas: readListField(c, 'interviewFocusAreas', 'interview_focus_areas'),
      interviewQuestions: readListField(c, 'interviewQuestions', 'interview_questions'),
      // Was missing entirely before — this is why "Relevant interview questions" never
      // showed up when opening a candidate from the Resumes page.
      topInterviewQuestions: readListField(c, 'topInterviewQuestions', 'top_interview_questions'),
      sessionId:  c.session_id,
      jobTitle:   c.job_title || 'Untitled',
      title:      c.title || '',
      location:   c.location || '',
      email:      c.email || '',
      phone:      c.phone || '',
      status:     candidateStatuses[`${c.session_id}-${c.file_name}`] || c.status || 'new',
    };
  });

  const toggleCandidateSelection = (candidate) => {
    const key = `${candidate.sessionId}-${candidate.fileName}`;
    setSelectedForComparison(prev => {
      const isSelected = prev.some(c => `${c.sessionId}-${c.fileName}` === key);
      if (isSelected) {
        return prev.filter(c => `${c.sessionId}-${c.fileName}` !== key);
      } else {
        if (prev.length >= 5) {
          toast.error('Maximum 5 candidates can be compared');
          return prev;
        }
        return [...prev, candidate];
      }
    });
  };

  const startComparison = () => {
    if (selectedForComparison.length < 2) {
      toast.error('Select at least 2 candidates to compare');
      return;
    }
    setShowComparison(true);
  };

  const clearSelection = () => {
    setSelectedForComparison([]);
  };

  const handleDelete = async (candidate) => {
    if (!confirm(`Delete ${candidate.name}? This cannot be undone.`)) return;
    try {
      await deleteCandidate(candidate.id);
      setCandidates(prev => prev.filter(c => c.id !== candidate.id));
      toast.success(`${candidate.name} deleted`);
    } catch (err) {
      toast.error('Failed to delete candidate');
    }
  };

  const filtered = allCandidates
    .filter((c) => {
      const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.jobTitle.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'score') return b.finalScore - a.finalScore;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return 0;
    });

  const exportCSV = () => {
    const rows = [
      ['Name', 'File', 'Job', 'Score', 'Grade', 'Status', 'Skills Score', 'Experience Score', 'Education Score', 'Matched Skills'],
      ...filtered.map((c) => [
        c.name, c.fileName, c.jobTitle, c.finalScore, c.grade?.label, c.status,
        c.breakdown?.skills?.score, c.breakdown?.experience?.score, c.breakdown?.education?.score,
        (c.breakdown?.skills?.matched || []).join('; '),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'candidates.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const card = `rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`;
  const text = darkMode ? 'text-white' : 'text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const inputCls = `border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500
    ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-800'}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className={`w-8 h-8 border-4 border-t-teal-500 border-slate-200 rounded-full animate-spin mx-auto mb-2`}></div>
          <p className={`text-sm ${muted}`}>Loading candidates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {selected && (
        <CandidateInsightsModal 
          candidate={selected} 
          onClose={() => setSelected(null)} 
          darkMode={darkMode}
          setCandidateStatus={setCandidateStatus}
          status={candidateStatuses[`${selected.sessionId}-${selected.fileName}`] || 'new'}
        />
      )}

      {showComparison && selectedForComparison.length >= 2 && (
        <CandidateComparisonModal
          candidates={selectedForComparison}
          onClose={() => {
            setShowComparison(false);
            clearSelection();
          }}
          darkMode={darkMode}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${muted}`} />
          <input
            className={`${inputCls} pl-9 w-full`}
            placeholder="Search candidates or jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={inputCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
        <select className={inputCls} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="score">Sort: Score</option>
          <option value="name">Sort: Name</option>
          <option value="status">Sort: Status</option>
        </select>
        
        {/* Comparison Controls */}
        {selectedForComparison.length > 0 && (
          <>
            <button
              onClick={startComparison}
              disabled={selectedForComparison.length < 2}
              className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <GitCompare className="w-4 h-4" />
              Compare ({selectedForComparison.length})
            </button>
            <button
              onClick={clearSelection}
              className="flex items-center gap-2 border border-slate-300 text-slate-600 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
          </>
        )}
        
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 border border-slate-300 text-slate-600 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className={`text-sm ${muted}`}>{filtered.length} candidate{filtered.length !== 1 ? 's' : ''}</p>
        {selectedForComparison.length > 0 && (
          <p className={`text-sm ${muted}`}>
            {selectedForComparison.length} selected for comparison
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className={`${card} p-12 text-center`}>
          <p className={`font-medium ${text}`}>No candidates found</p>
          <p className={`text-sm mt-1 ${muted}`}>Run a match session to populate candidates</p>
        </div>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={`border-b ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-100 bg-slate-50'}`}>
                <tr>
                  {['', 'Candidate', 'Job', 'Score', 'Skills', 'Experience', 'Education', 'Status', ''].map((h, i) => (
                    <th key={i} className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider ${muted}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                {filtered.map((c, i) => {
                  const isSelectedForComparison = selectedForComparison.some(
                    sc => `${sc.sessionId}-${sc.fileName}` === `${c.sessionId}-${c.fileName}`
                  );
                  
                  return (
                    <tr
                      key={i}
                      className={`transition-colors ${
                        isSelectedForComparison 
                          ? darkMode ? 'bg-violet-900/30' : 'bg-violet-50' 
                          : darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelectedForComparison}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleCandidateSelection(c);
                          }}
                          className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500"
                        />
                      </td>
                      <td 
                        className={`px-4 py-3 cursor-pointer`}
                        onClick={() => setSelected(c)}
                      >
                        <div className="flex flex-col">
                          <span className={`font-medium ${text}`}>{c.name}</span>
                          <span className={`text-xs ${muted}`}>{c.fileName}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-xs ${muted}`}>{c.jobTitle}</td>
                      <td className={`px-4 py-3 font-bold ${GRADE_COLORS[c.grade?.color] || 'text-slate-600'}`}>{c.finalScore}%</td>
                      <td className={`px-4 py-3 text-xs ${muted}`}>{c.breakdown?.skills?.score}%</td>
                      <td className={`px-4 py-3 text-xs ${muted}`}>{(() => { const y = c.breakdown?.experience?.years ?? c.breakdown?.experience?.detectedYears; return y < 1 && y > 0 ? `${Math.round(y * 12)}m` : y ? `${y}y` : '—'; })()}</td>
                      <td className={`px-4 py-3 text-xs ${muted}`}>{c.breakdown?.education?.level || c.breakdown?.education?.label}</td>
                      <td className="px-4 py-3">
                        <select
                          value={c.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            setCandidateStatus(c.sessionId, c.fileName, e.target.value);
                            toast.success(`${c.name} moved to ${e.target.value}`);
                          }}
                          className={`text-xs px-2 py-1 rounded-lg border font-medium capitalize cursor-pointer
                            ${STATUS_STYLES[c.status]} focus:outline-none`}
                        >
                          {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelected(c)}
                            className={`p-1.5 rounded-lg transition-colors hover:bg-teal-100 text-teal-600`}
                            title="View candidate"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                            className={`p-1.5 rounded-lg transition-colors hover:bg-red-100 text-red-500`}
                            title="Delete candidate"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}