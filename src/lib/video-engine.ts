import { renderFrame, FRAME_W, FRAME_H, type RenderContext } from './frame-renderer';

export interface ClipEntry {
  shotId: string;
  blob: Blob;
  url: string;
  duration: number;
}

export interface ClipResult {
  blob: Blob;
  url: string;
  duration: number;
}

function supportedMime(): string {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

export function canRecordVideo(): boolean {
  return supportedMime() !== '' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

// Renders one shot as an animatic clip: camera move + breathing life over the keyframe.
export async function renderShotClip(rc: RenderContext, fps = 30): Promise<ClipResult> {
  const mime = supportedMime();
  if (!mime) throw new Error('Browser ini tidak mendukung perekaman video');

  const duration = Math.min(Math.max(rc.shot.duration, 2), 10);
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia');

  const stream = canvas.captureStream(fps);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });

  recorder.start(100);

  const total = duration * 1000;
  const start = performance.now();
  const move = rc.shot.camera_move.toLowerCase();

  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / total);
      ctx.save();
      let sx = 0, sy = 0, sw = FRAME_W, sh = FRAME_H;
      const ease = 0.5 - Math.cos(t * Math.PI) / 2; // ease in-out
      if (move.includes('push-in')) {
        const z = 1 - 0.12 * ease;
        sw = FRAME_W * z; sh = FRAME_H * z;
        sx = (FRAME_W - sw) / 2; sy = (FRAME_H - sh) / 2;
      } else if (move.includes('pull-out')) {
        const z = 0.88 + 0.12 * ease;
        sw = FRAME_W * z; sh = FRAME_H * z;
        sx = (FRAME_W - sw) / 2; sy = (FRAME_H - sh) / 2;
      } else if (move.includes('pan') || move.includes('truck') || move.includes('dolly')) {
        const dir = move.includes('left') ? -1 : 1;
        sw = FRAME_W * 0.9; sh = FRAME_H;
        sx = dir * (FRAME_W - sw) * ease;
      } else if (move.includes('tilt') || move.includes('pedestal') || move.includes('crane')) {
        sh = FRAME_H * 0.9; sw = FRAME_W;
        sy = (FRAME_H - sh) * (1 - ease);
      } else if (move.includes('handheld')) {
        const j = 6;
        sx = (rand01(t * 9 + 1) - 0.5) * j;
        sy = (rand01(t * 9 + 2) - 0.5) * j;
      } else if (move.includes('zoom')) {
        const z = 1 - 0.08 * ease;
        sw = FRAME_W * z; sh = FRAME_H * z;
        sx = (FRAME_W - sw) / 2; sy = (FRAME_H - sh) / 2;
      }
      // sub-pixel "breath" so nothing is perfectly static
      sy += Math.sin(t * Math.PI * 2) * 1.5;
      ctx.drawImage(canvas, 0, 0);
      // draw frame fresh then transform
      ctx.restore();
      ctx.save();
      ctx.translate(-sx, -sy);
      if (sw !== FRAME_W) {
        ctx.scale(FRAME_W / sw, FRAME_H / sh);
      }
      renderFrame(ctx, rc);
      ctx.restore();
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });

  // hold last frame briefly to avoid a cut-too-early artifact
  await new Promise((r) => setTimeout(r, 120));
  recorder.stop();
  stream.getTracks().forEach((tr) => tr.stop());

  const blob = await done;
  return { blob, url: URL.createObjectURL(blob), duration };
}

function rand01(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Concatenates video clips + audio track(s) into one recording using an offscreen
// playback canvas: clips play in order, audio (backsound + optional voiceover) mixes live.
export async function assembleFilm(options: {
  clips: { blob: Blob }[];
  backsound?: Blob | null;
  voiceover?: Blob | null;
  backsoundVolume?: number;
  voiceVolume?: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<Blob> {
  const { clips, backsound, voiceover, backsoundVolume = 0.4, voiceVolume = 1, onProgress } = options;
  if (!clips.length) throw new Error('Tidak ada klip untuk digabung');
  const mime = supportedMime();
  if (!mime) throw new Error('Browser ini tidak mendukung perekaman video');

  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia');

  const stream = canvas.captureStream(30);

  const ac = new AudioContext();
  const dest = ac.createMediaStreamDestination();
  const gains: GainNode[] = [];
  const els: HTMLMediaElement[] = [];

  const attach = (blob: Blob | null | undefined, vol: number) => {
    if (!blob) return;
    const el = document.createElement('audio');
    el.src = URL.createObjectURL(blob);
    el.loop = true;
    const src = ac.createMediaElementSource(el);
    const g = ac.createGain();
    g.gain.value = vol;
    src.connect(g).connect(dest);
    gains.push(g);
    els.push(el);
  };
  attach(backsound, backsoundVolume);
  attach(voiceover, voiceVolume);
  if (gains.length) {
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    els.forEach((e) => { e.currentTime = 0; void e.play(); });
  }

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });

  recorder.start(250);

  const urls = clips.map((c) => URL.createObjectURL(c.blob));
  for (let i = 0; i < urls.length; i++) {
    onProgress?.(i, urls.length);
    const v = document.createElement('video');
    v.src = urls[i];
    v.muted = true;
    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => reject(new Error('Klip tidak dapat dibaca'));
    });
    await new Promise<void>((resolve) => {
      const step = () => {
        ctx.drawImage(v, 0, 0, FRAME_W, FRAME_H);
        if (!v.ended && !v.paused) requestAnimationFrame(step);
        else resolve();
      };
      v.onended = () => resolve();
      void v.play().then(step).catch(() => resolve());
      // hard timeout per clip
      setTimeout(resolve, 30000);
    });
  }

  onProgress?.(urls.length, urls.length);
  await new Promise((r) => setTimeout(r, 200));
  recorder.stop();
  els.forEach((e) => { e.pause(); URL.revokeObjectURL(e.src); });
  urls.forEach((u) => URL.revokeObjectURL(u));
  void ac.close();

  return done;
}

export async function blobDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      resolve(Number.isFinite(v.duration) ? v.duration : 0);
      URL.revokeObjectURL(v.src);
    };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(blob);
  });
}
