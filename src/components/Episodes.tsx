import { useState } from 'react';
import { Plus, Trash2, Tv, Clock } from 'lucide-react';
import type { Episode, Project, Scene, Shot, Character, Wardrobe } from '@/lib/types';
import { createEpisode, updateEpisode, deleteRow } from '@/lib/db';
import { EPISODE_STATUSES } from '@/lib/types';
import { Button, Field, Modal, SectionHeader, SelectField, EmptyState } from './ui';

interface Props {
  project: Project;
  episodes: Episode[];
  scenes: Scene[];
  shots: Shot[];
  characters: Character[];
  wardrobes: Wardrobe[];
  refresh: () => Promise<void>;
  onOpenShots: (episode: Episode) => void;
}

const BEAT_FIELDS: { key: keyof Episode; label: string; placeholder: string }[] = [
  { key: 'hook', label: 'Hook (00-03s)', placeholder: 'Shock / pertanyaan / bahaya dalam detik pertama.' },
  { key: 'context', label: 'Context Minimum (03-10s)', placeholder: 'Info minimum agar penonton paham taruhan.' },
  { key: 'conflict', label: 'Conflict (10-22s)', placeholder: 'Konflik tiba.' },
  { key: 'escalation', label: 'Escalation (22-36s)', placeholder: 'Tekanan meningkat.' },
  { key: 'reversal', label: 'Reversal (36-48s)', placeholder: 'Arah cerita berbalik.' },
  { key: 'consequence', label: 'Consequence (48-56s)', placeholder: 'Dampak emosional.' },
  { key: 'cliffhanger', label: 'Cliffhanger (56-60s)', placeholder: 'Information gap / aksi belum selesai.' },
  { key: 'cliffhanger_visual', label: 'Visual Final Cliffhanger', placeholder: 'Frame terakhir yang terbaca tanpa audio.' },
];

export default function Episodes({ project, episodes, scenes, shots, characters, wardrobes, refresh, onOpenShots }: Props) {
  const [modal, setModal] = useState<'new' | Episode | null>(null);

  return (
    <div>
      <SectionHeader title="Episode & Beat Sheet"
        subtitle="Retention curve 60 detik: hook cepat, eskalasi cepat, ditutup cliffhanger."
        action={<Button onClick={() => setModal('new')}><Plus size={15} /> Episode Baru</Button>} />

      {episodes.length === 0 ? (
        <EmptyState icon={<Tv size={32} />} title="Belum ada episode"
          hint="Setiap episode punya 7 beat: hook → context → conflict → escalation → reversal → consequence → cliffhanger." />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {episodes.map((ep) => {
            const epScenes = scenes.filter((s) => s.episode_id === ep.id);
            const shotCount = shots.filter((s) => epScenes.some((sc) => sc.id === s.scene_id)).length;
            const totalSec = shots.filter((s) => epScenes.some((sc) => sc.id === s.scene_id)).reduce((a, s) => a + s.duration, 0);
            return (
              <div key={ep.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-white/20 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                      {String(ep.number).padStart(2, '0')}
                    </span>
                    <div>
                      <h4 className="font-semibold text-zinc-100 leading-tight">{ep.title || `Episode ${ep.number}`}</h4>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{ep.status}</span>
                    </div>
                  </div>
                  <button onClick={async () => { if (confirm(`Hapus Episode ${ep.number}?`)) { await deleteRow('episodes', ep.id); await refresh(); } }}
                    className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                {ep.hook && <p className="text-xs text-zinc-400 mt-2 line-clamp-2"><span className="text-amber-500/80 font-medium">Hook:</span> {ep.hook}</p>}
                {ep.cliffhanger && <p className="text-xs text-zinc-500 mt-1 line-clamp-2"><span className="text-zinc-400 font-medium">Cliff:</span> {ep.cliffhanger}</p>}
                <div className="flex items-center gap-3 mt-3 text-[11px] text-zinc-600">
                  <span>{epScenes.length} scene</span>
                  <span>{shotCount} shot</span>
                  <span className="inline-flex items-center gap-1"><Clock size={11} /> {totalSec}s / {project.episode_seconds}s</span>
                </div>
                <div className="flex gap-1.5 mt-3">
                  <Button variant="subtle" className="flex-1 !py-1.5 text-xs" onClick={() => setModal(ep)}>
                    Edit Beat
                  </Button>
                  <Button variant="primary" className="flex-1 !py-1.5 text-xs" onClick={() => onOpenShots(ep)}>
                    Shot List
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <EpisodeModal
          projectId={project.id}
          existing={modal === 'new' ? null : modal}
          nextNumber={episodes.reduce((m, e) => Math.max(m, e.number), 0) + 1}
          charactersCount={characters.length}
          wardrobesCount={wardrobes.length}
          onClose={() => setModal(null)}
          refresh={refresh}
        />
      )}
    </div>
  );
}

function EpisodeModal({ projectId, existing, nextNumber, charactersCount, wardrobesCount, onClose, refresh }: {
  projectId: string;
  existing: Episode | null;
  nextNumber: number;
  charactersCount: number;
  wardrobesCount: number;
  onClose: () => void;
  refresh: () => Promise<void>;
}) {
  const [f, setF] = useState({
    number: existing?.number ?? nextNumber,
    title: existing?.title ?? '',
    status: existing?.status ?? 'draft',
    ...Object.fromEntries(BEAT_FIELDS.map((b) => [b.key, existing?.[b.key] ?? ''])),
  } as unknown as Record<string, string>);
  const set = (k: string) => (v: string) => setF({ ...f, [k]: v });
  const [saving, setSaving] = useState(false);

  return (
    <Modal title={existing ? `Edit Episode ${existing.number}` : 'Episode Baru'} onClose={onClose} wide>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          const payload = {
            number: parseInt(f.number, 10) || nextNumber,
            title: f.title,
            status: f.status,
            hook: f.hook, context: f.context, conflict: f.conflict,
            escalation: f.escalation, reversal: f.reversal, consequence: f.consequence,
            cliffhanger: f.cliffhanger, cliffhanger_visual: f.cliffhanger_visual,
          };
          if (existing) await updateEpisode(existing.id, payload);
          else await createEpisode(projectId, payload);
          await refresh();
          onClose();
        } finally { setSaving(false); }
      }}>
        <div className="grid md:grid-cols-4 gap-3">
          <Field label="Nomor" value={f.number} onChange={set('number')} type="number" />
          <Field label="Judul" value={f.title} onChange={set('title')} placeholder="Amplop Merah" />
          <SelectField label="Status" value={f.status} onChange={set('status')} allowEmpty={false}
            options={EPISODE_STATUSES.map((s) => ({ value: s, label: s }))} />
          <div className="flex items-end">
            <p className="text-[11px] text-zinc-600 leading-snug">
              {charactersCount > 0 && wardrobesCount > 0
                ? 'Karakter & kostum siap dipakai di shot list.'
                : 'Tips: isi karakter & kostum di Asset Bible agar shot list terkunci kanoniknya.'}
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {BEAT_FIELDS.map((b) => (
            <Field key={b.key} label={b.label} value={f[b.key]} onChange={set(b.key)} textarea rows={2} placeholder={b.placeholder} />
          ))}
        </div>
        <div className="flex justify-end pt-1">
          <Button type="submit" disabled={saving}>Simpan Episode</Button>
        </div>
      </form>
    </Modal>
  );
}
