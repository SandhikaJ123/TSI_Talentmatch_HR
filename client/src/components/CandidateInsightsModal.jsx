import { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import {
  X, Briefcase, MapPin, Mail, Phone, Target, MessageSquare, Star, Trophy,
  TrendingUp, TrendingDown, Sparkles, Download, ChevronDown, ChevronUp, CheckCircle,
  FileText, Hash, Clock, Award
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── 4-color brand system ────────────────────────────────────────────────────
const TEAL = '#0d9488';    // primary — used most
const VIOLET = '#8b5cf6';  // secondary accent
const AMBER = '#f59e0b';   // warnings / gap-type meaning
const BLUE = '#3b82f6';    // informational (AI content)

const GRADE_COLORS = {
  emerald: '#10b981', blue: '#3b82f6', yellow: '#f59e0b', orange: '#f97316', red: '#f43f5e',
};
const GRADE_EMOJI = { emerald: '🌟', blue: '👍', yellow: '🤔', orange: '📉', red: '❌' };

function useChart(canvasRef, config) {
  const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = new Chart(canvasRef.current, config);
    return () => chartRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config.data)]);
}

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* Card wrapper with a gradient top strip (color -> transparent) */
function AccentCard({ color, className = '', style, children }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${className}`} style={style}>
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(to right, ${color}, transparent)` }} />
      <div className="p-5 h-full">{children}</div>
    </div>
  );
}

function ScoreGauge({ score, color, size = 120 }) {
  const canvasRef = useRef(null);
  useChart(canvasRef, {
    type: 'doughnut',
    data: { datasets: [{ data: [score, 100 - score], backgroundColor: [color, '#e2e8f0'], borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '78%', rotation: -90, circumference: 360,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { animateRotate: true, animateScale: true, duration: 1400, easing: 'easeOutCubic' },
    },
  });
  return (
    <div className="cim-gauge-pop" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} role="img" aria-label={`Overall score ${score} out of 100`} />
    </div>
  );
}

function RadarChart({ axes, darkMode }) {
  const canvasRef = useRef(null);
  const wedgeColors = [TEAL, VIOLET, AMBER, BLUE];
  useChart(canvasRef, {
    type: 'polarArea',
    data: {
      labels: axes.map((a) => a.label),
      datasets: [{
        data: axes.map((a) => a.value),
        backgroundColor: axes.map((_, i) => `${wedgeColors[i % wedgeColors.length]}b3`),
        borderColor: axes.map((_, i) => wedgeColors[i % wedgeColors.length]),
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.label}: ${c.raw}/100` } } },
      scales: {
        r: {
          min: 0, max: 100, ticks: { display: false },
          grid: { color: darkMode ? '#334155' : '#e2e8f0' },
          angleLines: { color: darkMode ? '#334155' : '#e2e8f0' },
        },
      },
      animation: { duration: 1000, easing: 'easeOutCubic' },
    },
  });
  return (
    <div className="flex flex-col h-full">
      <div className="relative flex-1">
        <canvas ref={canvasRef} role="img"
          aria-label={`Score distribution: ${axes.map((a) => `${a.label} ${a.value}%`).join(', ')}`} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
        {axes.map((a, i) => (
          <span key={a.label} className="flex items-center gap-1.5 text-[11px] font-medium">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: wedgeColors[i % wedgeColors.length] }} />
            {a.label} {a.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function SkillDonutChart({ matchedCount, missingCount }) {
  const canvasRef = useRef(null);
  useChart(canvasRef, {
    type: 'doughnut',
    data: {
      labels: ['Matched', 'Missing'],
      datasets: [{ data: [matchedCount, missingCount], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      plugins: { legend: { display: false } },
      animation: { animateRotate: true, duration: 900 },
    },
  });
  return (
    <canvas ref={canvasRef} role="img"
      aria-label={`${matchedCount} skills matched, ${missingCount} skills missing`} />
  );
}

function TruncatedList({ items, max = 4, icon: Icon, iconClass }) {
  const [expanded, setExpanded] = useState(false);
  if (!items?.length) return null;
  const visible = expanded ? items : items.slice(0, max);
  return (
    <ul className="space-y-2">
      {visible.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          {Icon && <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconClass}`} />}
          <span>{item}</span>
        </li>
      ))}
      {items.length > max && (
        <li>
          <button onClick={() => setExpanded(!expanded)} className="text-xs font-medium text-slate-400 hover:text-slate-500 dark:hover:text-slate-300">
            {expanded ? '− Show less' : `+${items.length - max} more`}
          </button>
        </li>
      )}
    </ul>
  );
}

