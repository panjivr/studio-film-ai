import type { CanvasNode } from './canvas-db';
import type { StudioData } from './types';

export type AITask = 'idea' | 'beat' | 'dialogue' | 'prompt';

export interface AITaskConfig {
  task: AITask;
  topic: string;
  genre: string;
  tone: string;
}

const HOOK_TYPES = [
  'akusasi', 'penemuan mustahil', 'penghinaan publik', 'bahaya mendekat',
  'rahasia terbuka sebagian', 'kedatangan tak terduga', 'percapahan hubungan',
  'pembalikan status', 'jam berdetak', 'anomali visual',
];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function cleanTopic(topic: string): string {
  return topic.trim() || 'rahasia keluarga yang disembunyikan';
}

export function runAITask(config: AITaskConfig, data: StudioData): string {
  const topic = cleanTopic(config.topic);
  const seed = hash(topic + config.task + config.genre + config.tone);
  const charNames = data.characters.map((c) => c.canonical_name);
  const A = charNames[0] ?? 'Maya';
  const B = charNames[1] ?? 'Daniel';
  const prop = data.props[0]?.name ?? 'amplop merah';
  const loc = data.locations[0]?.name ?? 'kantor eksekutif';

  switch (config.task) {
    case 'idea': {
      const hook = pick(HOOK_TYPES, seed);
      const lines = [
        `KONSEP SERIAL — "${topic.charAt(0).toUpperCase() + topic.slice(1)}"`,
        '',
        `Genre: ${config.genre || 'melodrama, hidden identity'}`,
        `Tone: ${config.tone || 'premium contemporary Asian melodrama'}`,
        `Format: 9:16 vertical micro-drama, 60 episode x 60 detik`,
        '',
        `LOGLINE:`,
        `Ketika ${A} menemukan ${topic}, ia harus memilih antara kebenaran yang akan menghancurkan keluarganya atau dusta yang akan menghancurkan dirinya.`,
        '',
        `HOOK UTAMA (${hook}):`,
        `Episode 1 dibuka dengan ${B} membakar foto keluarga — sementara ${prop} yang dicari ${A} ada di mejanya.`,
        '',
        `SERIES PROMISE:`,
        `Setiap episode membuka satu rahasia baru dan menutup satu pertanyaan lebih besar. Penonton selalu tahu lebih banyak dari ${A}, tapi tidak pernah semuanya.`,
        '',
        `REVEAL LADDER:`,
        `EP 1-5: dunia + hinaan + insiden pemicu`,
        `EP 6-15: kemenangan palsu`,
        `EP 16-30: antagonis menguasai bukti; midpoint revelation`,
        `EP 31-45: pengkhianatan + kebenaran mulai tersusun`,
        `EP 46-59: serangan balik + identitas terbongkar`,
        `EP 60: penutup emosional + hook musim berikutnya`,
      ];
      return lines.join('\n');
    }
    case 'beat': {
      const hook = pick(HOOK_TYPES, seed + 1);
      return [
        `BEAT SHEET EPISODE — ${topic}`,
        '',
        `HOOK (00-03s): ${hook} — ${B} terlihat memegang ${prop} yang seharusnya tidak ada di sana.`,
        `CONTEXT (03-10s): ${A} menyadari ${prop} itu, rutenya ke pintu keluar terhalang.`,
        `CONFLICT (10-22s): ${A} menuntut ${prop} dikembalikan. ${B} menolak dengan senyum.`,
        `ESCALATION (22-36s): ${A} merebutnya. ${B} tidak melawan — justru mengucapkan sesuatu yang membuat ${A} membeku.`,
        `REVERSAL (36-48s): "${A} kamu tidak siap membacanya. Nama di dalamnya bukan yang kamu kira."`,
        `CONSEQUENCE (48-56s): ${A} membuka segel. Tangannya gemetar.`,
        `CLIFFHANGER (56-60s): Listrik mati. Siluet seseorang berdiri di pintu. SUARA: "Jangan dibaca." CUT.`,
        '',
        `VISUAL FINAL: ECU mata ${A} membesar dalam gelap, pantulan siluet di kaca jendela.`,
        `INFORMATION GAP: siapa orang di pintu, dan apa isi nama di ${prop}?`,
      ].join('\n');
    }
    case 'dialogue': {
      return [
        `DIALOG — ${loc}`,
        '',
        `${A.toUpperCase()}`,
        `Kembalikan.`,
        '',
        `${B.toUpperCase()}`,
        `Kalau kamu tahu isinya, kamu nggak akan minta.`,
        '',
        `${A.toUpperCase()}`,
        `Itu punyaku.`,
        '',
        `${B.toUpperCase()}`,
        `Bukti nggak peduli siapa pemiliknya. Yang peduli cuma siapa yang berani membacanya.`,
        '',
        `— ${A} meraih ${prop}. ${B} tidak mencegah. Justru melangkah mundur, seperti orang yang sudah menang.`,
        '',
        `${B.toUpperCase()} (sebelum ${A} keluar)`,
        `Nama di situ bukan ayahmu.`,
        '',
        `CATATAN SUBTEKS: ${B} sebenarnya ingin ${A} membacanya — ia hanya memastikan ${A} membacanya di tempat yang salah.`,
      ].join('\n');
    }
    case 'prompt': {
      const c = data.characters.find((ch) => ch.canonical_name === A) ?? data.characters[0];
      const identity = c
        ? `${c.canonical_name}, ${c.gender || 'character'}${c.age ? `, ${c.age}` : ''}${c.identity.hair ? `, hair ${c.identity.hair}` : ''}${c.identity.features ? `, ${c.identity.features}` : ''}`
        : A;
      return [
        `PRODUCTION STILL — VERTICAL 9:16`,
        '',
        `SHOT: MCU, eye level, 50mm (natural dialogue rendering).`,
        '',
        `SUBJECT: ${identity}.`,
        `Wardrobe: kostum kanonik terkunci dari Character Bible.`,
        '',
        `BLOCKING: ${A} screen-left menghadap kanan, memegang ${prop} dengan tangan kanan.`,
        `ACTION: membuka segel ${prop}; tangan gemetar.`,
        `PERFORMANCE: dari marah bergeser ke takut; rahang mengeras, napas tertahan.`,
        '',
        `ENVIRONMENT: ${loc} — pertahankan geometri dan hero objects sesuai Location Master. Jangan mendesain ulang ruangan.`,
        '',
        `LIGHTING: soft window key dari kiri, fill netral rendah, rim hangat dari practical 3200K, kontras medium-high dengan warna kulit natural.`,
        '',
        `COLOR: bayangan netral-dingin, kulit hangat natural, saturasi restrained, subtle film grain.`,
        '',
        `CONTINUITY LOCK: wajah, proporsi, rambut, usia, kostum, aksesori dan cedera yang sudah ada harus sama dengan reference kanonik. Pertahankan state prop dan layout spasial dari shot sebelumnya.`,
        '',
        `DO NOT: change identity, hairstyle, wardrobe, room architecture, hero props, time of day, screen direction. No extra fingers, duplicated people, malformed hands, text artifacts, random jewelry, random logos, subtitles baked into image.`,
      ].join('\n');
    }
  }
}

