'use client';
import { useState } from 'react';

interface Props {
  columnId: number;
  onAdd: (data: { title: string; description: string; priority: string; assignee: string; progress: number }) => void;
  onClose: () => void;
}

export default function AddCardModal({ columnId: _columnId, onAdd, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignee, setAssignee] = useState('');
  const [progress, setProgress] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ title: title.trim(), description, priority, assignee, progress });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white text-lg font-semibold mb-4">새 카드 추가</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="제목 *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <textarea
            placeholder="설명 (선택)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="low">낮음 (Low)</option>
            <option value="medium">보통 (Medium)</option>
            <option value="high">높음 (High)</option>
          </select>
          <input
            type="text"
            placeholder="담당자 (선택)"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
          />
          {/* 진행률 슬라이더 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 text-sm">진행률</label>
              <span className="text-slate-300 text-sm font-medium">{progress}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              추가
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
