import { useMemo, useRef, useState } from 'react';
import {
  Clapperboard, Loader2, Download, Music, Mic, Upload, Trash2, Play, Volume2,
} from 'lucide-react';
import type { Project, StudioData } from '@/lib/types';
import { canRecordVideo, assembleFilm, downloadBlob } from '@/lib/video-engine';
import { Button, EmptyState } from '@/components/ui';

interface EpisodeVideo {
  episodeId: string;
  blob: Blob;
  url: string;
}

interface Props {
  project: Project;
  data: StudioData;
  completed: Record<string, EpisodeVideo>;
  onEpisodeReady: (episodeId: string, blob: Blob) => void;
}

export default function FilmFinal({ project, data, completed, onEpisodeReady }: Props) {
  const [backsound, setBacksound] = useState<Blob | null>(null);
  const [backsoundName, setBacksoundName] = useState('');
  const [backsoundVol, setBacksoundVol] = useState(0.35);
  const [voiceover, setVoiceover] = useState<Blob | null>(null);
  const [voiceName, setVoiceName] = useState('');
  const [voiceVol, setVoiceVol] = useState(1);
  const [building, setBuilding] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [master, setMaster] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);

  const episodesWithVideo = useMemo(
    () => data.episodes.filter((ep) => completed[ep.id]),
    [data.episodes, completed],
  );

  const buildEpisode = async (episodeId: string) => {
    const ep = data.episodes.find((e) => e.id === episodeId);
    if (!ep) return;
    const scenes = data.scenes.filter((s) => s.episode_id === episodeId);
    const shots = data.shots.filter((s) => scenes.some((sc) => sc.id === s.scene_id));
    const epClips = shots
      .map((s) => completed[s.id])
      .filter(Boolean)
      .map((c) => ({ blob: c.blob }));
    if (epClips.length === 0) {
      setError(`Episode ${ep.number} belum punya klip — render dulu di Clip Studio.`);
      return;
    }
    setBuilding(episodeId);
    setError(null);
    try {
      const blob = await assembleFilm({
        clips: epClips,
        backsound,
        voiceover,
        backsoundVolume: backsoundVol,
        voiceVolume: voiceVol,
        onProgress: (done, total) => setProgress(`EP${ep.number}: klip ${done}/${total}…`),
      });
      onEpisodeReady(episodeId, blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal merakit episode');
    } finally {
      setBuilding(null);
      setProgress('');
    }
  };

  const buildMaster = async () => {
    if (episodesWithVideo.length === 0) return;
    setBuilding('master');
    setError(null);
    try {
      const blob = await assembleFilm({
        clips: episodesWithVideo.map((ep) => ({ blob: completed[ep.id].blob })),
        backsound,
        backsoundVolume: backsoundVol,
        onProgress: (done, total) => setProgress(`menggabungkan episode ${done}/${total}…`),
      });
      setMaster({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal merakit film final');
    } finally {
      setBuilding(null);
      setProgress('');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Film Final</h2>
          <p className="text-sm text-zinc-500">Langkah 4 — rakit tiap episode, gabungkan jadi satu film, tambah backsound & suara, lalu ekspor.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}
      {building && progress && (
        <p className="mb-4 text-xs text-amber-400 inline-flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" /> {progress}
        </p>
      )}

      {/* Audio desk */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4 mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-500/90 mb-3 inline-flex items-center gap-2">
          <Music size={13} /> Audio Film
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Button variant="subtle" className="!py-1.5 text-xs" onClick={() => backInputRef.current?.click()}>
                <Upload size={13} /> {backsound ? 'Ganti Backsound' : 'Unggah Backsound'}
              </Button>
              {backsound && (
                <Button variant="ghost" className="!p-1.5" onClick={() => { setBacksound(null); setBacksoundName(''); }}>
                  <Trash2 size={13} />
                </Button>
              )}
            </div>
            <p className="text-[11px] text-zinc-600 mt-1.5">
              {backsoundName || 'MP3/WAV untuk musik latar (otomatis di-loop sepanjang film).'}
            </p>
            <label className="flex items-center gap-2 mt-2 text-[11px] text-zinc-500">
              <Volume2 size={12} />
              <input type="range" min="0" max="1" step="0.05" value={backsoundVol}
                onChange={(e) => setBacksoundVol(parseFloat(e.target.value))}
                className="flex-1 accent-amber-500" />
              {Math.round(backsoundVol * 100)}%
            </label>
            <input ref={backInputRef} type="file" accept="audio/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setBacksound(f); setBacksoundName(f.name); }
              }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Button variant="subtle" className="!py-1.5 text-xs" onClick={() => voiceInputRef.current?.click()}>
                <Mic size={13} /> {voiceover ? 'Ganti Voiceover' : 'Unggah Suara/Narasi'}
              </Button>
              {voiceover && (
                <Button variant="ghost" className="!p-1.5" onClick={() => { setVoiceover(null); setVoiceName(''); }}>
                  <Trash2 size={13} />
                </Button>
              )}
            </div>
            <p className="text-[11px] text-zinc-600 mt-1.5">
              {voiceName || 'Opsional: narasi atau dialog yang ikut terekam ke film.'}
            </p>
            <label className="flex items-center gap-2 mt-2 text-[11px] text-zinc-500">
              <Volume2 size={12} />
              <input type="range" min="0" max="1" step="0.05" value={voiceVol}
                onChange={(e) => setVoiceVol(parseFloat(e.target.value))}
                className="flex-1 accent-amber-500" />
              {Math.round(voiceVol * 100)}%
            </label>
            <input ref={voiceInputRef} type="file" accept="audio/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setVoiceover(f); setVoiceName(f.name); }
              }} />
          </div>
        </div>
      </section>

      {/* Episode list */}
      <section className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-500/90 mb-3">
          Episode ({episodesWithVideo.length}/{data.episodes.length} punya video)
        </h3>
        {data.episodes.length === 0 ? (
          <EmptyState icon={<Clapperboard size={28} />} title="Belum ada episode" />
        ) : (
          <div className="space-y-2">
            {data.episodes.map((ep) => {
              const v = completed[ep.id];
              return (
                <div key={ep.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                    {String(ep.number).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200 truncate">{ep.title || `Episode ${ep.number}`}</p>
                    <p className="text-[11px] text-zinc-600">{v ? 'video siap' : 'belum dirakit'}</p>
                  </div>
                  {v && (
                    <video src={v.url} className="h-20 rounded-lg border border-white/10" muted playsInline
                      onMouseEnter={(e) => void e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} />
                  )}
                  {v && (
                    <Button variant="ghost" className="!p-1.5"
                      onClick={() => downloadBlob(v.blob, `EP${String(ep.number).padStart(2, '0')}-${project.title}.webm`}>
                      <Download size={14} />
                    </Button>
                  )}
                  <Button variant={v ? 'ghost' : 'subtle'} className="!py-1.5 text-xs"
                    disabled={building !== null}
                    onClick={() => buildEpisode(ep.id)}>
                    {building === ep.id ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                    {v ? 'Rakit Ulang' : 'Rakit dengan Audio'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Master */}
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <h3 className="font-semibold text-zinc-100">Film Master — {project.title}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Semua episode ({episodesWithVideo.length}) digabung berurutan menjadi satu film utuh 9:16.
            </p>
          </div>
          <Button onClick={buildMaster}
            disabled={episodesWithVideo.length === 0 || building !== null}>
            {building === 'master' ? <Loader2 size={14} className="animate-spin" /> : <Clapperboard size={14} />}
            Gabungkan Jadi Film
          </Button>
          {master && (
            <Button variant="subtle" onClick={() => downloadBlob(master.blob, `${project.title || 'film'}-master.webm`}>
              <Download size={14} /> Ekspor Film (.webm)
            </Button>
          )}
        </div>
        {master && (
          <div className="mt-4 rounded-xl overflow-hidden border border-white/10 bg-black max-w-[300px]">
            <video src={master.url} controls className="w-full" style={{ aspectRatio: '9/16' }} />
          </div>
        )}
      </section>

      {!canRecordVideo() && (
        <p className="mt-4 text-xs text-amber-400">Browser ini tidak mendukung perekaman video — gunakan Chrome/Edge terbaru.</p>
      )}
    </div>
  );
}
