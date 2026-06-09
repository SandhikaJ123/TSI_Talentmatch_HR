import { useState } from 'react';
import { ChevronDown, ChevronUp, Award, Briefcase, GraduationCap, Zap, Tag, Sparkles } from 'lucide-react';

const GRADE_STYLES = {
  emerald: { badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', ring: 'ring-emerald-400', bar: 'bg-emerald-500', score: 'text-emerald-600', border: 'border-l-emerald-500' },
  blue:    { badge: 'bg-blue-100 text-blue-800 border-blue-200',          ring: 'ring-blue-400',    bar: 'bg-blue-500',    score: 'text-blue-600',    border: 'border-l-blue-500' },
  yellow:  { badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',    ring: 'ring-yellow-400',  bar: 'bg-yellow-500',  score: 'text-yellow-600',  border: 'border-l-yellow-500' },
  orange:  { badge: 'bg-orange-100 text-orange-800 border-orange-200',    ring: 'ring-orange-400',  bar: 'bg-orange-500',  score: 'text-orange-600',  border: 'border-l-orange-500' },
  red:     { badge: 'bg-red-100 text-red-800 border-red-200',             ring: 'ring-red-400',     bar: 'bg-red-500',     score: 'text-red-600',     border: 'border-l-red-500' },
};

const BREAKDOWN_ITEMS = [
  { key: 'skills',     label: 'Skills Match', icon: Zap,           color: 'bg-teal-500' },
  { key: 'experience', label: 'Experience',   icon: Briefcase,     color: 'bg-violet-500' },
  { key: 'education',  label: 'Education',    icon: GraduationCap, color: 'bg-blue-500' },
  { key: 'tfidf',      label: 'Relevance',    icon: Award,         color: 'bg-cyan-500' },
  { key: 'semantic',   label: 'Semantic',     icon: Sparkles,      color: 'bg-emerald-500' },
];

export default function ResultCard({ result, rank, darkMode }) {
  const [expanded, setExpanded] = useState(rank <= 3);
  const [showAllMatched, setShowAllMatched] = useState(false);
  const [showAllMissing, setShowAllMissing] = useState(false);
  const style = GRADE_STYLES[result.grade?.color] || GRADE_STYLES.red;

  const cardBg = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const expandBg = darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100';
  const innerCard = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const textMain = darkMode ? 'text-white' : 'text-slate-800';
  const textMuted = darkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`rounded-xl border border-l-4 ${style.border} ${cardBg} shadow-sm hover:shadow-md transition-shadow overflow-hidden`}>
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
        <button onClick={() => setExpanded(!expanded)} className={`${textMuted} hover:text-slate-600 transition-colors shrink-0`}>
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      <div className="px-4 pb-3">
        <div className={`h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
          <div className={`h-full rounded-full transition-all duration-700 ${style.bar}`} style={{ width: `${result.finalScore}%` }} />
        </div>
      </div>

      {expanded && (
        <div className={`border-t p-4 space-y-4 ${expandBg}`}>
          <p className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>Score Breakdown</p>
          <div className="grid grid-cols-2 gap-3">
            {BREAKDOWN_ITEMS.map(({ key, label, icon: Icon, color }) => {
              const data = result.breakdown?.[key];
              if (!data) return null;
              return (
                <div key={key} className={`rounded-lg p-3 border ${innerCard}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-3.5 h-3.5 text-slate-500" />
                    <span className={`text-xs font-medium ${textMuted}`}>{label}</span>
                  </div>
                  <div className="flex items-end justify-between mb-1.5">
                    <span className={`text-lg font-bold ${textMain}`}>{data.score}%</span>
                    {key === 'experience' && <span className={`text-xs ${textMuted}`}>{data.years ?? data.detectedYears} yrs</span>}
                    {key === 'education'  && <span className={`text-xs ${textMuted} truncate max-w-[80px]`}>{data.level || data.label}</span>}
                    {key === 'skills'     && <span className={`text-xs ${textMuted}`}>{data.matched?.length}/{data.total}</span>}
                    {key === 'semantic'   && <span className={`text-xs ${textMuted}`}>sim {data.similarity}</span>}
                  </div>
                  <div className={`h-1 rounded-full overflow-hidden ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${data.score}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {result.breakdown?.skills?.matched?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="w-3.5 h-3.5 text-emerald-500" />
                <p className={`text-xs font-semibold ${textMain}`}>✅ Matched Skills ({result.breakdown.skills.matched.length})</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(showAllMatched ? result.breakdown.skills.matched : result.breakdown.skills.matched.slice(0, 20)).map((skill) => (
                  <span key={skill} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-md font-medium">{skill}</span>
                ))}
                {result.breakdown.skills.matched.length > 20 && (
                  <button
                    onClick={() => setShowAllMatched(!showAllMatched)}
                    className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                      darkMode 
                        ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30' 
                        : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {showAllMatched ? '− Show less' : `+${result.breakdown.skills.matched.length - 20} more`}
                  </button>
                )}
              </div>
            </div>
          )}

          {result.breakdown?.skills?.missing?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="w-3.5 h-3.5 text-red-500" />
                <p className={`text-xs font-semibold ${textMain}`}>❌ Missing Skills ({result.breakdown.skills.missing.length})</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(showAllMissing ? result.breakdown.skills.missing : result.breakdown.skills.missing.slice(0, 15)).map((skill) => (
                  <span key={skill} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md font-medium">{skill}</span>
                ))}
                {result.breakdown.skills.missing.length > 15 && (
                  <button
                    onClick={() => setShowAllMissing(!showAllMissing)}
                    className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                      darkMode 
                        ? 'text-red-400 hover:text-red-300 hover:bg-red-900/30' 
                        : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                    }`}
                  >
                    {showAllMissing ? '− Show less' : `+${result.breakdown.skills.missing.length - 15} more`}
                  </button>
                )}
              </div>
            </div>
          )}

          {result.strengths && result.strengths.length > 0 && (
            <div className={`rounded-lg p-3 border ${darkMode ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Award className="w-4 h-4 text-emerald-600" />
                <p className={`text-sm font-semibold ${darkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>💪 Strengths</p>
              </div>
              <ul className="space-y-1">
                {result.strengths.map((strength, i) => (
                  <li key={i} className={`text-sm ${darkMode ? 'text-emerald-200' : 'text-emerald-700'}`}>
                    • {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.weaknesses && result.weaknesses.length > 0 && (
            <div className={`rounded-lg p-3 border ${darkMode ? 'bg-orange-900/20 border-orange-800' : 'bg-orange-50 border-orange-200'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <ChevronDown className="w-4 h-4 text-orange-600" />
                <p className={`text-sm font-semibold ${darkMode ? 'text-orange-300' : 'text-orange-800'}`}>⚠️ Areas for Improvement</p>
              </div>
              <ul className="space-y-1">
                {result.weaknesses.map((weakness, i) => (
                  <li key={i} className={`text-sm ${darkMode ? 'text-orange-200' : 'text-orange-700'}`}>
                    • {weakness}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.summary && (
            <div className={`rounded-lg p-4 border-l-4 ${darkMode ? 'bg-blue-900/20 border-blue-600' : 'bg-blue-50 border-blue-400'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <p className={`text-sm font-semibold ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>📝 AI Summary</p>
              </div>
              <p className={`text-sm leading-relaxed ${darkMode ? 'text-blue-200' : 'text-blue-700'}`}>
                {result.summary}
              </p>
            </div>
          )}

          {result.breakdown?.experience && (
            <div className={`text-xs ${textMuted} pt-2 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <strong>Experience Details:</strong> {result.breakdown.experience.detectedYears || 0} years detected 
              {result.breakdown.experience.requiredYears && ` (${result.breakdown.experience.requiredYears} required)`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
