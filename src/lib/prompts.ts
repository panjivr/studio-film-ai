import type {
  Project, Character, Wardrobe, LocationRow, PropRow, Scene, Shot,
} from './types';

interface CanonContext {
  project: Project;
  episodeNumber: number;
  characters: Character[];
  wardrobes: Wardrobe[];
  locations: LocationRow[];
  props: PropRow[];
  scene: Scene;
  shot: Shot;
}

const LENS_LABEL: Record<number, string> = {
  24: 'wide aggressive perspective',
  28: 'wide establishing perspective',
  35: 'natural cinematic wide',
  50: 'natural dialogue rendering',
  85: 'portrait compression, shallow depth',
  100: 'long-lens insert compression',
};

function identityText(c: Character): string {
  const i = c.identity;
  const parts = [
    `${c.canonical_name}, ${c.gender || 'character'}${c.age ? `, apparent age ${c.age}` : ''}`,
    i.face_shape && `face shape ${i.face_shape}`,
    i.skin_tone && `skin tone ${i.skin_tone}`,
    i.eyes && `eyes ${i.eyes}`,
    i.hair && `hair ${i.hair}`,
    i.build && `build ${i.build}`,
    i.features && `distinguishing features: ${i.features}`,
  ].filter(Boolean);
  return parts.join(', ');
}

export function compileImagePrompt(ctx: CanonContext): string {
  const { project, episodeNumber, characters, wardrobes, locations, scene, shot } = ctx;
  const character = characters.find((c) => c.id === shot.character_id);
  const wardrobe = wardrobes.find((w) => w.id === shot.wardrobe_id);
  const location = locations.find((l) => l.id === scene.location_id);
  const vs = project.visual_style;

  const lines = [
    `PRODUCTION STILL — EP${String(episodeNumber).padStart(2, '0')}_SC${String(scene.scene_number).padStart(2, '0')}_SH${String(shot.shot_number).padStart(2, '0')}`,
    '',
    'FORMAT:',
    'Vertical 9:16 cinematic frame.',
    '',
    'SHOT:',
    `${shot.shot_size}, ${shot.camera_angle}, ${shot.lens_mm}mm (${LENS_LABEL[shot.lens_mm] ?? 'natural rendering'}).`,
    '',
    'SUBJECT:',
    character ? identityText(character) : '(no character bound)',
    wardrobe ? `Wardrobe exactly: ${wardrobe.name} — ${wardrobe.description}` : 'Wardrobe: not locked',
    '',
    'BLOCKING:',
    shot.blocking || 'maintain established axis and eyelines.',
    '',
    'ACTION:',
    shot.action || '(single visible action)',
    '',
    'PERFORMANCE:',
    shot.performance || 'specific internal emotion expressed physically; avoid generic "dramatic".',
    '',
    'ENVIRONMENT:',
    location
      ? `${location.name}. ${location.layout} Materials: ${location.materials}. Hero objects: ${location.hero_objects}. Do not redesign the room.`
      : '(no location bound)',
    '',
    'LIGHTING:',
    shot.lighting || vs.lighting || 'soft motivated key, natural skin priority.',
    '',
    'COLOR / TEXTURE:',
    [location?.palette, vs.color, vs.texture].filter(Boolean).join('. ') || 'restrained natural grading.',
    '',
    'CONTINUITY LOCK:',
    'same face, facial proportions, hairstyle, apparent age, body proportions, wardrobe, accessories and established state as canonical references. Maintain prop state and spatial layout from the previous shot.',
    '',
  ];

  if (vs.prohibited) lines.push(`STYLE PROHIBITED: ${vs.prohibited}.`);
  if (character?.forbidden_drift) lines.push(`IDENTITY FORBIDDEN: ${character.forbidden_drift}.`);
  if (location?.forbidden_changes) lines.push(`LOCATION FORBIDDEN: ${location.forbidden_changes}.`);
  lines.push('DO NOT: change identity, hairstyle, wardrobe, room architecture, hero props, time of day, screen direction. No extra fingers, duplicated people, malformed hands, text artifacts, random jewelry, random logos, subtitles baked into image.');

  return lines.join('\n');
}

