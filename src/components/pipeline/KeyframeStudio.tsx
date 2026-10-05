import { useMemo, useRef, useState, useEffect } from 'react';
import {
  ImageIcon, RefreshCw, Check, Lock, Loader2, Download, Wand2, SlidersHorizontal, X,
} from 'lucide-react';
import type { Project, StudioData, Episode, KeyframeParams } from '@/lib/types';
import { upsertKeyframe, setKeyframeApproval } from '@/lib/db';
import { downloadFrame, renderFrame, FRAME_W, FRAME_H, type RenderContext } from '@/lib/frame-renderer';
import { Button, Modal, EmptyState, SelectField } from '@/components/ui';

interface Props {
  project: Project;
  data: StudioData;
  refresh: () => Promise<void>;
  onNext: (episode: Episode) => void;
}

const EXPRESSIONS = ['neutral', 'angry', 'sad', 'shocked', 'afraid', 'smile'];
const LIGHT_SIDES = ['left', 'right'];

export default function KeyframeStudio({ project, data, refresh, onNext }: Props) {
  const [episodeId, setEpisodeId] = useState('');
  const [editing, setEditing] = useState<{ shotId: string; params: KeyframeParams; seed: number } | null>(null);
  const [busyShot, setBusyShot] = useState<string | null>(null);

  const episode = data.episodes.find((e) => e.id === episodeId) ?? null;
  const epScenes = useMemo(
    () => data.scenes.filter((s) => s.episode_id === episodeId),
    [data.scenes, episodeId],
  );
  const epShots = useMemo(
    () => data.shots.filter((s) => epScenes.some((sc) => sc.id === s.scene_id)),
    [data.shots, epScenes],
  );

  const genAll = async () => {
    for (const sh of epShots) {
      setBusyShot(sh.id);
      await upsertKeyframe(project.id, sh.id, 1, defaultParams(sh));
    }
    setBusyShot(null);
    await refresh();
  };

  const regenerate = async (shotId: string, params: KeyframeParams, seed: number) => {
    setBusyShot(shotId);
    try {
      await upsertKeyframe(project.id, shotId, seed + 1, params);
      await refresh();
    } finally {
      setBusyShot(null);
    }
  };

  const approve = async (shotId: string, approved: boolean) => {
    const kf = data.keyframes.find((k) => k.shot_id === shotId);
    if (!kf) return;
    await setKeyframeApproval(kf.id, approved);
    await refresh();
  };

  const approvedCount = epShots.filter((s) =>
    data.keyframes.find((k) => k.shot_id === s.id)?.approved).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Keyframe Studio</h2>
          <p className="text-sm text-zinc-500">Langkah 1 — bangkitkan gambar per shot, perbaiki yang kurang pas, kunci sebagai keyframe.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <select value={episodeId} onChange={(e) => setEpisodeId(e.target.value)}
            className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60 [&>option]:bg-zinc-900">
            <option value="">Pilih episode…</option>
            {data.episodes.map((ep) => (
              <option key={ep.id} value={ep.id}>EP{String(ep.number).padStart(2, '0')} {ep.title}</option>
            ))}
          </select>
          <Button onClick={genAll} disabled={!episode || busyShot !== null || epShots.length === 0}>
            {busyShot ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            Generate Semua
          </Button>
          <Button variant="subtle" disabled={!episode || approvedCount === 0} onClick={() => episode && onNext(episode)}>
            Lanjut ke Video →
          </Button>
        </div>
      </div>

      {episode && epShots.length > 0 && (
        <p className="text-xs text-zinc-500 mb-3">
          {approvedCount}/{epShots.length} keyframe disetujui
          {approvedCount === epShots.length && ' — episode siap dirender menjadi video.'}
        </p>
      )}

      {!episode ? (
        <EmptyState icon={<ImageIcon size={32} />} title="Pilih episode untuk mulai"
          hint="Keyframe dibuat per shot dari data kanonik: karakter, kostum, lokasi, lighting, dan blocking." />
      ) : epShots.length === 0 ? (
        <EmptyState icon={<ImageIcon size={32} />} title="Episode ini belum punya shot"
          hint="Buat shot lewat tab Shot List atau Auto Coverage di tab Alat AI." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {epShots.map((sh) => (
            <KeyframeCard
              key={sh.id}
              project={project} data={data} shotId={sh.id}
              busy={busyShot === sh.id}
              onRegenerate={() => {
                const kf = data.keyframes.find((k) => k.shot_id === sh.id);
                regenerate(sh.id, kf?.params ?? defaultParams(sh), kf?.seed ?? 1);
              }}
              onApprove={() => approve(sh.id, true)}
              onUnapprove={() => approve(sh.id, false)}
              onEdit={() => {
                const kf = data.keyframes.find((k) => k.shot_id === sh.id);
                setEditing({ shotId: sh.id, params: kf?.params ?? defaultParams(sh), seed: kf?.seed ?? 1 });
              }}
              onDownload={() => {
                const rc = buildContext(project, data, sh.id);
                if (rc) void downloadFrame(rc, `EP${String(episode.number).padStart(2, '0')}_SH${String(sh.shot_number).padStart(2, '0')}.jpg`);
              }}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditParamsModal
          params={editing.params}
          onClose={() => setEditing(null)}
          onSave={async (p) => {
            await regenerate(editing.shotId, p, editing.seed);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function defaultParams(_shot: unknown): KeyframeParams {
  return { expression: 'neutral', light_side: 'left', intensity: 0.6 };
}

export function buildContext(
  project: Project, data: StudioData, shotId: string,
): RenderContext | null {
  const shot = data.shots.find((s) => s.id === shotId);
  if (!shot) return null;
  const scene = data.scenes.find((s) => s.id === shot.scene_id);
  if (!scene) return null;
  const kf = data.keyframes.find((k) => k.shot_id === shotId);
  return {
    shot, scene, project,
    character: data.characters.find((c) => c.id === shot.character_id),
    location: data.locations.find((l) => l.id === scene.location_id),
    seed: kf?.seed ?? 1,
    params: kf?.params ?? defaultParams(shot),
  };
}

function KeyframeCard({ project, data, shotId, busy, onRegenerate, onApprove, onUnapprove, onEdit, onDownload }: {
  project: Project;
  data: StudioData;
  shotId: string;
  busy: boolean;
  onRegenerate: () => void;
  onApprove: () => void;
  onUnapprove: () => void;
  onEdit: () => void;
  onDownload: () => void;
}) {
  const rc = buildContext(project, data, shotId);
  const kf = data.keyframes.find((k) => k.shot_id === shotId);
  const shot = rc?.shot;
  if (!rc || !shot) return null;

  return (
    <div className={`rounded-xl border overflow-hidden transition-colors ${kf?.approved ? 'border-emerald-500/50' : 'border-white/10'}`}>
      <div className="relative bg-black">
        <FrameImage rc={rc} />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Loader2 className="animate-spin text-amber-400" size={22} />
          </div>
        )}
        {kf?.approved && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 text-zinc-950 text-[10px] font-bold px-2 py-0.5">
            <Lock size={9} /> CANON
          </span>
        )}
        <span className="absolute top-2 left-2 rounded bg-black/60 text-[10px] font-mono text-zinc-300 px-1.5 py-0.5">
          SH{String(shot.shot_number).padStart(2, '0')}
        </span>
      </div>
      <div className="p-2.5">
        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-snug min-h-[2rem]">
          {shot.action || shot.dialogue || '—'}
        </p>
        <p className="text-[10px] text-zinc-600 mt-1">
          {data.characters.find((c) => c.id === shot.character_id)?.canonical_name ?? 'tanpa karakter'}
          {' · '}{shot.shot_size} · {shot.duration}s
        </p>
        <div className="flex flex-wrap gap-1 mt-2">
          {kf && (kf.approved ? (
            <IconBtn title="Batalkan approval" onClick={onUnapprove}><Check size={13} className="text-emerald-400" /></IconBtn>
          ) : (
            <IconBtn title="Setujui sebagai keyframe" onClick={onApprove}><Check size={13} /></IconBtn>
          ))}
          <IconBtn title="Generate ulang (variasi baru)" onClick={onRegenerate}><RefreshCw size={13} /></IconBtn>
          <IconBtn title="Edit ekspresi / cahaya" onClick={onEdit}><SlidersHorizontal size={13} /></IconBtn>
          <IconBtn title="Unduh gambar" onClick={onDownload}><Download size={13} /></IconBtn>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title }: {
  children: React.ReactNode; onClick: () => void; title: string;
}) {
  return (
    <button onClick={onClick} title={title}
      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/10 hover:text-zinc-100 transition-colors">
      {children}
    </button>
  );
}

export function FrameImage({ rc, className }: { rc: RenderContext; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) renderFrame(ctx, rc);
  }, [rc]);
  return (
    <canvas ref={ref} width={FRAME_W} height={FRAME_H}
      className={`w-full block ${className ?? ''}`}
      style={{ aspectRatio: '9 / 16' }} />
  );
}

function EditParamsModal({ params, onClose, onSave }: {
  params: KeyframeParams;
  onClose: () => void;
  onSave: (p: KeyframeParams) => Promise<void>;
}) {
  const [p, setP] = useState<KeyframeParams>(params);
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="Edit Visual Shot" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-zinc-500">
          Ubah ekspresi dan pencahayaan, lalu shot akan dibangkitkan ulang dengan variasi baru.
        </p>
        <SelectField label="Ekspresi" value={p.expression} allowEmpty={false}
          onChange={(v) => setP({ ...p, expression: v })}
          options={EXPRESSIONS.map((e) => ({ value: e, label: e }))} />
        <SelectField label="Sisi Cahaya Utama" value={p.light_side} allowEmpty={false}
          onChange={(v) => setP({ ...p, light_side: v })}
          options={LIGHT_SIDES.map((e) => ({ value: e, label: e }))} />
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">
            Intensitas Cahaya ({Math.round(p.intensity * 100)}%)
          </span>
          <input type="range" min="0.2" max="1" step="0.05" value={p.intensity}
            onChange={(e) => setP({ ...p, intensity: parseFloat(e.target.value) })}
            className="w-full accent-amber-500" />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}><X size={14} /> Batal</Button>
          <Button disabled={saving} onClick={async () => {
            setSaving(true);
            try { await onSave(p); } finally { setSaving(false); }
          }}><RefreshCw size={14} /> Generate Ulang</Button>
        </div>
      </div>
    </Modal>
  );
}
