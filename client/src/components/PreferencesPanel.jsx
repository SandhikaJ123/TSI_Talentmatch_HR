import { Settings2, Info } from 'lucide-react';

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
};

export default function PreferencesPanel({ preferences, onChange }) {
  const total = Object.values(preferences)
    .filter((_, i) => i < 4)
    .reduce((sum, v) => {
      const num = typeof v === 'number' ? v : 0;
      return sum + num;
    }, 0);

  const weightTotal =
    (preferences.skillsWeight || 0) +
    (preferences.experienceWeight || 0) +
    (preferences.educationWeight || 0) +
    (preferences.overallWeight || 0);

  const handleChange = (key, value) => {
    onChange({ ...preferences, [key]: Number(value) });
  };

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
    </div>
  );
}
