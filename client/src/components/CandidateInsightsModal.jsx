import { useState } from 'react';
import { 
  X, Zap, Briefcase, GraduationCap, Award, TrendingUp, TrendingDown, 
  AlertTriangle, CheckCircle, Sparkles, Loader, ChevronDown, ChevronUp,
  Target, Brain, MessageSquare
} from 'lucide-react';
import { explainCandidate, explainScore } from '../api/client';
import toast from 'react-hot-toast';

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

const STATUSES = ['new', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'];

export default function CandidateInsightsModal({ 
  candidate, 
  onClose, 
  darkMode, 
  setCandidateStatus,
  status 
}) {
  const [aiInsights, setAiInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [scoreExplanations, setScoreExplanations] = useState({});
  const [loadingScore, setLoadingScore] = useState(null);
  const [showFullInsights, setShowFullInsights] = useState(false);

  const bg = darkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const border = darkMode ? 'border-slate-700' : 'border-slate-200';
  const cardBg = darkMode ? 'bg-slate-700' : 'bg-slate-50';

  const loadAIInsights = async () => {
    if (aiInsights) {
      setShowFullInsights(!showFullInsights);
      return;
    }

    setLoadingInsights(true);
    try {
      const response = await explainCandidate(candidate.id);
      setAiInsights(response.insights);
      setShowFullInsights(true);
      toast.success('AI insights generated!');
    } catch (err) {
      console.error('Failed to load AI insights:', err);
      toast.error(err.message || 'Failed to generate AI insights');
    } finally {
      setLoadingInsights(false);
    }
  };

  const loadScoreExplanation = async (scoreType) => {
    if (scoreExplanations[scoreType]) {
      return; // Already loaded
    }

    setLoadingScore(scoreType);
    try {
      const response = await explainScore(candidate.id, scoreType);
      setScoreExplanations(prev => ({
        ...prev,
        [scoreType]: response.explanation
      }));
    } catch (err) {
      console.error('Failed to load score explanation:', err);
      toast.error('Failed to explain score');
    } finally {
      setLoadingScore(null);
    }
  };

  const breakdown = candidate.breakdown || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`${bg} rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${border} sticky top-0 ${bg} z-10`}>
          <div>
            <h2 className="font-bold text-lg">{candidate.name}</h2>
            <p className={`text-xs ${muted}`}>{candidate.fileName} · {candidate.jobTitle}</p>
          </div>
          <button 
            onClick={onClose} 
            className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Overall Score */}
          <div className="text-center">
            <p className={`text-6xl font-black ${GRADE_COLORS[candidate.grade?.color] || 'text-slate-700'}`}>
              {candidate.finalScore}%
            </p>
            <p className={`text-lg font-medium mt-2 ${muted}`}>{candidate.grade?.label}</p>
            
            {/* AI Insights Button */}
            <button
              onClick={loadAIInsights}
              disabled={loadingInsights}
              className="mt-4 flex items-center gap-2 mx-auto px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 font-medium"
            >
              {loadingInsights ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Generating AI Insights...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  {aiInsights ? (showFullInsights ? 'Hide' : 'Show') + ' AI Insights' : 'Get AI Insights'}
                  {aiInsights && (showFullInsights ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                </>
              )}
            </button>
          </div>

          {/* AI Insights Panel */}
          {aiInsights && showFullInsights && (
            <div className={`rounded-xl border-2 border-violet-200 ${darkMode ? 'bg-violet-950/20' : 'bg-violet-50'} p-5 space-y-4`}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-violet-600" />
                <h3 className="font-bold text-lg">AI-Powered Analysis</h3>
              </div>

              {/* Overall Assessment */}
              <div>
                <h4 className={`text-sm font-semibold uppercase tracking-wider mb-2 ${muted}`}>
                  Overall Assessment
                </h4>
                <p className="text-sm leading-relaxed">{aiInsights.overallAssessment}</p>
              </div>

              {/* Key Strengths */}
              <div>
                <h4 className={`text-sm font-semibold uppercase tracking-wider mb-2 flex items-center gap-1 ${muted}`}>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Key Strengths
                </h4>
                <ul className="space-y-1">
                  {aiInsights.keyStrengths?.map((strength, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Key Weaknesses */}
              {aiInsights.keyWeaknesses?.length > 0 && (
                <div>
                  <h4 className={`text-sm font-semibold uppercase tracking-wider mb-2 flex items-center gap-1 ${muted}`}>
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    Areas of Concern
                  </h4>
                  <ul className="space-y-1">
                    {aiInsights.keyWeaknesses.map((weakness, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <span>{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Critical Skills */}
              {aiInsights.missingCriticalSkills?.length > 0 && (
                <div>
                  <h4 className={`text-sm font-semibold uppercase tracking-wider mb-2 ${muted}`}>
                    Missing Critical Skills
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {aiInsights.missingCriticalSkills.map((skill, i) => (
                      <span key={i} className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-1 rounded-full">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendation */}
              <div className={`rounded-lg p-4 ${darkMode ? 'bg-slate-800' : 'bg-white'} border ${border}`}>
                <h4 className={`text-sm font-semibold uppercase tracking-wider mb-2 flex items-center gap-1 ${muted}`}>
                  <Target className="w-4 h-4 text-blue-600" />
                  Recommendation
                </h4>
                <p className="text-sm leading-relaxed">{aiInsights.recommendation}</p>
              </div>

              {/* Interview Focus Areas */}
              {aiInsights.interviewFocus?.length > 0 && (
                <div>
                  <h4 className={`text-sm font-semibold uppercase tracking-wider mb-2 flex items-center gap-1 ${muted}`}>
                    <MessageSquare className="w-4 h-4 text-violet-600" />
                    Interview Focus Areas
                  </h4>
                  <ul className="space-y-1">
                    {aiInsights.interviewFocus.map((topic, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-violet-600 font-bold">•</span>
                        <span>{topic}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Hiring Risk */}
              {aiInsights.hiringRisk && (
                <div className={`rounded-lg p-3 border ${
                  aiInsights.hiringRisk === 'low' ? 'bg-emerald-50 border-emerald-200' :
                  aiInsights.hiringRisk === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className={`w-4 h-4 ${
                      aiInsights.hiringRisk === 'low' ? 'text-emerald-600' :
                      aiInsights.hiringRisk === 'medium' ? 'text-yellow-600' :
                      'text-red-600'
                    }`} />
                    <span className={`text-sm font-semibold uppercase ${
                      aiInsights.hiringRisk === 'low' ? 'text-emerald-700' :
                      aiInsights.hiringRisk === 'medium' ? 'text-yellow-700' :
                      'text-red-700'
                    }`}>
                      {aiInsights.hiringRisk} Risk
                    </span>
                  </div>
                  {aiInsights.riskFactors?.length > 0 && (
                    <ul className="space-y-1 ml-6">
                      {aiInsights.riskFactors.map((risk, i) => (
                        <li key={i} className="text-xs text-slate-700">• {risk}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Score Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'skills',     label: 'Skills',     icon: Zap,            color: 'teal' },
              { key: 'experience', label: 'Experience', icon: Briefcase,      color: 'violet' },
              { key: 'education',  label: 'Education',  icon: GraduationCap,  color: 'blue' },
              { key: 'overall',    label: 'Relevance',  icon: Award,          color: 'cyan' },
            ].map(({ key, label, icon: Icon, color }) => {
              const data = breakdown[key === 'overall' ? 'tfidf' : key];
              if (!data) return null;
              
              const hasExplanation = scoreExplanations[key];
              const isLoading = loadingScore === key;

              return (
                <div key={key} className={`rounded-xl p-4 border ${border} ${cardBg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-4 h-4 text-${color}-500`} />
                      <span className={`text-sm font-medium ${muted}`}>{label}</span>
                    </div>
                    <button
                      onClick={() => loadScoreExplanation(key)}
                      disabled={isLoading}
                      className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors ${hasExplanation ? 'text-violet-600' : muted}`}
                      title="Explain this score"
                    >
                      {isLoading ? (
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Brain className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-2xl font-bold">{data.score}%</p>
                  {key === 'experience' && <p className={`text-xs mt-1 ${muted}`}>{data.detectedYears || data.years} yrs detected</p>}
                  {key === 'education' && <p className={`text-xs mt-1 ${muted}`}>{data.level || data.label}</p>}
                  {key === 'skills' && <p className={`text-xs mt-1 ${muted}`}>{data.matched?.length}/{data.total} matched</p>}
                  
                  {hasExplanation && (
                    <div className={`mt-3 pt-3 border-t ${border}`}>
                      <p className="text-xs leading-relaxed">{scoreExplanations[key]}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Candidate Information */}
          {(candidate.title || candidate.location || candidate.email || candidate.phone) && (
            <div className={`rounded-xl p-4 border ${border} ${cardBg}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${muted}`}>
                Candidate Information
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {candidate.title && (
                  <div>
                    <span className={`text-xs ${muted}`}>Title:</span>
                    <p className="font-medium">{candidate.title}</p>
                  </div>
                )}
                {candidate.location && (
                  <div>
                    <span className={`text-xs ${muted}`}>Location:</span>
                    <p className="font-medium">{candidate.location}</p>
                  </div>
                )}
                {candidate.email && (
                  <div>
                    <span className={`text-xs ${muted}`}>Email:</span>
                    <p className="font-medium">{candidate.email}</p>
                  </div>
                )}
                {candidate.phone && (
                  <div>
                    <span className={`text-xs ${muted}`}>Phone:</span>
                    <p className="font-medium">{candidate.phone}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Summary */}
          {candidate.summary && (
            <div className={`rounded-xl p-4 border-l-4 border-l-blue-500 ${darkMode ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <p className={`text-sm font-semibold ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>AI Summary</p>
              </div>
              <p className={`text-sm leading-relaxed ${darkMode ? 'text-blue-200' : 'text-blue-700'}`}>
                {candidate.summary}
              </p>
            </div>
          )}

          {/* Strengths */}
          {candidate.strengths && candidate.strengths.length > 0 && (
            <div className={`rounded-xl p-4 border-l-4 border-l-emerald-500 ${darkMode ? 'bg-emerald-900/20 border border-emerald-800' : 'bg-emerald-50 border border-emerald-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <p className={`text-sm font-semibold ${darkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>💪 Strengths</p>
              </div>
              <ul className="space-y-1.5">
                {candidate.strengths.map((strength, i) => (
                  <li key={i} className={`flex items-start gap-2 text-sm ${darkMode ? 'text-emerald-200' : 'text-emerald-700'}`}>
                    <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {candidate.weaknesses && candidate.weaknesses.length > 0 && (
            <div className={`rounded-xl p-4 border-l-4 border-l-orange-500 ${darkMode ? 'bg-orange-900/20 border border-orange-800' : 'bg-orange-50 border border-orange-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-orange-600" />
                <p className={`text-sm font-semibold ${darkMode ? 'text-orange-300' : 'text-orange-800'}`}>⚠️ Areas for Improvement</p>
              </div>
              <ul className="space-y-1.5">
                {candidate.weaknesses.map((weakness, i) => (
                  <li key={i} className={`flex items-start gap-2 text-sm ${darkMode ? 'text-orange-200' : 'text-orange-700'}`}>
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                    <span>{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Matched Skills */}
          {breakdown.skills?.matched?.length > 0 && (
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${muted}`}>
                Matched Skills ({breakdown.skills.matched.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {breakdown.skills.matched.map((s) => (
                  <span key={s} className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-1 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing Skills */}
          {breakdown.skills?.missing?.length > 0 && (
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${muted}`}>
                Missing Skills ({breakdown.skills.missing.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {breakdown.skills.missing.map((s) => (
                  <span key={s} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pipeline Status */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${muted}`}>
              Pipeline Status
            </p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setCandidateStatus(candidate.sessionId, candidate.fileName, s)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium capitalize transition-all
                    ${status === s ? STATUS_STYLES[s] + ' ring-2 ring-offset-1 ring-current' : darkMode ? 'border-slate-600 text-slate-400 hover:border-slate-500' : 'border-slate-200 text-slate-500 hover:border-slate-300'}
                  `}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
