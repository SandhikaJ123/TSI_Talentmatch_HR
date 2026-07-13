import { useRef, useState } from 'react';
import { Upload, File, X, CheckCircle } from 'lucide-react';

/**
 * Reusable drag-and-drop file upload zone.
 */
export default function FileDropZone({
  label,
  accept,
  multiple = false,
  files,
  onFilesChange,
  icon: Icon = Upload,
  hint,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    const valid = dropped.filter((f) => isAccepted(f, accept));
    if (multiple) {
      onFilesChange([...files, ...valid]);
    } else {
      onFilesChange(valid.slice(0, 1));
    }
  };

  const handleChange = (e) => {
    const selected = Array.from(e.target.files);
    if (multiple) {
      onFilesChange([...files, ...selected]);
    } else {
      onFilesChange(selected.slice(0, 1));
    }
    e.target.value = '';
  };

  const removeFile = (index) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
          ${dragging
            ? 'border-teal-500 bg-teal-50 scale-[1.01]'
            : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          <div className={`p-3 rounded-full ${dragging ? 'bg-teal-100' : 'bg-slate-100'}`}>
            <Icon className={`w-6 h-6 ${dragging ? 'text-teal-600' : 'text-slate-500'}`} />
          </div>
          <div>
            <p className="font-medium text-slate-700">{label}</p>
            {hint && <p className="text-sm text-slate-500 mt-1">{hint}</p>}
          </div>
          <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            {accept.replace(/\./g, '').toUpperCase().replace(/,/g, ' · ')}
          </span>
        </div>
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, i) => (
            <li
              key={i}
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-2.5 shadow-sm"
            >
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <File className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm text-slate-700 truncate flex-1">{file.name}</span>
              <span className="text-xs text-slate-400 shrink-0">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function isAccepted(file, accept) {
  if (!accept) return true;
  const types = accept.split(',').map((t) => t.trim().toLowerCase());
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  return types.some((t) => t === ext || file.type.includes(t.replace('.', '')));
}
