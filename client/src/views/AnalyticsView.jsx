import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts';
import { useAppStore } from '../store/useAppStore';

const PIPELINE_COLORS = {
  new:         '#94a3b8',
  shortlisted: '#3b82f6',
  interview:   '#8b5cf6',
  offered:     '#f59e0b',
  hired:       '#10b981',
  rejected:    '#ef4444',
};

const GRADE_COLORS = ['#10b981', '#3b82f6', '#eab308', '#f97316', '#ef4444'];

export default function AnalyticsView() {
  const { sessions, candidateStatuses, darkMode } = useAppStore();

  const allCandidates = sessions.flatMap((s) =>
    (s.results || []).map((r) => ({
      ...r,
      sessionId: s.id,
      jobTitle: s.jobTitle || 'Untitled',
      status: candidateStatuses[`${s.id}-${r.fileName}`] || 'new',
      sessionDate: s.createdAt,
    }))
  );

  // Score distribution buckets
  const scoreBuckets = [
    { range: '0-20',  count: allCandidates.filter((c) => c.finalScore < 20).length },
    { range: '20-40', count: allCandidates.filter((c) => c.finalScore >= 20 && c.finalScore < 40).length },
    { range: '40-55', count: allCandidates.filter((c) => c.finalScore >= 40 && c.finalScore < 55).length },
    { range: '55-70', count: allCandidates.filter((c) => c.finalScore >= 55 && c.finalScore < 70).length },
    { range: '70-85', count: allCandidates.filter((c) => c.finalScore >= 70 && c.finalScore < 85).length },
    { range: '85-100',count: allCandidates.filter((c) => c.finalScore >= 85).length },
  ];

  // Pipeline status pie
  const pipelineData = Object.entries(PIPELINE_COLORS).map(([status, color]) => ({
    name: status,
    value: allCandidates.filter((c) => c.status === status).length,
    color,
  })).filter((d) => d.value > 0);

  // Grade distribution
  const gradeData = [
    { name: 'Excellent', value: allCandidates.filter((c) => c.finalScore >= 85).length },
    { name: 'Good',      value: allCandidates.filter((c) => c.finalScore >= 70 && c.finalScore < 85).length },
    { name: 'Fair',      value: allCandidates.filter((c) => c.finalScore >= 55 && c.finalScore < 70).length },
    { name: 'Below Avg', value: allCandidates.filter((c) => c.finalScore >= 40 && c.finalScore < 55).length },
    { name: 'Poor',      value: allCandidates.filter((c) => c.finalScore < 40).length },
  ].filter((d) => d.value > 0);

  // Sessions over time
  const sessionsByDate = sessions
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((s, i) => ({
      date: new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      candidates: s.results?.length || 0,
      avgScore: s.results?.length
        ? Math.round(s.results.reduce((sum, r) => sum + r.finalScore, 0) / s.results.length)
        : 0,
      session: i + 1,
    }));

  // Top skills across all requirements
  const skillFreq = {};
  allCandidates.forEach((c) => {
    (c.breakdown?.skills?.matched || []).forEach((skill) => {
      skillFreq[skill] = (skillFreq[skill] || 0) + 1;
    });
  });
  const topSkills = Object.entries(skillFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([skill, count]) => ({ skill, count }));

  const bg = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const text = darkMode ? 'text-white' : 'text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const gridColor = darkMode ? '#334155' : '#f1f5f9';
  const axisColor = darkMode ? '#64748b' : '#94a3b8';

  const noData = allCandidates.length === 0;

  if (noData) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <p className={`text-lg font-semibold ${text}`}>No data yet</p>
          <p className={`text-sm mt-1 ${muted}`}>Run match sessions to see analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Candidates', value: allCandidates.length },
          { label: 'Avg Match Score',  value: `${Math.round(allCandidates.reduce((s, c) => s + c.finalScore, 0) / allCandidates.length)}%` },
          { label: 'Hired',            value: allCandidates.filter((c) => c.status === 'hired').length },
          { label: 'Conversion Rate',  value: `${allCandidates.length > 0 ? Math.round((allCandidates.filter((c) => c.status === 'hired').length / allCandidates.length) * 100) : 0}%` },
        ].map(({ label, value }) => (
          <div key={label} className={`rounded-2xl border p-5 ${bg} shadow-sm`}>
            <p className={`text-3xl font-black ${text}`}>{value}</p>
            <p className={`text-sm mt-1 ${muted}`}>{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score distribution */}
        <div className={`rounded-2xl border p-5 ${bg} shadow-sm`}>
          <h3 className={`font-semibold mb-4 ${text}`}>Score Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreBuckets} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: darkMode ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: darkMode ? '#e2e8f0' : '#1e293b' }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline status pie */}
        <div className={`rounded-2xl border p-5 ${bg} shadow-sm`}>
          <h3 className={`font-semibold mb-4 ${text}`}>Pipeline Status</h3>
          {pipelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pipelineData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pipelineData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: darkMode ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, n) => [v, n.charAt(0).toUpperCase() + n.slice(1)]}
                />
                <Legend formatter={(v) => <span style={{ fontSize: 11, textTransform: 'capitalize', color: axisColor }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className={`text-sm text-center py-16 ${muted}`}>No pipeline data yet</p>
          )}
        </div>

        {/* Sessions trend */}
        {sessionsByDate.length > 1 && (
          <div className={`rounded-2xl border p-5 ${bg} shadow-sm`}>
            <h3 className={`font-semibold mb-4 ${text}`}>Avg Score per Session</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={sessionsByDate} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: axisColor }} />
                <Tooltip
                  contentStyle={{ background: darkMode ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="avgScore" stroke="#6366f1" fill="url(#scoreGrad)" strokeWidth={2} dot={{ r: 4, fill: '#6366f1' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top matched skills */}
        {topSkills.length > 0 && (
          <div className={`rounded-2xl border p-5 ${bg} shadow-sm`}>
            <h3 className={`font-semibold mb-4 ${text}`}>Top Matched Skills</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topSkills} layout="vertical" margin={{ top: 0, right: 10, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
                <YAxis type="category" dataKey="skill" tick={{ fontSize: 11, fill: axisColor }} width={70} />
                <Tooltip
                  contentStyle={{ background: darkMode ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
