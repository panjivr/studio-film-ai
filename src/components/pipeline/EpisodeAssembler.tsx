import { useMemo, useRef, useState } from 'react';
import {
  Layers, Loader2, Download, ArrowRight, Play, ArrowUp, ArrowDown, Film, CheckCircle2,
} from 'lucide-react';
import type { StudioData, Episode } from '@/lib/types';
import { canRecordVideo, assembleFilm, downloadBlob, type ClipEntry } from '@/lib/video-engine';
import { Button, EmptyState } from '@/components/ui';

interface Props {
  data: StudioData;
  initialEpisodeId: string | null;
  clips: Record<string, ClipEntry>;
  onEpisodeReady: (episodeId: string, blob: Blob) => void;
  onNext: (episode: Episode) => void;
}

export default function EpisodeAssembler({ data, initialEpisodeId, clips, onEpisodeReady, onNext }: Props) {
  const [episodeId, setEpisodeId] = useState(initialEpisodeId ?? '');
  const [order, setOrder] = useState<string[]>([]);
  const [episodeVideo, setEpisodeVideo] = useState<{ url: string; blob: Blob } | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  const episode = data.episodes.find((e) => e.id === episodeId) ?? null;

  const epShots = useMemo(() => {
    const scenes = data.scenes.filter((s) => s.episode_id === episodeId);
    return data.shots.filter((s) => scenes.some((sc) => sc.id === s.scene_id));
  }, [data.scenes, data.shots, episodeId]);

  const orderedShotIds = useMemo(() => {
    const withClips = epShots.filter((s) => clips[s.id]).map((s) => s.id);
    const valid = order.filter((id) => withClips.includes(id));
    const missing = withClips.filter((id) => !valid.includes(id));
    return [...valid, ...missing];
  }, [epShots, clips, order]);

  const move = (id: string, dir: -1 | 1) => {
    setOrder((prev) => {
      const list = orderedShotIds;
      const i = list.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return prev;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const assemble = async () => {
    if (!episode || orderedShotIds.length === 0) return;
    setAssembling(true);
    setError(null);
    try {
      const blob = await assembleFilm({
        clips: orderedShotIds.map((id) => ({ blob: clips[id].blob })),
        onProgress: (done, total) => setProgress(`menggabungkan klip ${done}/${total}…`),
      });
      setEpisodeVideo({ blob, url: URL.createObjectURL(blob) });
      onEpisodeReady(episode.id, blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal merakit episode');
    } finally {
      setAssembling(false);
      setProgress('');
    }
  };

  const totalDur = orderedShotIds.reduce((a, id) => a + (clips[id]?.duration ?? 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Episode Assembler</h2>
          <p className="text-sm text-zinc-500">Langkah 3 — susun urutan klip, rakit menjadi satu video episode.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <select value={episodeId} onChange={(e) => { setEpisodeId(e.target.value); setOrder([]); setEpisodeVideo(null); }}
            className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60 [&>option]:bg-zinc-900">
            <option value="">Pilih episode…</option>
            {data.episodes.map((ep) => (
              <option key={ep.id} value={ep.id}>EP{String(ep.number).padStart(2, '0')} {ep.title}</option>
            ))}
          </select>
          <Button onClick={assemble} disabled={!episode || orderedShotIds.length === 0 || assembling}>
            {assembling ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
            Jadikan Video Episode
          </Button>
          <Button variant="subtle" disabled={!episode || !episodeVideo} onClick={() => episode && onNext(episode)}>
            Lanjut ke Film Final →
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}
      {assembling && progress && (
        <p className="mb-3 text-xs text-amber-400">{progress}</p>
      )}

      {!episode ? (
        <EmptyState icon={<Film size={32} />} title="Pilih episode"
          hint="Klip dari Clip Studio dirakit berurutan menjadi satu video episode." />
      ) : orderedShotIds.length === 0 ? (
        <EmptyState icon={<Film size={32} />} title="Belum ada klip"
          hint="Render klip terlebih dahulu di Clip Studio." />
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-5">
          <div ref={previewRef}>
            {episodeVideo ? (
              <div className="rounded-xl border border-emerald-500/40 overflow-hidden bg-black">
                <video src={episodeVideo.url} controls className="w-full" style={{ aspectRatio: '9/16', maxHeight: 560 }} />
                <div className="flex items-center gap-2 p-3">
                  <span className="text-xs text-emerald-400 inline-flex items-center gap-1 flex-1">
                    <CheckCircle2 size={13} /> Video episode siap
                  </span>
                  <Button variant="subtle" className="!py-1.5 text-xs"
                    onClick={() => downloadBlob(episodeVideo.blob, `EP${String(episode.number).padStart(2, '0')}.webm`}>
                    <Download size={13} /> Unduh Episode
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 h-full flex flex-col items-center justify-center text-center">
                <Film className="text-zinc-700 mb-3" size={36} />
                <p className="text-sm text-zinc-400">Pratinjau episode muncul di sini setelah dirakit.</p>
                <p className="text-xs text-zinc-600 mt-1">{orderedShotIds.length} klip · {Math.round(totalDur)} detik</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-500/90 mb-2">
              Timeline ({orderedShotIds.length} klip)
            </p>
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {orderedShotIds.map((id, i) => {
                const shot = data.shots.find((s) => s.id === id);
                if (!shot) return null;
                return (
                  <div key={id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2">
                    <span className="text-[10px] font-mono text-zinc-600 w-5">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-zinc-300 truncate">
                        SH{String(shot.shot_number).padStart(2, '0')} {shot.shot_size} · {shot.camera_move}
                      </p>
                      <p className="text-[10px] text-zinc-600 truncate">{shot.action || '—'}</p>
                    </div>
                    <button onClick={() => move(id, -1)} className="p-1 text-zinc-600 hover:text-zinc-200 transition-colors"><ArrowUp size={12} /></button>
                    <button onClick={() => move(id, 1)} className="p-1 text-zinc-600 hover:text-zinc-200 transition-colors"><ArrowDown size={12} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!canRecordVideo() && (
        <p className="mt-4 text-xs text-amber-400">Browser ini tidak mendukung perekaman video — gunakan Chrome/Edge terbaru.</p>
      )}
    </div>
  );
}
