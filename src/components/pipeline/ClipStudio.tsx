import { useMemo, useRef, useState } from 'react';
import {
  Video, Play, Loader2, Download, ArrowRight, CheckCircle2, Film, Square,
} from 'lucide-react';
import type { Project, StudioData, Episode } from '@/lib/types';
import { buildContext, FrameImage } from './KeyframeStudio';
import { canRecordVideo, renderShotClip, downloadBlob, blobDuration, type ClipResult } from '@/lib/video-engine';
import { Button, EmptyState } from '@/components/ui';

interface ClipEntry {
  shotId: string;
  blob: Blob;
  url: string;
  duration: number;
}

interface Props {
  project: Project;
  data: StudioData;
  initialEpisodeId: string | null;
  clips: Record<string, ClipEntry>;
  onClipRendered: (shotId: string, entry: ClipEntry) => void;
  onNext: (episode: Episode) => void;
}

export default function ClipStudio({ project, data, initialEpisodeId, clips, onClipRendered, onNext }: Props) {
  const [episodeId, setEpisodeId] = useState(initialEpisodeId ?? '');
  const [rendering, setRendering] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const episode = data.episodes.find((e) => e.id === episodeId) ?? null;
  const epShots = useMemo(() => {
    const scenes = data.scenes.filter((s) => s.episode_id === episodeId);
    return data.shots.filter((s) => scenes.some((sc) => sc.id === s.scene_id));
  }, [data.scenes, data.shots, episodeId]);

  const approvedCount = epShots.filter((s) =>
    data.keyframes.find((k) => k.shot_id === s.id)?.approved).length;

  const approvedShots = epShots.filter((s) =>
    data.keyframes.find((k) => k.shot_id === s.id)?.approved);

  const renderOne = async (shotId: string) => {
    const rc = buildContext(project, data, shotId);
    if (!rc) return;
    setRendering(shotId);
    setError(null);
    try {
      const result: ClipResult = await renderShotClip(rc);
      onClipRendered(shotId, {
        shotId, blob: result.blob, url: result.url, duration: result.duration,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal merender klip');
    } finally {
      setRendering(null);
    }
  };

  const renderAllApproved = async () => {
    cancelRef.current = false;
    setBatch({ done: 0, total: approvedShots.length });
    for (let i = 0; i < approvedShots.length; i++) {
      if (cancelRef.current) break;
      await renderOne(approvedShots[i].id);
      setBatch({ done: i + 1, total: approvedShots.length });
    }
    setTimeout(() => setBatch(null), 1500);
  };

  const totalDuration = Object.values(clips)
    .filter((c) => epShots.some((s) => s.id === c.shotId))
    .reduce((acc, c) => acc + c.duration, 0);

  const ready = approvedShots.length > 0 && approvedShots.every((s) => clips[s.id]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Clip Studio</h2>
          <p className="text-sm text-zinc-500">Langkah 2 — setiap keyframe yang disetujui dirender menjadi klip video animatic.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <select value={episodeId} onChange={(e) => { setEpisodeId(e.target.value); setError(null); }}
            className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60 [&>option]:bg-zinc-900">
            <option value="">Pilih episode…</option>
            {data.episodes.map((ep) => (
              <option key={ep.id} value={ep.id}>EP{String(ep.number).padStart(2, '0')} {ep.title}</option>
            ))}
          </select>
          {batch ? (
            <Button variant="danger" onClick={() => { cancelRef.current = true; }}>
              <Square size={14} /> Stop ({batch.done}/{batch.total})
            </Button>
          ) : (
            <Button onClick={renderAllApproved}
              disabled={!episode || approvedShots.length === 0 || rendering !== null}>
              <Video size={14} /> Render Semua ({approvedShots.length})
            </Button>
          )}
          <Button variant="subtle" disabled={!ready || !episode} onClick={() => episode && onNext(episode)}>
            Lanjut ke Rakitan →
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {episode && approvedCount < epShots.length && (
        <p className="mb-3 text-xs text-amber-400">
          {epShots.length - approvedCount} shot belum punya keyframe disetujui — setujui dulu di Keyframe Studio.
        </p>
      )}

      {!episode ? (
        <EmptyState icon={<Film size={32} />} title="Pilih episode"
          hint="Klip dirender langsung di browser dari keyframe yang sudah disetujui — gerak kamera mengikuti shot list." />
      ) : approvedShots.length === 0 ? (
        <EmptyState icon={<Film size={32} />} title="Belum ada keyframe disetujui"
          hint="Kembali ke Keyframe Studio, generate dan setujui keyframe terlebih dahulu." />
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3 text-xs text-zinc-500">
            <span>{Object.values(clips).filter((c) => epShots.some((s) => s.id === c.shotId)).length}/{approvedShots.length} klip dirender</span>
            {totalDuration > 0 && <span>· total {Math.round(totalDuration)}s</span>}
            {ready && <span className="text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 size={12} /> siap dirakit</span>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {approvedShots.map((sh) => {
              const rc = buildContext(project, data, sh.id);
              const clip = clips[sh.id];
              return (
                <div key={sh.id} className="rounded-xl border border-white/10 overflow-hidden">
                  <div className="relative bg-black">
                    {clip ? (
                      <video src={clip.url} className="w-full block" style={{ aspectRatio: '9/16' }}
                        controls muted playsInline loop />
                    ) : (
                      <>
                        {rc && <FrameImage rc={rc} />}
                        {rendering === sh.id && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm">
                            <Loader2 className="animate-spin text-amber-400" size={22} />
                            <span className="text-[10px] text-zinc-400">merekam klip…</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="p-2.5 flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-500 flex-1">
                      SH{String(sh.shot_number).padStart(2, '0')} · {sh.camera_move} · {clip ? `${Math.round(clip.duration)}s` : `${sh.duration}s`}
                    </span>
                    {clip && (
                      <Button variant="ghost" className="!p-1.5"
                        onClick={() => downloadBlob(clip.blob, `clip_SH${String(sh.shot_number).padStart(2, '0')}.webm`}>
                        <Download size={13} />
                      </Button>
                    )}
                    {!clip && (
                      <Button variant="ghost" className="!p-1.5" disabled={rendering !== null}
                        onClick={() => renderOne(sh.id)}>
                        <Play size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!canRecordVideo() && (
        <p className="mt-4 text-xs text-amber-400">
          Browser ini tidak mendukung perekaman video. Gunakan Chrome atau Edge versi terbaru.
        </p>
      )}
    </div>
  );
}
