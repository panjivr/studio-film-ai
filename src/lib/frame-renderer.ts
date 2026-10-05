import type { Project, Shot, Character, Scene, LocationRow, KeyframeParams } from './types';

export interface RenderContext {
  shot: Shot;
  scene: Scene;
  character?: Character;
  location?: LocationRow;
  project: Project;
  seed: number;
  params: KeyframeParams;
}

export const FRAME_W = 540;
export const FRAME_H = 960;

function rand(seed: number, n: number): number {
  const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const SCALE: Record<string, number> = {
  ECU: 1.0, CU: 0.72, MCU: 0.52, MS: 0.4, MLS: 0.32, FS: 0.24,
  WS: 0.16, EWS: 0.1, OTS: 0.5, POV: 0, Insert: 0,
  'Two-Shot': 0.34, 'Group Shot': 0.22,
};

function timeOfDay(scene: Scene): 'pagi' | 'siang' | 'senja' | 'malam' {
  const t = (scene.time_of_day || '').toLowerCase();
  if (t.includes('pagi')) return 'pagi';
  if (t.includes('siang')) return 'siang';
  if (t.includes('senja') || t.includes('sore')) return 'senja';
  return 'malam';
}

function palette(td: string, intensity: number) {
  const base: Record<string, { sky: [string, string]; key: string; amb: string; floor: string }> = {
    malam: { sky: ['#0b1026', '#232c52'], key: '#aebfe8', amb: '#131a33', floor: '#0a0d1c' },
    senja: { sky: ['#2b1a2e', '#96522e'], key: '#f0b07a', amb: '#3a2438', floor: '#1c1220' },
    pagi: { sky: ['#26304a', '#cf9260'], key: '#f5d9a8', amb: '#2c3350', floor: '#1a1e30' },
    siang: { sky: ['#3a4356', '#95a0b2'], key: '#e8e2d4', amb: '#3d4558', floor: '#262b38' },
  };
  const p = base[td] ?? base.malam;
  const mix = (hex: string, k: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const f = (v: number) => Math.round(Math.min(255, Math.max(0, v * (0.5 + k * 0.7))));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  };
  return {
    sky0: mix(p.sky[0], intensity), sky1: mix(p.sky[1], intensity),
    key: p.key, amb: p.amb, floor: p.floor,
  };
}

function skinOf(c?: Character): string {
  const s = (c?.identity.skin_tone || '').toLowerCase();
  if (s.includes('dark') || s.includes('deep')) return '#8a5c40';
  if (s.includes('tan') || s.includes('medium')) return '#b9845e';
  if (s.includes('pale') || s.includes('fair') || s.includes('light')) return '#e2b592';
  return '#c99772';
}

function hairOf(c?: Character): string {
  const h = (c?.identity.hair || '').toLowerCase();
  if (h.includes('blonde') || h.includes('blond')) return '#a8834a';
  if (h.includes('brown')) return '#4a3423';
  if (h.includes('grey') || h.includes('gray') || h.includes('silver')) return '#9a9aa2';
  return '#15151a';
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number,
  c: Character | undefined, seed: number, params: KeyframeParams,
) {
  if (scale <= 0) return;
  const r = Math.max(14, 150 * scale * 0.42);
  const skin = skinOf(c);
  const hair = hairOf(c);

  // shoulders / body
  const bodyTop = cy + r * 1.15;
  const bodyW = r * 3.4;
  ctx.fillStyle = (c?.role || '').includes('antagonist') ? '#23262e' : '#2d313c';
  ctx.beginPath();
  ctx.moveTo(cx - bodyW / 2, bodyTop + r * 3.2);
  ctx.quadraticCurveTo(cx - bodyW / 2.4, bodyTop, cx, bodyTop - r * 0.1);
  ctx.quadraticCurveTo(cx + bodyW / 2.4, bodyTop, cx + bodyW / 2, bodyTop + r * 3.2);
  ctx.closePath();
  ctx.fill();

  // neck
  ctx.fillStyle = skin;
  ctx.fillRect(cx - r * 0.32, cy + r * 0.55, r * 0.64, r * 0.8);

  // face
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.82, r, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();

  // hair — respects identity roughly
  ctx.beginPath();
  if (r > 30) {
    ctx.ellipse(cx, cy - r * 0.35, r * 0.9, r * 0.75, 0, Math.PI, Math.PI * 2);
    ctx.moveTo(cx - r * 0.9, cy - r * 0.3);
    ctx.lineTo(cx - r * 0.95, cy - r * 0.05);
    ctx.lineTo(cx + r * 0.95, cy - r * 0.05);
    ctx.lineTo(cx + r * 0.9, cy - r * 0.3);
  } else {
    ctx.ellipse(cx, cy - r * 0.3, r * 0.88, r * 0.6, 0, Math.PI, Math.PI * 2);
  }
  ctx.fillStyle = hair;
  ctx.fill();

  if (r < 26) return; // too small for a face

  const expr = (params.expression || 'neutral').toLowerCase();
  const eyeY = cy - r * 0.08;
  const eyeDX = r * 0.34;
  const eyeR = r * 0.09;

  // eyes
  ctx.fillStyle = '#1a1a1f';
  const open = expr === 'shocked' ? 1.5 : 1;
  for (const dx of [-eyeDX, eyeDX]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx, eyeY, eyeR, eyeR * open, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // brows
  ctx.strokeStyle = hair;
  ctx.lineWidth = Math.max(1.2, r * 0.05);
  const browLift = expr === 'shocked' || expr === 'afraid' ? -r * 0.1 : 0;
  const browAngle = expr === 'angry' ? 0.35 : expr === 'sad' ? -0.3 : 0;
  for (const [dx, dir] of [[-eyeDX, 1], [eyeDX, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + dx - r * 0.16, eyeY - r * 0.22 + browLift + browAngle * dir * r * 0.12);
    ctx.lineTo(cx + dx + r * 0.16, eyeY - r * 0.26 + browLift - browAngle * dir * r * 0.12);
    ctx.stroke();
  }
  // mouth
  ctx.lineWidth = Math.max(1.4, r * 0.055);
  ctx.strokeStyle = '#5a3c34';
  const my = cy + r * 0.45;
  ctx.beginPath();
  if (expr === 'sad') {
    ctx.moveTo(cx - r * 0.2, my + r * 0.08);
    ctx.quadraticCurveTo(cx, my - r * 0.1, cx + r * 0.2, my + r * 0.08);
  } else if (expr === 'shocked') {
    ctx.ellipse(cx, my, r * 0.1, r * 0.16, 0, 0, Math.PI * 2);
  } else if (expr === 'angry') {
    ctx.moveTo(cx - r * 0.2, my + r * 0.04);
    ctx.quadraticCurveTo(cx, my - r * 0.14, cx + r * 0.2, my + r * 0.04);
  } else if (expr === 'smile') {
    ctx.moveTo(cx - r * 0.2, my - r * 0.02);
    ctx.quadraticCurveTo(cx, my + r * 0.14, cx + r * 0.2, my - r * 0.02);
  } else {
    ctx.moveTo(cx - r * 0.16, my);
    ctx.lineTo(cx + r * 0.16, my);
  }
  ctx.stroke();

  // beauty mark / features
  if ((c?.identity.features || '').toLowerCase().includes('beauty mark')) {
    ctx.fillStyle = 'rgba(40,25,20,0.75)';
    ctx.beginPath();
    ctx.arc(cx - eyeDX - r * 0.12, eyeY + r * 0.24, Math.max(0.8, r * 0.025), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnvironment(ctx: CanvasRenderingContext2D, rc: RenderContext) {
  const { location, scene, project, params, seed } = rc;
  const td = timeOfDay(scene);
  const pal = palette(td, params.intensity);
  const W = FRAME_W, H = FRAME_H;

  const bg = ctx.createLinearGradient(0, 0, W * 0.6, H);
  bg.addColorStop(0, pal.sky0);
  bg.addColorStop(1, pal.sky1);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // floor hint
  const fy = H * 0.72;
  const fl = ctx.createLinearGradient(0, fy, 0, H);
  fl.addColorStop(0, pal.floor);
  fl.addColorStop(1, '#05060a');
  ctx.fillStyle = fl;
  ctx.fillRect(0, fy, W, H - fy);

  if (location) {
    const layout = (location.layout + ' ' + location.hero_objects).toLowerCase();
    // window light source
    if (layout.includes('window') || layout.includes('jendela')) {
      ctx.fillStyle = pal.key;
      ctx.globalAlpha = 0.08 + params.intensity * 0.12;
      const wx = params.light_side === 'right' ? W * 0.55 : W * 0.1;
      ctx.fillRect(wx, H * 0.12, W * 0.35, H * 0.4);
      ctx.globalAlpha = 1;
    }
    // desk hero object
    if (layout.includes('desk') || layout.includes('meja')) {
      ctx.fillStyle = 'rgba(20,14,10,0.85)';
      ctx.fillRect(params.light_side === 'right' ? W * 0.58 : W * 0.06, fy - 30, W * 0.36, 26);
      ctx.fillStyle = 'rgba(240,190,120,0.9)';
      ctx.beginPath();
      ctx.arc(params.light_side === 'right' ? W * 0.66 : W * 0.14, fy - 44, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(params.light_side === 'right' ? W * 0.66 : W * 0.14, fy - 44, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // sofa
    if (layout.includes('sofa')) {
      ctx.fillStyle = 'rgba(30,26,34,0.9)';
      const sx = params.light_side === 'right' ? W * 0.08 : W * 0.62;
      ctx.fillRect(sx, fy - 60, W * 0.3, 70);
      ctx.fillRect(sx, fy - 80, W * 0.3, 24);
    }
  } else {
    // abstract depth blocks
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + rand(seed, i) * 0.03})`;
      ctx.fillRect(rand(seed, i + 9) * W * 0.8, H * (0.15 + i * 0.12), W * 0.2, H * 0.16);
    }
  }

  void project;
}

export function renderFrame(ctx: CanvasRenderingContext2D, rc: RenderContext): void {
  const { shot, character, params, seed, scene } = rc;
  const W = FRAME_W, H = FRAME_H;

  ctx.clearRect(0, 0, W, H);
  drawEnvironment(ctx, rc);

  const scale = SCALE[shot.shot_size] ?? 0.4;
  const side = (shot.blocking || '').toLowerCase().includes('right') ? 1 : 0;
  const jx = (rand(seed, 1) - 0.5) * 40;
  const cx = W * (0.5 + (side ? 0.12 : -0.12)) + jx;
  const cy = H * 0.46 + scale * 40 + (rand(seed, 2) - 0.5) * 20;

  drawCharacter(ctx, cx, cy, scale, character, seed, params);

  // second silhouette for two-shot
  if (shot.shot_size === 'Two-Shot' || shot.shot_size === 'Group Shot') {
    drawCharacter(ctx, cx + W * 0.3, cy - 20, scale * 0.9, undefined, seed + 7, params);
  }

  // key light wash from edited side
  const key = ctx.createRadialGradient(
    params.light_side === 'right' ? W * 0.85 : W * 0.15, H * 0.1, 20,
    params.light_side === 'right' ? W * 0.85 : W * 0.15, H * 0.1, H * 0.7,
  );
  const pal = palette(timeOfDay(scene), params.intensity);
  key.addColorStop(0, pal.key + '55');
  key.addColorStop(1, 'transparent');
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, W, H);

  // vignette
  const vig = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.45, H * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // letterbox-free subtitle safe area guides off; slate text
  ctx.font = '600 15px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(
    `SH${String(shot.shot_number).padStart(2, '0')} · ${shot.shot_size} · ${shot.lens_mm}mm`,
    18, H - 26,
  );
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.font = '400 12px ui-monospace, monospace';
  ctx.fillText(scene.time_of_day || '—', 18, H - 46);
}

export async function renderFrameToBlob(rc: RenderContext): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia di browser ini');
  renderFrame(ctx, rc);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Gagal membuat gambar'))),
      'image/jpeg', 0.92,
    );
  });
}

export async function downloadFrame(rc: RenderContext, filename: string): Promise<void> {
  const blob = await renderFrameToBlob(rc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
