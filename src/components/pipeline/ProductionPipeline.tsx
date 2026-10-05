import { useState } from 'react';
import type { Project, StudioData, Episode } from '@/lib/types';
import type { ClipEntry } from '@/lib/video-engine';
import KeyframeStudio from './KeyframeStudio';
import ClipStudio from './ClipStudio';
import EpisodeAssembler from './EpisodeAssembler';
import FilmFinal from './FilmFinal';

interface Props {
  project: Project;
  data: StudioData;
  refresh: () => Promise<void>;
}

type Step = 0 | 1 | 2 | 3;

const STEPS = [
  { label: 'Gambar', hint: 'keyframe per shot' },
  { label: 'Video', hint: 'klip animatic' },
  { label: 'Episode', hint: 'rakit klip' },
  { label: 'Film Final', hint: 'audio + ekspor' },
];

interface EpisodeVideo {
  episodeId: string;
  blob: Blob;
  url: string;
}

export default function ProductionPipeline({ project, data, refresh }: Props) {
  const [step, setStep] = useState<Step>(0);
  const [pipelineEpisode, setPipelineEpisode] = useState<string | null>(null);
  const [clips, setClips] = useState<Record<string, ClipEntry>>({});
  const [episodeVideos, setEpisodeVideos] = useState<Record<string, EpisodeVideo>>({});

  const gotoEpisode = (ep: Episode, nextStep: Step) => {
    setPipelineEpisode(ep.id);
    setStep(nextStep);
  };

  const handleClipRendered = (shotId: string, entry: ClipEntry) => {
    setClips((prev) => {
      const old = prev[shotId];
      if (old) URL.revokeObjectURL(old.url);
      return { ...prev, [shotId]: entry };
    });
  };

  const handleEpisodeReady = (episodeId: string, blob: Blob) => {
    setEpisodeVideos((prev) => {
      const old = prev[episodeId];
      if (old) URL.revokeObjectURL(old.url);
      return { ...prev, [episodeId]: { episodeId, blob, url: URL.createObjectURL(blob) } };
    });
  };

  return (
    <div>
      <div className="flex items-center gap-1 mb-6 overflow-x-auto">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center shrink-0">
            <button
              onClick={() => setStep(i as Step)}
              className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-sm transition-all border ${
                step === i
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400 font-semibold'
                  : 'border-white/10 text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                step === i ? 'bg-amber-500 text-zinc-950' : 'bg-white/10 text-zinc-400'
              }`}>
                {i + 1}
              </span>
              <span className="flex flex-col items-start leading-none">
                {s.label}
                <span className="text-[9px] text-zinc-600 mt-0.5">{s.hint}</span>
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-6 ${i < step ? 'bg-amber-500/60' : 'bg-white/10'}`} />
            )}
          </div>
        ))}
      </div>

      {step === 0 && (
        <KeyframeStudio project={project} data={data} refresh={refresh}
          onNext={(ep) => gotoEpisode(ep, 1)} />
      )}
      {step === 1 && (
        <ClipStudio project={project} data={data}
          initialEpisodeId={pipelineEpisode}
          clips={clips}
          onClipRendered={handleClipRendered}
          onNext={(ep) => gotoEpisode(ep, 2)} />
      )}
      {step === 2 && (
        <EpisodeAssembler data={data}
          initialEpisodeId={pipelineEpisode}
          clips={clips}
          onEpisodeReady={handleEpisodeReady}
          onNext={(ep) => gotoEpisode(ep, 3)} />
      )}
      {step === 3 && (
        <FilmFinal project={project} data={data}
          completed={episodeVideos}
          onEpisodeReady={handleEpisodeReady} />
      )}
    </div>
  );
}
