import type {
  Episode, Scene, Shot, Character, Wardrobe, LocationRow, PropRow, Project,
} from './types';
import { compileImagePrompt, compileVideoPrompt } from './prompts';

export const pad = (n: number) => String(n).padStart(2, '0');

export interface Finding {
  level: 'FAIL' | 'WARN';
  message: string;
}

// Continuity QC — per scene, messages keyed by shot label "SHxx:"
export function checkScene(
  scene: Scene,
  shots: Shot[],
  characters: Character[],
  wardrobes: Wardrobe[],
  location: LocationRow | undefined,
): Finding[] {
  const f: Finding[] = [];
  if (!location) f.push({ level: 'FAIL', message: 'Scene: belum terikat lokasi kanonik — model akan mengarang ruangan baru.' });
  if (!scene.time_of_day) f.push({ level: 'WARN', message: 'Scene: time of day belum diisi — arah cahaya bisa berubah antar shot.' });

  for (const sh of shots) {
    const label = `SH${pad(sh.shot_number)}`;
    if (!sh.character_id) {
      f.push({ level: 'WARN', message: `${label}: belum mengikat karakter — identitas tidak terkunci.` });
    } else {
      const c = characters.find((x) => x.id === sh.character_id);
      if (!c) f.push({ level: 'FAIL', message: `${label}: karakter tidak ditemukan di kanon proyek.` });
      if (sh.wardrobe_id) {
        const w = wardrobes.find((x) => x.id === sh.wardrobe_id);
        if (!w) f.push({ level: 'FAIL', message: `${label}: kostum tidak ditemukan di kanon.` });
        else if (w.character_id !== sh.character_id) {
          f.push({ level: 'FAIL', message: `${label}: kostum "${w.name}" bukan milik karakter yang diikat.` });
        }
      } else {
        f.push({ level: 'WARN', message: `${label}: kostum belum dikunci — risiko wardrobe drift.` });
      }
    }
    if (!sh.action) f.push({ level: 'FAIL', message: `${label}: aksi kosong — shot tanpa informasi baru sebaiknya dihapus.` });
    if (sh.dialogue && !sh.character_id) f.push({ level: 'FAIL', message: `${label}: ada dialog tapi tanpa karakter pembicara.` });
    if (sh.duration > 8) f.push({ level: 'WARN', message: `${label}: durasi ${sh.duration}s melebihi batas klip 8 detik — pecah jadi dua shot.` });
    if (!sh.lighting) f.push({ level: 'WARN', message: `${label}: lighting belum dimotivasi.` });
    if (!sh.blocking && shots.length > 1) f.push({ level: 'WARN', message: `${label}: blocking kosong — risiko screen direction / axis flip.` });
  }
  return f;
}

// Auto Coverage — standard dialogue-scene coverage, blueprint section 39
export interface CoverageShot {
  shot_size: string;
  camera_angle: string;
  lens_mm: number;
  camera_move: string;
  character_id: string | null;
  action: string;
  performance: string;
  duration: number;
  blocking: string;
}

export function buildCoverage(scene: Scene, chars: Character[], props: PropRow[]): CoverageShot[] {
  const obj = scene.objective || 'perjelas tujuan scene ini di beat sheet';
  const [a, b] = chars;
  const sideA = a ? `${a.canonical_name} screen-left` : '';
  const sideB = b ? `${b.canonical_name} screen-right` : '';
  const prop = props[0];

  const list: CoverageShot[] = [];

  list.push({
    shot_size: b ? 'Two-Shot' : 'WS', camera_angle: 'eye level', lens_mm: 35,
    camera_move: 'locked-off', character_id: null,
    action: `Establishing: ${obj}`,
    performance: 'netral, untuk geografi ruang',
    duration: 3, blocking: [sideA, sideB].filter(Boolean).join('; ') || 'posisi karakter dalam ruang',
  });

  if (a) list.push({
    shot_size: 'MCU', camera_angle: 'eye level', lens_mm: 50, camera_move: 'slow push-in',
    character_id: a.id, action: `Clean single ${a.canonical_name}: ${obj}`,
    performance: 'emosi dasar karakter', duration: 4,
    blocking: `${a.canonical_name} screen-left, menghadap kanan`,
  });

  if (b) list.push({
    shot_size: 'MCU', camera_angle: 'eye level', lens_mm: 50, camera_move: 'locked-off',
    character_id: b.id, action: `Clean single ${b.canonical_name}: reaksi/balasan`,
    performance: 'subtext, menahan informasi', duration: 4,
    blocking: `${b.canonical_name} screen-right, menghadap kiri`,
  });

  if (a && b) {
    list.push({
      shot_size: 'OTS', camera_angle: 'eye level', lens_mm: 50, camera_move: 'locked-off',
      character_id: b.id, action: `OTS dari belakang ${a.canonical_name} ke arah ${b.canonical_name}`,
      performance: 'ketegangan antar posisi', duration: 5,
      blocking: `kamera di belakang bahu ${a.canonical_name}, axis ${a.canonical_name}-ke-${b.canonical_name}`,
    });
    list.push({
      shot_size: 'OTS', camera_angle: 'eye level', lens_mm: 50, camera_move: 'locked-off',
      character_id: a.id, action: `OTS dari belakang ${b.canonical_name} ke arah ${a.canonical_name}`,
      performance: 'reaksi balik', duration: 5,
      blocking: `kamera di belakang bahu ${b.canonical_name}, axis sama`,
    });
  }

  if (a) list.push({
    shot_size: 'CU', camera_angle: 'eye level', lens_mm: 85, camera_move: 'locked-off',
    character_id: a.id, action: `Reaksi emosional ${a.canonical_name} pada puncak beat`,
    performance: 'ekspresi berubah — emotional tell karakter', duration: 3,
    blocking: `${a.canonical_name} screen-left, eyeline konsisten`,
  });

  if (b) list.push({
    shot_size: 'CU', camera_angle: 'eye level', lens_mm: 85, camera_move: 'locked-off',
    character_id: b.id, action: `Reaksi emosional ${b.canonical_name}`,
    performance: 'subtext terlihat di wajah', duration: 3,
    blocking: `${b.canonical_name} screen-right, eyeline konsisten`,
  });

  if (prop) list.push({
    shot_size: 'Insert', camera_angle: 'high angle', lens_mm: 100, camera_move: 'locked-off',
    character_id: a?.id ?? null,
    action: `Insert properti kunci: ${prop.name}${prop.state ? ` (state: ${prop.state})` : ''}`,
    performance: '—', duration: 2, blocking: 'tangan pemilik properti masuk frame',
  });

  list.push({
    shot_size: 'WS', camera_angle: 'eye level', lens_mm: 28, camera_move: 'pull-out',
    character_id: null,
    action: `Transisi keluar scene — ${scene.exit_state || 'arah ke scene berikutnya'}`,
    performance: '—', duration: 3, blocking: 'geografi ruang, pintu/arah keluar terlihat',
  });

  return list;
}