export interface QCResult {
  status: 'pass' | 'warn' | 'fail';
  notes: string[];
  score: number;
}

export function runContinuityQC(
  shot: { id: string; character_id: string | null; wardrobe_id: string | null; duration: number; shot_size: string; lens_mm: number; action: string; blocking: string; notes: string },
  data: StudioData,
): QCResult {
  const notes: string[] = [];
  let score = 100;

  if (!shot.character_id) {
    notes.push('WARN: tidak ada karakter terikat — identitas tidak terkunci ke reference pack.');
    score -= 15;
  }
  if (!shot.wardrobe_id) {
    notes.push('WARN: kostum belum dikunci — risiko wardrobe drift antar shot.');
    score -= 10;
  }
  if (!shot.action.trim()) {
    notes.push('FAIL: aksi kosong — video model akan mengarang gerakan sendiri.');
    score -= 25;
  }
  if (!shot.blocking.trim()) {
    notes.push('WARN: blocking kosong — screen direction bisa berbalik antar shot.');
    score -= 10;
  }
  if (shot.duration > 8) {
    notes.push('WARN: durasi > 8 detik — pecah menjadi dua shot agar mudah diretake.');
    score -= 10;
  }
  if (shot.notes.includes('new') || shot.notes.includes('ganti')) {
    notes.push('WARN: catatan kontinuitas menyebut perubahan — pastikan termotivasi narasi.');
    score -= 5;
  }

  const parentScene = data.scenes.find((s) => s.id);
  if (parentScene && !parentScene.exit_state.trim()) {
    notes.push('WARN: scene tanpa exit state — shot berikutnya tidak punya state awal yang jelas.');
    score -= 10;
  }

  if (score >= 90) return { status: 'pass', notes: notes.length ? notes : ['PASS: semua pemeriksaan kontinuitas lolos.'], score };
  if (score >= 70) return { status: 'warn', notes, score };
  return { status: 'fail', notes, score };
}
