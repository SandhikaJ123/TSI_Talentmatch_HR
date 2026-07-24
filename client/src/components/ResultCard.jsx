import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import CandidateInsightsModal from './CandidateInsightsModal';

const GRADE_STYLES = {
  emerald: { badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', ring: 'ring-emerald-400', bar: 'bg-emerald-500', score: 'text-emerald-600', border: 'border-l-emerald-500' },
  blue:    { badge: 'bg-blue-100 text-blue-800 border-blue-200',          ring: 'ring-blue-400',    bar: 'bg-blue-500',    score: 'text-blue-600',    border: 'border-l-blue-500' },
  yellow:  { badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',    ring: 'ring-yellow-400',  bar: 'bg-yellow-500',  score: 'text-yellow-600',  border: 'border-l-yellow-500' },
  orange:  { badge: 'bg-orange-100 text-orange-800 border-orange-200',    ring: 'ring-orange-400',  bar: 'bg-orange-500',  score: 'text-orange-600',  border: 'border-l-orange-500' },
  red:     { badge: 'bg-red-100 text-red-800 border-red-200',             ring: 'ring-red-400',     bar: 'bg-red-500',     score: 'text-red-600',     border: 'border-l-red-500' },
};

export default function ResultCard({ result, rank, darkMode, jobTitle, sessionId, setCandidateStatus, status, onSelect }) {
  // Fallback self-managed overlay — only used if the parent hasn't been
  // updated to own the "selected candidate" state itself (see JobsView's
  // SessionDetailView for the preferred pattern: a view-swap that keeps
  // the dashboard in the normal page flow, beside the sidebar, instead of
  // a position:fixed overlay that has to guess the sidebar's width).
  const [showModal, setShowModal] = useState(false);
  const style = GRADE_STYLES[result.grade?.color] || GRADE_STYLES.red;

  const cardBg = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const textMain = darkMode ? 'text-white' : 'text-slate-800';
  const textMuted = darkMode ? 'text-slate-400' : 'text-slate-500';

  const candidateForModal = {
    id:                    result.id,
    sessionId:             result.sessionId || sessionId,
    name:                  result.name,
    fileName:              result.fileName,
    jobTitle:              result.jobTitle || jobTitle || '',
    finalScore:            result.finalScore,
    grade:                 result.grade,
    rank,
    breakdown:             result.breakdown,
    strengths:             result.strengths,
    weaknesses:            result.weaknesses,
    summary:               result.summary,
    title:                 result.title,
    location:              result.location,
    email:                 result.email,
    phone:                 result.phone,
    interviewFocusAreas:   result.interviewFocusAreas,
    interviewQuestions:    result.interviewQuestions,
    topInterviewQuestions: result.topInterviewQuestions,
  };

  const handleClick = () => {
    if (onSelect) {
      onSelect(candidateForModal);
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`w-full text-left rounded-xl border border-l-4 ${style.border} ${cardBg} shadow-sm hover:shadow-md transition-all overflow-hidden group`}
      >
        <div className="flex items-center gap-4 p-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ring-2 ${style.ring} ${
            rank === 1 ? 'bg-amber-400 text-white ring-amber-300' :
            rank === 2 ? 'bg-slate-300 text-slate-700 ring-slate-200' :
            rank === 3 ? 'bg-orange-300 text-white ring-orange-200' :
            darkMode ? 'bg-slate-700 text-slate-300 ring-slate-600' : 'bg-slate-100 text-slate-600 ring-slate-200'
          }`}>
            #{rank}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold truncate ${textMain}`}>{result.name}</p>
            {result.title && <p className={`text-xs truncate ${textMuted} font-medium`}>{result.title}</p>}
            <p className={`text-xs truncate ${textMuted}`}>{result.fileName}</p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-2xl font-bold ${style.score}`}>{result.finalScore}%</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${style.badge}`}>{result.grade?.label}</span>
          </div>
          <ChevronRight className={`w-5 h-5 ${textMuted} shrink-0 transition-transform group-hover:translate-x-0.5`} />
        </div>

        <div className="px-4 pb-3">
          <div className={`h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
            <div className={`h-full rounded-full transition-all duration-700 ${style.bar}`} style={{ width: `${result.finalScore}%` }} />
          </div>
        </div>
      </button>

      {/* Only rendered when no onSelect is provided — see comment above */}
      {!onSelect && showModal && (
        <CandidateInsightsModal
          candidate={candidateForModal}
          onClose={() => setShowModal(false)}
          darkMode={darkMode}
          setCandidateStatus={setCandidateStatus}
          status={status}
        />
      )}
    </>
  );
}