async function downloadQuestionsPdf(name, questions, focusAreas, suffix, panelTitle) {
  if (!questions?.length) return;
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  try {
    const res = await fetch(`${BASE}/candidates/interview-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        interviewQuestions: questions,
        interviewFocusAreas: focusAreas || [],
        // Tells the backend which panel this came from, so the PDF's own title/heading matches
        // what the interviewer actually clicked instead of always rendering the gap-focused title.
        title: panelTitle,
        documentTitle: panelTitle,
      }),
    });
    if (!res.ok) throw new Error('PDF generation failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}_${suffix}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (err) {
    console.error('PDF download failed:', err);
    toast.error('Failed to generate PDF');
  }
}

// Difficulty encodes real data about each question, so — like grade/matched-missing colors — it's
// exempt from the 4-color brand system and uses its own semantic green/amber/red scale.
const DIFFICULTY_STYLES = {
  easy:   { label: 'Easy',   color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/30',     text: 'text-amber-700 dark:text-amber-300',     border: 'border-amber-200 dark:border-amber-800' },
  hard:   { label: 'Hard',   color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/30',         text: 'text-red-700 dark:text-red-300',         border: 'border-red-200 dark:border-red-800' },
};
const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

// Backend now returns { question, difficulty } objects; older, not-yet-migrated sessions may still
// have plain strings, so this normalizes either shape and defaults missing/invalid difficulty to 'medium'.
function normalizeQuestion(q) {
  if (typeof q === 'string') return { question: q, difficulty: 'medium' };
  if (q && typeof q === 'object') {
    const difficulty = DIFFICULTY_LEVELS.includes(q.difficulty) ? q.difficulty : 'medium';
    return { question: q.question || '', difficulty };
  }
  return { question: String(q ?? ''), difficulty: 'medium' };
}

function QuestionsPanel({ title, emoji, icon: Icon, iconColor, questions, name, focusAreas, pdfSuffix, cardBg, border }) {
  const [open, setOpen] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState(() => {
    // Default to Easy; fall back to whichever level actually has questions (handles legacy
    // sessions saved before difficulty tagging existed, where everything normalizes to 'medium').
    const levelCounts = { easy: 0, medium: 0, hard: 0 };
    (questions || []).forEach((q) => { levelCounts[normalizeQuestion(q).difficulty]++; });
    if (levelCounts.easy > 0) return 'easy';
    return DIFFICULTY_LEVELS.find((l) => levelCounts[l] > 0) || 'all';
  });
  const [askedIds, setAskedIds] = useState(() => new Set());
  if (!questions?.length) return null;

  const normalized = questions.map((q, i) => ({ ...normalizeQuestion(q), id: i }));
  const counts = { easy: 0, medium: 0, hard: 0 };
  normalized.forEach((q) => { counts[q.difficulty]++; });
  const filtered = difficultyFilter === 'all' ? normalized : normalized.filter((q) => q.difficulty === difficultyFilter);

  const toggleAsked = (id) => {
    setAskedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <AccentCard color={iconColor} className={`cim-card h-full ${border} ${cardBg} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold flex items-center gap-2">
          <span>{emoji}</span>
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
          {title}
        </p>
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border ${border} hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors`}
        >
          {open ? 'Hide' : `Show (${questions.length})`}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className={`mt-4 pt-4 border-t ${border} animate-[cimFadeIn_0.25s_ease-out]`}>
          {/* Difficulty picker — interviewer selects a level, then the list below narrows to that level */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <button
              onClick={() => setDifficultyFilter('all')}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                difficultyFilter === 'all'
                  ? 'bg-slate-700 text-white border-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200'
                  : `${border} hover:bg-slate-50 dark:hover:bg-slate-700`
              }`}
            >
              All ({normalized.length})
            </button>
            {DIFFICULTY_LEVELS.map((level) => {
              const s = DIFFICULTY_STYLES[level];
              const isActive = difficultyFilter === level;
              return (
                <button
                  key={level}
                  onClick={() => setDifficultyFilter(level)}
                  disabled={counts[level] === 0}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                    isActive ? 'text-white' : `${s.bg} ${s.text} ${s.border}`
                  }`}
                  style={isActive ? { backgroundColor: s.color, borderColor: s.color } : undefined}
                >
                  {s.label} ({counts[level]})
                </button>
              );
            })}
            <div className="flex-1" />
            <button
              onClick={() => downloadQuestionsPdf(name, normalized.map((q) => q.question), focusAreas, pdfSuffix, title)}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border ${border} hover:bg-slate-50 dark:hover:bg-slate-700`}
            >
              <Download className="w-3.5 h-3.5" /> Save PDF
            </button>
          </div>

          {filtered.length === 0 ? (
            <p className="text-xs text-slate-400">No questions at this difficulty.</p>
          ) : (
            <ul className="space-y-2.5">
              {filtered.map((q) => {
                const s = DIFFICULTY_STYLES[q.difficulty];
                const asked = askedIds.has(q.id);
                return (
                  <li key={q.id} className={`flex items-start gap-2.5 rounded-lg p-2 -mx-2 transition-colors ${asked ? 'bg-slate-100 dark:bg-slate-700/40' : ''}`}>
                    <button
                      onClick={() => toggleAsked(q.id)}
                      title={asked ? 'Mark as not yet asked' : 'Mark as asked'}
                      className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        asked ? 'border-teal-600 bg-teal-600' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {asked && <CheckCircle className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mb-1 ${s.bg} ${s.text}`}>
                        {s.label}
                      </span>
                      <p className={`text-sm leading-relaxed ${asked ? 'line-through text-slate-400' : ''}`}>{q.question}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </AccentCard>
  );
}

export default function CandidateInsightsModal({ candidate, onClose, darkMode }) {
  const breakdown = candidate.breakdown || {};
  const gaugeColor = GRADE_COLORS[candidate.grade?.color] || '#475569';
  const gradeEmoji = GRADE_EMOJI[candidate.grade?.color] || '📋';
  const animatedScore = useCountUp(candidate.finalScore);

  const radarAxes = [
    breakdown.skills && { label: 'Skills', value: breakdown.skills.score },
    breakdown.experience && { label: 'Experience', value: breakdown.experience.score },
    breakdown.education && { label: 'Education', value: breakdown.education.score },
    breakdown.tfidf && { label: 'Relevance', value: breakdown.tfidf.score },
    breakdown.semantic && { label: 'Semantic', value: breakdown.semantic.score },
  ].filter(Boolean);

  const skillRows = [
    ...(breakdown.skills?.matched || []).map((s) => ({ skill: s, matched: true })),
    ...(breakdown.skills?.missing || []).map((s) => ({ skill: s, matched: false })),
  ];
  const [showAllSkills, setShowAllSkills] = useState(false);
  const visibleSkillRows = showAllSkills ? skillRows : skillRows.slice(0, 8);
  const matchedCount = breakdown.skills?.matched?.length || 0;
  const missingCount = breakdown.skills?.missing?.length || 0;
  const matchedPct = matchedCount + missingCount > 0 ? Math.round((matchedCount / (matchedCount + missingCount)) * 100) : 0;
  const animatedMatchedPct = useCountUp(matchedPct);

  const recommendation = candidate.finalScore >= 70 ? 'Recommended'
    : candidate.finalScore >= 55 ? 'Consider with reservations' : 'Not recommended';
  const recEmoji = candidate.finalScore >= 70 ? '✅' : candidate.finalScore >= 55 ? '🤔' : '❌';
  const recBg = candidate.finalScore >= 70 ? 'bg-emerald-50 dark:bg-emerald-900/30' : candidate.finalScore >= 55 ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-red-50 dark:bg-red-900/30';
  const recText = candidate.finalScore >= 70 ? 'text-emerald-700 dark:text-emerald-300' : candidate.finalScore >= 55 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';
  const recDot = candidate.finalScore >= 70 ? 'bg-emerald-500' : candidate.finalScore >= 55 ? 'bg-amber-500' : 'bg-red-500';

  const pageBg = darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900';
  const cardBg = darkMode ? 'bg-slate-800' : 'bg-white';
  const border = darkMode ? 'border-slate-700' : 'border-slate-200';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const divider = darkMode ? 'border-slate-700' : 'border-slate-200';
  const cardHover = 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md';

  const focusColors = [TEAL, VIOLET];

  return (
    <div className={`min-h-screen ${pageBg}`}>
      <style>{`
        @keyframes cimRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cimFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cimGaugePop { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
        .cim-rise { animation: cimRise 0.4s cubic-bezier(0.16,1,0.3,1) both; }
        .cim-gauge-pop { animation: cimGaugePop 0.6s cubic-bezier(0.34,1.56,0.64,1) both; }
      `}</style>

      {/* Header */}
      <div
        className={`sticky top-0 z-10 border-b ${border} px-6 py-4`}
        style={{ backgroundColor: darkMode ? '#1e293b' : '#ffffff', backgroundImage: `linear-gradient(135deg, ${TEAL}${darkMode ? '33' : '1a'} 0%, transparent 60%)` }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-white" style={{ backgroundColor: gaugeColor }}>
                {candidate.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              {candidate.rank && (
                <span className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ring-2 ${darkMode ? 'ring-slate-800' : 'ring-white'} bg-amber-400 text-white`}>
                  {candidate.rank}
                </span>
              )}
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">{candidate.name}</h2>
              <p className={`text-xs ${muted}`}>{candidate.fileName}{candidate.jobTitle ? ` · ${candidate.jobTitle}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 rounded-xl border px-4 py-2 ${recBg} ${border}`}>
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${recDot} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${recDot}`} />
              </span>
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Recommendation</p>
                <p className={`text-sm font-bold ${recText}`}>{recEmoji} {recommendation}</p>
              </div>
            </div>
            <button onClick={onClose} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-colors`}><X className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      <div className="p-6">

        {/* Row 1: Candidate Info | Overall Score (wide) | Match Details — unequal width, equal height */}
        <div className="flex flex-col lg:flex-row gap-5 mb-5">
          <AccentCard color={TEAL} className={`cim-rise lg:flex-1 ${border} ${cardBg} ${cardHover}`} style={{ animationDelay: '0ms' }}>
            <p className="text-sm font-bold mb-3">👤 Candidate info</p>
            <div className="space-y-2.5 text-sm">
              {candidate.title && <div className="flex items-center gap-2"><Briefcase className={`w-3.5 h-3.5 shrink-0 ${muted}`} /><span className="font-medium truncate">{candidate.title}</span></div>}
              {candidate.location && <div className="flex items-center gap-2"><MapPin className={`w-3.5 h-3.5 shrink-0 ${muted}`} /><span className="font-medium truncate">{candidate.location}</span></div>}
              {candidate.email && <div className="flex items-center gap-2"><Mail className={`w-3.5 h-3.5 shrink-0 ${muted}`} /><span className="font-medium truncate">{candidate.email}</span></div>}
              {candidate.phone && <div className="flex items-center gap-2"><Phone className={`w-3.5 h-3.5 shrink-0 ${muted}`} /><span className="font-medium truncate">{candidate.phone}</span></div>}
              {!candidate.title && !candidate.location && !candidate.email && !candidate.phone && (
                <p className={`text-xs ${muted}`}>No additional candidate details available.</p>
              )}
            </div>
          </AccentCard>

          <AccentCard color={gaugeColor} className={`cim-rise lg:flex-[2.4] ${border} ${cardBg} ${cardHover}`} style={{ animationDelay: '20ms' }}>
            <p className="text-sm font-bold mb-3">🎯 Overall score</p>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="relative shrink-0">
                <ScoreGauge score={candidate.finalScore} color={gaugeColor} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black" style={{ color: gaugeColor }}>{animatedScore}</span>
                  <span className={`text-xs ${muted}`}>/100</span>
                </div>
              </div>
              <div className="flex-1 min-w-[220px] space-y-2.5">
                {radarAxes.map(({ label, value }, i) => {
                  const barColors = [TEAL, VIOLET, AMBER, BLUE];
                  const barColor = barColors[i % barColors.length];
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{label}</span>
                        <span className="text-xs font-bold" style={{ color: barColor }}>{value}/100</span>
                      </div>
                      <div className={`h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, backgroundColor: barColor }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </AccentCard>

          <AccentCard color={VIOLET} className={`cim-rise lg:flex-1 ${border} ${cardBg} ${cardHover}`} style={{ animationDelay: '40ms' }}>
            <p className="text-sm font-bold mb-3 flex items-center gap-2">🏆 Match details</p>
            <div className="flex items-center gap-2 text-sm mb-3">
              <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="font-medium truncate">{candidate.fileName}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {candidate.rank && (
                <div className="flex flex-col items-center text-center py-3 px-1 rounded-xl" style={{ backgroundColor: `${VIOLET}14` }}>
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold mb-1.5" style={{ backgroundColor: VIOLET }}>
                    #{candidate.rank}
                  </span>
                  <span className={`text-[10px] font-medium ${muted}`}>Rank</span>
                </div>
              )}
              <div className="flex flex-col items-center text-center py-3 px-1 rounded-xl" style={{ backgroundColor: `${gaugeColor}14` }}>
                <span className="text-xl mb-1">{gradeEmoji}</span>
                <span className="text-[11px] font-bold" style={{ color: gaugeColor }}>{candidate.grade?.label}</span>
              </div>
              {breakdown.experience && (
                <div className="flex flex-col items-center text-center py-3 px-1 rounded-xl" style={{ backgroundColor: `${VIOLET}14` }}>
                  <span className="text-lg font-black mb-1" style={{ color: VIOLET }}>
                    {breakdown.experience.detectedYears ?? breakdown.experience.years}y
                  </span>
                  <span className={`text-[10px] font-medium ${muted}`}>Experience</span>
                </div>
              )}
            </div>
          </AccentCard>
        </div>

        {/* Row 2: Skill Match | Score Distribution | AI Summary — first two equal width, AI Summary its own width, all equal height */}
        <div className="flex flex-col lg:flex-row gap-5 mb-5">
          <AccentCard color={TEAL} className={`cim-rise lg:flex-1 ${border} ${cardBg} ${cardHover}`} style={{ animationDelay: '60ms' }}>
            <p className="text-sm font-bold mb-3">🧩 Skill match summary</p>
            {skillRows.length === 0 ? (
              <p className={`text-xs ${muted}`}>No skill data available.</p>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative w-[64px] h-[64px] shrink-0">
                    <SkillDonutChart matchedCount={matchedCount} missingCount={missingCount} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-black">{animatedMatchedPct}%</span>
                    </div>
                  </div>
                  <div className="flex-1 text-xs space-y-1">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Matched ({matchedCount})</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Missing ({missingCount})</div>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className={`text-[10px] uppercase tracking-wide ${muted} border-b ${border}`}>
                      <th className="text-left font-semibold pb-1.5">Skill</th>
                      <th className="text-right font-semibold pb-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSkillRows.map((row, i) => (
                      <tr key={i} className={`border-b ${border} last:border-0`}>
                        <td className="py-1.5 truncate">{row.skill}</td>
                        <td className="py-1.5 text-right">
                          {row.matched ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><CheckCircle className="w-3 h-3" />matched</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-500 font-medium"><X className="w-3 h-3" />missing</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {skillRows.length > 8 && (
                  <button onClick={() => setShowAllSkills(!showAllSkills)} className="text-xs font-medium mt-2" style={{ color: TEAL }}>
                    {showAllSkills ? '− Show less' : `+${skillRows.length - 8} more`}
                  </button>
                )}
              </>
            )}
          </AccentCard>

          <AccentCard color={TEAL} className={`cim-rise lg:flex-[1.2] ${border} ${cardBg} ${cardHover}`} style={{ animationDelay: '80ms' }}>
            <div className="flex flex-col h-full">
              <p className="text-sm font-bold mb-3">📊 Score distribution</p>
              {radarAxes.length >= 3 ? (
                <div className="w-full flex-1"><RadarChart axes={radarAxes} darkMode={darkMode} /></div>
              ) : (
                <p className={`text-sm ${muted} py-10`}>Not enough dimensions for a radar view.</p>
              )}
            </div>
          </AccentCard>

          {candidate.summary && (
            <AccentCard color={BLUE} className={`cim-rise lg:flex-1 ${cardHover} ${darkMode ? 'border-blue-800 bg-blue-900/20' : 'border-blue-200 bg-blue-50'}`} style={{ animationDelay: '100ms' }}>
              <p className={`text-sm font-bold mb-2 flex items-center gap-2 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>🤖 AI summary</p>
              <p className={`text-sm leading-relaxed ${darkMode ? 'text-blue-100' : 'text-slate-700'}`}>{candidate.summary}</p>
            </AccentCard>
          )}
        </div>

        {/* Row 3: Strengths | Areas for improvement — 2 equal columns, no pipeline */}
        {(candidate.strengths?.length > 0 || candidate.weaknesses?.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            {candidate.strengths?.length > 0 && (
              <AccentCard color="#10b981" className={`cim-rise h-full ${border} ${cardBg} ${cardHover}`} style={{ animationDelay: '140ms' }}>
                <p className="text-sm font-bold mb-3 flex items-center gap-2">🚀 Strengths</p>
                <TruncatedList items={candidate.strengths} icon={CheckCircle} iconClass="text-emerald-600" />
              </AccentCard>
            )}
            {candidate.weaknesses?.length > 0 && (
              <AccentCard color={AMBER} className={`cim-rise h-full ${border} ${cardBg} ${cardHover}`} style={{ animationDelay: '160ms' }}>
                <p className="text-sm font-bold mb-3 flex items-center gap-2">⚠️ Areas for improvement</p>
                <TruncatedList items={candidate.weaknesses} icon={Target} iconClass="text-amber-600" />
              </AccentCard>
            )}
          </div>
        )}

        {/* Row 4: Interview Focus Areas — horizontal icon-circle cards */}
        {candidate.interviewFocusAreas?.length > 0 && (
          <AccentCard color={AMBER} className={`cim-rise mb-5 ${border} ${cardBg} ${cardHover}`} style={{ animationDelay: '200ms' }}>
            <p className="text-sm font-bold mb-4 flex items-center gap-2">🔍 Interview focus areas</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {candidate.interviewFocusAreas.map((area, i) => {
                const [label, ...rest] = area.split(':');
                const detail = rest.join(':').trim();
                const dotColor = focusColors[i % focusColors.length];
                return (
                  <div key={i} className={`flex flex-col items-center text-center rounded-xl border ${divider} p-3 ${darkMode ? 'bg-slate-700/40' : 'bg-slate-50'}`}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold mb-2" style={{ backgroundColor: dotColor }}>
                      🎯
                    </div>
                    <p className="text-xs font-semibold mb-1">{detail ? label.trim() : `Focus area ${i + 1}`}</p>
                    <p className={`text-[11px] leading-relaxed ${muted}`}>{detail || area}</p>
                  </div>
                );
              })}
            </div>
          </AccentCard>
        )}

        {/* Row 5: Relevant Questions | Gap-Focused Questions — equal height/width */}
        {(candidate.topInterviewQuestions?.length > 0 || candidate.interviewQuestions?.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-stretch">
            <div className="cim-rise" style={{ animationDelay: '240ms' }}>
              <QuestionsPanel
                title="Relevant interview questions" emoji="⭐" icon={Star} iconColor={TEAL}
                questions={candidate.topInterviewQuestions} name={candidate.name}
                focusAreas={[]} pdfSuffix="Top_Questions" cardBg={cardBg} border={border}
              />
            </div>
            <div className="cim-rise" style={{ animationDelay: '280ms' }}>
              <QuestionsPanel
                title="Gap-focused interview questions" emoji="🧭" icon={MessageSquare} iconColor={VIOLET}
                questions={candidate.interviewQuestions} name={candidate.name}
                focusAreas={candidate.interviewFocusAreas} pdfSuffix="Interview_Guide" cardBg={cardBg} border={border}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}