import Board from '@/components/Board';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <h1 className="text-white text-xl font-bold">AI Team Kanban</h1>
      </header>
      <div className="p-6">
        <Board />
      </div>
    </main>
  );
}
