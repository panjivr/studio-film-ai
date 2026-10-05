import { useMemo } from 'react';
import type { Project, Shot, Character } from '@/lib/types';

interface Props {
  shot?: Shot;
  character?: Character;
  project: Project;
  seed: number;
  className?: string;
}

const SIZE_SCALE: Record<string, number> = {
  ECU: 95, CU: 60, MCU: 44, MS: 30, MLS: 24, FS: 18,
  WS: 12, EWS: 8, OTS: 40, POV: 0, Insert: 0,
  'Two-Shot': 26, 'Group Shot': 18,
};

function timePalette(time: string, project: Project): { from: string; to: string; key: string } {
  const t = (time || '').toLowerCase();
  if (t.includes('malam')) return { from: '#0b1026', to: '#1c2547', key: '#aebfe8' };
  if (t.includes('senja') || t.includes('sore')) return { from: '#2b1a2e', to: '#8a4a2c', key: '#f0b07a' };
  if (t.includes('pagi')) return { from: '#26304a', to: '#c98d5e', key: '#f5d9a8' };
  if (t.includes('siang')) return { from: '#3a4356', to: '#8d97a8', key: '#e8e2d4' };
  const c = project.visual_style.color || '';
  if (c.includes('cool')) return { from: '#111827', to: '#334155', key: '#cbd5e1' };
  return { from: '#1a1d26', to: '#3d3428', key: '#e8c9a0' };
}

export default function FramePreview({ shot, character, project, seed, className }: Props) {
  const v = useMemo(() => {
    const rand = (n: number) => Math.abs(Math.sin(seed * 97.13 + n * 31.7)) % 1;
    const scene = seed % 2 === 0;
    const scale = SIZE_SCALE[shot?.shot_size ?? 'MCU'] ?? 40;
    const light = timePalette(scene ? 'malam' : 'siang', project);
    const lighting = (shot?.lighting || project.visual_style.lighting || '').toLowerCase();
    const keyFrom =
      lighting.includes('kanan') ? 'right' :
      lighting.includes('kiri') ? 'left' : 'topleft';
    const hairColor = (character?.identity.hair || '').includes('black') ? '#15151a' : '#2b2320';
    const skin = (character?.identity.skin_tone || '').includes('dark') ? '#8a5c40' : '#c99772';
    return { rand, scale, light, keyFrom, hairColor, skin };
  }, [seed, shot, character, project]);

  const cx = 45 + (v.rand(1) - 0.5) * 8;
  const cy = 52 + (v.rand(2) - 0.5) * 6;
  const r = Math.max(4, v.scale * 0.36);

  return (
    <svg viewBox="0 0 90 160" preserveAspectRatio="xMidYMid slice" className={className}>
      <defs>
        <linearGradient id={`bg-${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={v.light.from} />
          <stop offset="100%" stopColor={v.light.to} />
        </linearGradient>
        <radialGradient id={`vig-${seed}`} cx="0.5" cy="0.45" r="0.75">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
        <radialGradient id={`key-${seed}`} cx={v.keyFrom === 'right' ? '0.85' : v.keyFrom === 'left' ? '0.15' : '0.2'} cy="0.15" r="0.6">
          <stop offset="0%" stopColor={v.light.key} stopOpacity="0.5" />
          <stop offset="100%" stopColor={v.light.key} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="90" height="160" fill={`url(#bg-${seed})`} />
      <rect width="90" height="160" fill={`url(#key-${seed})`} />

      {v.scale > 0 && (
        <g>
          <circle cx={cx} cy={cy} r={r} fill={v.skin} opacity="0.92" />
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r * 1.05} 0 0 1 ${cx + r} ${cy} L ${cx + r * 0.92} ${cy - r * 0.55} A ${r * 1.05} ${r * 0.9} 0 0 0 ${cx - r * 0.92} ${cy - r * 0.55} Z`}
            fill={v.hairColor}
            opacity="0.95"
          />
          <path
            d={`M ${cx - r * 2.4} ${cy + r * 4.6} L ${cx - r * 1.5} ${cy + r * 1.35} Q ${cx} ${cy + r * 0.7} ${cx + r * 1.5} ${cy + r * 1.35} L ${cx + r * 2.4} ${cy + r * 4.6} Z`}
            fill={v.skin}
            opacity="0.85"
          />
        </g>
      )}

      {v.scale === 0 && (
        <rect x={34 + v.rand(3) * 8} y={92} width={20} height={26} rx={2}
          fill="#7a1f24" stroke="#a83236" strokeWidth="0.5" opacity="0.9" transform={`rotate(${-8 + v.rand(4) * 16} 45 105)`} />
      )}

      <rect width="90" height="160" fill={`url(#vig-${seed})`} />
      <line x1="30" y1="0" x2="30" y2="160" stroke="#fff" strokeOpacity="0.05" strokeWidth="0.3" />
      <line x1="60" y1="0" x2="60" y2="160" stroke="#fff" strokeOpacity="0.05" strokeWidth="0.3" />
      <text x="5" y="153" fontSize="4.5" fill="#fff" fillOpacity="0.55" fontFamily="monospace">
        {shot ? `SH ${shot.shot_size} ${shot.lens_mm}mm` : '9:16'}
      </text>
    </svg>
  );
}
