import { useState } from 'react';
import { X, Briefcase, Loader2, Upload as UploadIcon } from 'lucide-react';
import { createJob, parseJobDescription } from '../api/client';
import toast from 'react-hot-toast';

export default function JobPostingModal({ onClose, onJobCreated, darkMode }) {
  const [mode, setMode] = useState('paste'); // 'paste' or 'upload'
  const [description, setDescription] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const isValid = mode === 'paste' ? description.trim().length > 20 : uploadFile;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setUploadFile(file);
  };

  const handleCreate = async () => {
    if (!isValid) return;

    setSaving(true);
    try {
      let jobDescription = description;

      // If upload mode, parse file first
      if (mode === 'upload' && uploadFile) {
        const parseResult = await parseJobDescription({
          file: uploadFile,
          text: '',
          useAI: true,
        });
        jobDescription = parseResult.parsed.rawText || parseResult.parsed.description || '';
      }

      // Parse to extract structured fields
      const parseResult = await parseJobDescription({
        file: null,
        text: jobDescription,
        useAI: true,
      });

      // Create job
      const result = await createJob({
        title: parseResult.parsed.title || 'Untitled Position',
        department: parseResult.parsed.department || 'Other',
        location: parseResult.parsed.location || 'Not specified',
        type: parseResult.parsed.type || 'Full-time',
        description: jobDescription,
      });

      toast.success('Job posting created!');
      onJobCreated(result.job);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to create job');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = `w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500
    ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-800'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Create Job Posting</h2>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Paste or upload job description — we'll extract the details
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Mode Toggle */}
          <div className={`flex gap-2 p-1 rounded-xl w-fit ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
            {[{ id: 'paste', label: 'Paste Text' }, { id: 'upload', label: 'Upload File' }].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                type="button"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${mode === m.id
                    ? `bg-white text-teal-700 shadow-sm ${darkMode ? 'bg-slate-600 text-teal-300' : ''}`
                    : `${darkMode ? 'text-slate-400' : 'text-slate-500'} hover:text-slate-700`
                  }
                `}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === 'paste' ? (
            <>
              <textarea
                className={`${inputCls} resize-none`}
                rows={12}
                placeholder="Paste the full job description here. Include title, department, location, requirements, skills..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
              />
              <p className={`text-xs text-right ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {description.length} characters
              </p>
            </>
          ) : (
            <div>
              <label
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all block
                  ${uploadFile
                    ? darkMode ? 'border-teal-600 bg-teal-900/20' : 'border-teal-500 bg-teal-50'
                    : darkMode ? 'border-slate-600 hover:border-teal-500' : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'
                  }`}
              >
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <UploadIcon className={`w-8 h-8 mx-auto mb-2 ${uploadFile ? 'text-teal-600' : darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <p className={`font-medium ${uploadFile ? 'text-teal-600' : darkMode ? 'text-white' : 'text-slate-700'}`}>
                  {uploadFile ? uploadFile.name : 'Drop your job description file here'}
                </p>
                <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {uploadFile ? `${(uploadFile.size / 1024).toFixed(0)} KB` : 'PDF, DOCX, or TXT — up to 10 MB'}
                </p>
              </label>
              {uploadFile && (
                <button
                  onClick={() => setUploadFile(null)}
                  className={`text-xs mt-2 ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Remove file
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex justify-end gap-2 p-5 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <button
            onClick={onClose}
            type="button"
            className={`px-4 py-2 rounded-xl text-sm ${darkMode ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-100'} transition-colors`}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid || saving}
            type="button"
            className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Briefcase className="w-4 h-4" />
                Create Job
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
