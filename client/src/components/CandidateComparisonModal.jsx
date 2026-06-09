import { useState, useEffect } from 'react';
import { X, Loader, Sparkles, TrendingUp, Users, Award, CheckCircle } from 'lucide-react';
import { compareCandidates } from '../api/client';
import toast from 'react-hot-toast';

const GRADE_COLORS = {
  emerald: 'text-emerald-600',
  blue:    'text-blue-600',
  yellow:  'text-yellow-600',
  orange:  'text-orange-600',
  red:     'text-red-500',
};

export default function CandidateComparisonModal({ candidates, onClose, darkMode }) {
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const bg = darkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const border = darkMode ? 'border-slate-700' : 'border-slate-200';
  const cardBg = darkMode ? 'bg-slate-700' : 'bg-slate-50';

  useEffect(() => {
    loadComparison();
  }, []);

  const loadComparison = async () => {
    setLoading(true);
    try {
      const candidateIds = candidates.map(c => c.id).filter(Boolean);
      if (candidateIds.length < 2) {
        setError('Candidate IDs are missing. Please re-select the candidates and try again.');
        setLoading(false);
        return;
      }
      const response = await compareCandidates(candidateIds);
      setComparison(response.comparison);
    } catch (err) {
      console.error('Failed to load comparison:', err);
      setError(err.message || 'Failed to generate comparison');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`${bg} rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${border} sticky top-0 ${bg} z-10`}>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-600" />
            <h2 className="font-bold text-lg">Candidate Comparison</h2>
            <span className={`text-sm ${muted}`}>({candidates.length} candidates)</span>
          </div>
          <button 
            onClick={onClose} 
            className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-violet-600 mb-3" />
              <p className={`text-sm ${muted}`}>Analyzing candidates with AI...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 font-medium mb-2">Comparison failed</p>
              <p className={`text-sm ${muted}`}>{error}</p>
            </div>
          ) : comparison ? (
            <>
              {/* Summary */}
              <div className={`rounded-xl border-2 border-violet-200 ${darkMode ? 'bg-violet-950/20' : 'bg-violet-50'} p-5`}>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-violet-600" />
                  <h3 className="font-bold text-lg">AI Analysis Summary</h3>
                </div>
                <p className="text-sm leading-relaxed mb-4">{comparison.summary}</p>
                
                {/* Top Candidate */}
                <div className={`rounded-lg p-4 ${darkMode ? 'bg-slate-800' : 'bg-white'} border ${border}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <h4 className="font-semibold">Top Recommendation</h4>
                  </div>
                  <p className="text-lg font-bold text-violet-600 mb-2">{comparison.topCandidate}</p>
                  <p className="text-sm leading-relaxed">{comparison.topCandidateReason}</p>
                </div>
              </div>

              {/* Candidate Scores Comparison */}
              <div>
                <h4 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${muted}`}>
                  Score Comparison
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {candidates.map((candidate) => (
                    <div key={candidate.id} className={`rounded-xl p-4 border ${border} ${cardBg}`}>
                      <p className="font-semibold truncate mb-2">{candidate.name}</p>
                      <p className={`text-3xl font-bold ${GRADE_COLORS[candidate.grade?.color] || 'text-slate-600'}`}>
                        {candidate.finalScore}%
                      </p>
                      <p className={`text-xs ${muted} mt-1`}>{candidate.grade?.label}</p>
                      
                      {/* Mini breakdown */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className={muted}>Skills</span>
                          <span className="font-medium">{candidate.breakdown?.skills?.score || 0}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className={muted}>Experience</span>
                          <span className="font-medium">{candidate.breakdown?.experience?.score || 0}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className={muted}>Education</span>
                          <span className="font-medium">{candidate.breakdown?.education?.score || 0}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ranking */}
              {comparison.ranking && (
                <div>
                  <h4 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${muted}`}>
                    Detailed Ranking
                  </h4>
                  <div className="space-y-2">
                    {comparison.ranking.map((item, i) => (
                      <div key={i} className={`rounded-lg p-4 border ${border} ${cardBg}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 ${
                            i === 0 ? 'bg-amber-100 text-amber-700' :
                            i === 1 ? 'bg-slate-200 text-slate-700' :
                            i === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {item.rank}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold mb-1">{item.name}</p>
                            <p className="text-sm leading-relaxed">{item.reasoning}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comparison Matrix */}
              {comparison.comparisonMatrix && (
                <div>
                  <h4 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${muted}`}>
                    Category Comparison
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(comparison.comparisonMatrix).map(([category, analysis]) => (
                      <div key={category} className={`rounded-lg p-4 border ${border} ${cardBg}`}>
                        <h5 className="font-semibold capitalize mb-2">{category}</h5>
                        <p className="text-sm leading-relaxed">{analysis}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unique Strengths */}
              {comparison.uniqueStrengths && (
                <div>
                  <h4 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${muted}`}>
                    Unique Strengths
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(comparison.uniqueStrengths).map(([name, strengths]) => (
                      <div key={name} className={`rounded-lg p-4 border ${border} ${cardBg}`}>
                        <p className="font-semibold mb-2">{name}</p>
                        <ul className="space-y-1">
                          {strengths.map((strength, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                              <span>{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Final Recommendation */}
              <div className={`rounded-xl border-2 ${darkMode ? 'border-violet-700 bg-violet-950/20' : 'border-violet-200 bg-violet-50'} p-5`}>
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-violet-600" />
                  Final Recommendation
                </h4>
                <p className="text-sm leading-relaxed mb-3">{comparison.recommendation}</p>
                
                {comparison.alternativeScenarios && (
                  <div className={`mt-3 pt-3 border-t ${border}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${muted}`}>
                      Alternative Scenarios
                    </p>
                    <p className="text-sm leading-relaxed">{comparison.alternativeScenarios}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className={`text-sm ${muted}`}>No comparison data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