export function compileVideoPrompt(ctx: CanonContext): string {
  const { project, episodeNumber, characters, wardrobes, locations, scene, shot } = ctx;
  const character = characters.find((c) => c.id === shot.character_id);
  const wardrobe = wardrobes.find((w) => w.id === shot.wardrobe_id);
  const location = locations.find((l) => l.id === scene.location_id);
  const dur = Math.min(Math.max(shot.duration, 4), 8);

  const lines = [
    `EP${String(episodeNumber).padStart(2, '0')}_SC${String(scene.scene_number).padStart(2, '0')}_SH${String(shot.shot_number).padStart(2, '0')} — VIDEO SHOT`,
    '',
    'Use the supplied start frame as visual and identity truth.',
    '',
    `DURATION: ${dur} seconds`,
    '',
    `SHOT: ${shot.shot_size}, ${shot.lens_mm}mm, ${shot.camera_angle}.`,
    '',
    `CAMERA: ${shot.camera_move}. Movement is physically plausible, smooth and restrained.`,
    '',
    'CHARACTER:',
    character ? `${identityText(character)}. Preserve exact face, hairstyle, age, body proportions, wardrobe and accessories from reference.` : '(no character bound)',
    wardrobe ? `Wardrobe locked: ${wardrobe.name} — ${wardrobe.description}` : '',
    '',
    `ACTION: ${shot.action || '(single visible action)'}`,
    '',
    'PERFORMANCE:',
    shot.performance || 'natural, restrained, specific.',
    '',
    'ENVIRONMENT:',
    location ? `${location.name}. Maintain exact established location geometry and hero objects (${location.hero_objects || 'per canon'}). No new furniture or architectural changes.` : '(no location bound)',
    '',
    'LIGHTING:',
    shot.lighting || 'maintain established light direction, exposure, color temperature and time of day.',
    scene.time_of_day && `Time of day: ${scene.time_of_day}.`,
    '',
    'DIALOGUE:',
    shot.dialogue || 'none. Do not add unrequested speech.',
    '',
    'AUDIO:',
    shot.audio || 'natural room tone only.',
    '',
    'CONTINUITY:',
    scene.entry_state && `Scene entry state: ${scene.entry_state}.`,
    scene.exit_state && `Scene exit state: ${scene.exit_state}.`,
    'The character starts in the exact state established by the previous shot and ends in the state required by the next shot.',
    '',
    'NEGATIVE: no identity drift, no costume change, no facial morphing, no extra people, no warped hands, no random camera shake, no sudden lighting shift, no background redesign, no baked-in subtitles.',
  ];

  return lines.filter((l) => l !== '').join('\n');
}

export function referencePackPrompt(c: Character): string {
  const lines = [
    'IDENTITY REFERENCE SHEET.',
    '',
    `${identityText(c)}.`,
    c.performance.posture && `Baseline posture: ${c.performance.posture}.`,
    c.performance.expression && `Resting expression: ${c.performance.expression}.`,
    c.performance.gestures && `Gesture language: ${c.performance.gestures}.`,
    '',
    'Neutral studio environment, even soft daylight-balanced illumination, neutral facial expression, natural skin texture, accurate facial anatomy, no dramatic color grading, no beauty filter, no stylized distortion.',
    '',
    'Create a production-ready character reference showing: front portrait, three-quarter portrait, profile portrait and full-body view. All views depict exactly the same person, same facial proportions, same hairline, same hairstyle, same apparent age and same body proportions.',
    '',
    'Wardrobe: standard neutral wardrobe master.',
    'Background: clean neutral gray.',
    'Purpose: canonical visual reference for a serialized cinematic production.',
  ];
  return lines.filter((l) => l !== '').join('\n');
}

export function locationMasterPrompt(l: LocationRow): string {
  return [
    `LOCATION REFERENCE SHEET — ${l.name}.`,
    '',
    `Layout: ${l.layout}`,
    `Materials: ${l.materials}`,
    `Hero objects: ${l.hero_objects}`,
    `Palette: ${l.palette}`,
    `Practical lighting: ${l.lighting}`,
    '',
    'Create a production-ready location reference showing: master wide establishing shot, reverse angle, left wall, right wall, entrance POV, window POV and detail inserts of hero props.',
    'All views depict exactly the same room, same architecture, same furniture placement, same time of day and same lighting motivation.',
    l.forbidden_changes && `FORBIDDEN: ${l.forbidden_changes}`,
    '',
    'Purpose: canonical spatial reference for a serialized cinematic production.',
  ].filter((l) => l !== '').join('\n');
}