// Export manifest — blueprint section 53
export function buildManifest(
  project: Project,
  data: {
    characters: Character[]; wardrobes: Wardrobe[]; locations: LocationRow[];
    props: PropRow[]; episodes: Episode[]; scenes: Scene[]; shots: Shot[];
  },
): object {
  return {
    project: {
      title: project.title, language: project.language, genre: project.genre,
      audience: project.audience, tone: project.tone, logline: project.logline,
      series_promise: project.series_promise, premise: project.premise,
      visual_style: project.visual_style, aspect_ratio: '9:16',
      target_episode_seconds: project.episode_seconds,
      image_model: project.image_model, video_model: project.video_model,
    },
    canon: {
      characters: data.characters,
      locations: data.locations,
      props: data.props,
      wardrobes: data.wardrobes,
    },
    episodes: data.episodes.map((ep) => ({
      episode_id: `EP${pad(ep.number)}`,
      number: ep.number,
      title: ep.title,
      status: ep.status,
      beats: {
        hook: ep.hook, context: ep.context, conflict: ep.conflict,
        escalation: ep.escalation, reversal: ep.reversal, consequence: ep.consequence,
        cliffhanger: ep.cliffhanger, cliffhanger_visual: ep.cliffhanger_visual,
      },
      scenes: data.scenes
        .filter((sc) => sc.episode_id === ep.id)
        .sort((x, y) => x.scene_number - y.scene_number)
        .map((sc) => {
          const location = data.locations.find((l) => l.id === sc.location_id);
          return {
            scene_id: `SC${pad(sc.scene_number)}`,
            location: location?.name ?? null,
            time_of_day: sc.time_of_day,
            objective: sc.objective,
            entry_state: sc.entry_state,
            exit_state: sc.exit_state,
            shots: data.shots
              .filter((sh) => sh.scene_id === sc.id)
              .sort((x, y) => x.shot_number - y.shot_number)
              .map((sh) => {
                const ctx = {
                  project, episodeNumber: ep.number,
                  characters: data.characters, wardrobes: data.wardrobes,
                  locations: data.locations, props: data.props,
                  scene: sc, shot: sh,
                };
                const character = data.characters.find((c) => c.id === sh.character_id);
                return {
                  shot_id: `SH${pad(sh.shot_number)}`,
                  duration: sh.duration,
                  shot_size: sh.shot_size,
                  lens_mm: sh.lens_mm,
                  camera_angle: sh.camera_angle,
                  camera_move: sh.camera_move,
                  character: character?.canonical_name ?? null,
                  wardrobe: data.wardrobes.find((w) => w.id === sh.wardrobe_id)?.name ?? null,
                  action: sh.action,
                  dialogue: sh.dialogue,
                  performance: sh.performance,
                  lighting: sh.lighting,
                  blocking: sh.blocking,
                  qc_status: sh.qc_status,
                  image_prompt: compileImagePrompt(ctx),
                  video_prompt: compileVideoPrompt(ctx),
                };
              }),
          };
        }),
    })),
  };
}

export function downloadManifest(manifest: object, title: string): void {
  const safe = (title || 'series').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}-manifest.json`;
  a.click();
  URL.revokeObjectURL(url);
}
