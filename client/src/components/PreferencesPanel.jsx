import { Settings2, Info, Plus, X, Sparkles, Trash2 } from 'lucide-react';
const WEIGHT_FIELDS = [
  {
    key: 'skillsWeight',
    label: 'Skills & Keywords',
    description: 'How much weight to give matching technical skills and keywords',
    color: 'teal',
  },
  {
    key: 'experienceWeight',
    label: 'Work Experience',
    description: 'Years of experience and relevant work history',
    color: 'violet',
  },
  {
    key: 'educationWeight',
    label: 'Education',
    description: 'Degree level and academic qualifications',
    color: 'blue',
  },
  {
    key: 'overallWeight',
    label: 'Overall Relevance',
    description: 'General text similarity and contextual match',
    color: 'cyan',
  },
];

const COLOR_MAP = {
  teal:   { track: 'accent-teal-600',   bg: 'bg-teal-100',   text: 'text-teal-700',   badge: 'bg-teal-600' },
  violet: { track: 'accent-violet-600', bg: 'bg-violet-100', text: 'text-violet-700', badge: 'bg-violet-600' },
  blue:   { track: 'accent-blue-600',   bg: 'bg-blue-100',   text: 'text-blue-700',   badge: 'bg-blue-600' },
  cyan:   { track: 'accent-cyan-600',   bg: 'bg-cyan-100',   text: 'text-cyan-700',   badge: 'bg-cyan-600' },
  amber:  { track: 'accent-amber-600',  bg: 'bg-amber-100',  text: 'text-amber-700',  badge: 'bg-amber-600' },
};
const MAX_CUSTOM_CRITERIA = 5;

export default function PreferencesPanel({ preferences, onChange }) {
  const customCriteria = Array.isArray(preferences.customCriteria) ? preferences.customCriteria : [];

  const customWeightTotal = customCriteria
    .filter((c) => c.enabled !== false)
    .reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  const weightTotal =
    (Number(preferences.skillsWeight) || 0) +
    (Number(preferences.experienceWeight) || 0) +
    (Number(preferences.educationWeight) || 0) +
    (Number(preferences.overallWeight) || 0) +
    customWeightTotal;

  const handleChange = (key, value) => {
    onChange({ ...preferences, [key]: Number(value) });
  };
  
  // NEW: Calculate max allowed weight for a specific slider
  const getAvailableWeightForCriterion = (currentId) => {
    const baseWeight = (Number(preferences.skillsWeight) || 0) + 
                       (Number(preferences.experienceWeight) || 0) + 
                       (Number(preferences.educationWeight) || 0) + 
                       (Number(preferences.overallWeight) || 0);
                       
    const otherCustomTotal = customCriteria
      .filter((c) => c.enabled !== false && c.id !== currentId)
      .reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
      
    return Math.max(0, 100 - baseWeight - otherCustomTotal);
  };

  const addCriterion = () => {
    if (customCriteria.length >= MAX_CUSTOM_CRITERIA) return;
    onChange({
      ...preferences,
      customCriteria: [
        ...customCriteria,
        { id: crypto.randomUUID(), term: '', weight: 0, enabled: true },
      ],
    });
  };

  const updateCriterion = (id, updates) =>
    onChange({
      ...preferences,
      customCriteria: customCriteria.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    });

  const removeCriterion = (id) =>
    onChange({ ...preferences, customCriteria: customCriteria.filter((c) => c.id !== id) });


  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-600">Matching Weights</span>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            weightTotal === 100
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          Total: {weightTotal}%
          {weightTotal !== 100 && ' (should be 100%)'}
        </span>
      </div>

      <div className="space-y-4">
        {WEIGHT_FIELDS.map(({ key, label, description, color }) => {
          const c = COLOR_MAP[color];
          const val = preferences[key] || 0;
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <div className="group relative">
                    <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                    <div className="absolute left-5 top-0 z-10 hidden group-hover:block w-48 bg-slate-800 text-white text-xs rounded-lg p-2 shadow-lg">
                      {description}
                    </div>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${c.badge}`}>
                  {val}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={val}
                onChange={(e) => handleChange(key, e.target.value)}
                className={`w-full h-2 rounded-full cursor-pointer ${c.track}`}
              />
            </div>
          );
        })}
      </div>

      {/* ── Custom criteria (AI-evaluated) ── */}
      <div className="space-y-3 pt-6 border-t border-slate-100">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-slate-600">Custom Match Criteria (AI-evaluated)</span>
        </div>

        {customCriteria.length === 0 && (
          <p className="text-xs text-slate-400">
            Add specific metrics for the AI to look for — e.g. "TPF transaction systems experience" or "fintech background". 
          </p>
        )}

        <div className="space-y-3">
          {customCriteria.map((c, index) => {
            const colorStyle = COLOR_MAP.amber;
            const val = Number(c.weight) || 0;
            const isEnabled = c.enabled !== false;

            return (
              <div 
                key={c.id} 
                className={`space-y-3 rounded-xl border transition-all duration-200 p-4 ${
                  isEnabled ? 'border-slate-200 bg-slate-50 shadow-sm' : 'border-slate-100 bg-slate-50/50 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Criterion {index + 1}
                    </label>
                    <input
                      type="text"
                      value={c.term}
                      onChange={(e) => updateCriterion(c.id, { term: e.target.value })}
                      placeholder='e.g. "Experience with Python Data Science"'
                      maxLength={150}
                      disabled={!isEnabled}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                  
                  {/* Actions: Toggle & Delete */}
                  <div className="flex flex-col items-center gap-3 pt-6">
                    <label className="relative inline-flex items-center cursor-pointer" title="Enable/Disable">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => updateCriterion(c.id, { enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-200 peer-checked:bg-amber-500 rounded-full transition-colors relative">
                        <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                      </div>
                    </label>
                    
                    <button
                      type="button"
                      onClick={() => removeCriterion(c.id)}
                      className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Remove criterion"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Weight Slider */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">Weight contribution</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${isEnabled ? colorStyle.badge : 'bg-slate-400'}`}>
                      {val}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={getAvailableWeightForCriterion(c.id)}
                    step="5"
                    value={val}
                    disabled={!isEnabled}
                    onChange={(e) => updateCriterion(c.id, { weight: Number(e.target.value) })}
                    className={`w-full h-2 rounded-full cursor-pointer disabled:cursor-not-allowed ${isEnabled ? colorStyle.track : 'accent-slate-400'}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {customCriteria.length < MAX_CUSTOM_CRITERIA && (
          <button
            type="button"
            onClick={addCriterion}
            className="mt-2 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 w-full justify-center"
          >
            <Plus className="h-4 w-4" />
            Add AI Criterion
          </button>
        )}
      </div>
    </div>
  );
}