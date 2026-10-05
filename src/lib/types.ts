export interface Premise {
  wants: string;
  needs: string;
  obstacle: string;
  question: string;
}

export interface VisualStyle {
  genre_visual: string;
  lighting: string;
  color: string;
  texture: string;
  prohibited: string;
}

export interface Project {
  id: string;
  title: string;
  language: string;
  genre: string;
  audience: string;
  tone: string;
  logline: string;
  series_promise: string;
  premise: Premise;
  visual_style: VisualStyle;
  target_episodes: number;
  episode_seconds: number;
  image_model: string;
  video_model: string;
  created_at: string;
}

export interface Character {
  id: string;
  project_id: string;
  canonical_name: string;
  role: string;
  age: number | null;
  gender: string;
  identity: CharacterIdentity;
  performance: CharacterPerformance;
  forbidden_drift: string;
  created_at: string;
}

export interface CharacterIdentity {
  face_shape: string;
  skin_tone: string;
  eyes: string;
  hair: string;
  build: string;
  features: string;
}

export interface CharacterPerformance {
  posture: string;
  expression: string;
  gestures: string;
  tell: string;
}

export interface Wardrobe {
  id: string;
  project_id: string;
  character_id: string | null;
  name: string;
  description: string;
  notes: string;
  created_at: string;
}

export interface LocationRow {
  id: string;
  project_id: string;
  name: string;
  layout: string;
  materials: string;
  hero_objects: string;
  palette: string;
  lighting: string;
  forbidden_changes: string;
  created_at: string;
}

export interface PropRow {
  id: string;
  project_id: string;
  name: string;
  description: string;
  state: string;
  narrative_function: string;
  created_at: string;
}

export interface Episode {
  id: string;
  project_id: string;
  number: number;
  title: string;
  hook: string;
  context: string;
  conflict: string;
  escalation: string;
  reversal: string;
  consequence: string;
  cliffhanger: string;
  cliffhanger_visual: string;
  status: string;
  created_at: string;
}

export interface Scene {
  id: string;
  project_id: string;
  episode_id: string;
  scene_number: number;
  location_id: string | null;
  time_of_day: string;
  objective: string;
  conflict: string;
  entry_state: string;
  exit_state: string;
  notes: string;
  created_at: string;
}

export interface Shot {
  id: string;
  project_id: string;
  scene_id: string;
  shot_number: number;
  shot_size: string;
  camera_angle: string;
  lens_mm: number;
  camera_move: string;
  character_id: string | null;
  wardrobe_id: string | null;
  action: string;
  performance: string;
  dialogue: string;
  audio: string;
  lighting: string;
  blocking: string;
  duration: number;
  notes: string;
  qc_status: string;
  qc_notes: string;
  created_at: string;
}

export interface StudioData {
  projects: Project[];
  characters: Character[];
  wardrobes: Wardrobe[];
  locations: LocationRow[];
  props: PropRow[];
  episodes: Episode[];
  scenes: Scene[];
  shots: Shot[];
  keyframes: Keyframe[];
}

export const SHOT_SIZES = [
  'ECU', 'CU', 'MCU', 'MS', 'MLS', 'FS', 'WS', 'EWS',
  'OTS', 'POV', 'Insert', 'Two-Shot', 'Group Shot',
];

export const CAMERA_ANGLES = [
  'eye level', 'low angle', 'high angle', 'top-down',
  'dutch angle', 'profile', 'frontal', 'rear 3/4',
];

export const CAMERA_MOVES = [
  'locked-off', 'slow push-in', 'pull-out', 'dolly left', 'dolly right',
  'truck', 'pan', 'tilt', 'pedestal', 'orbit', 'handheld restrained',
  'whip pan', 'crane/jib', 'rack focus',
];

export const CHARACTER_ROLES = [
  'protagonist', 'antagonist', 'love interest', 'ally',
  'rival', 'mentor', 'supporting',
];

export const EPISODE_STATUSES = ['draft', 'beats', 'scripted', 'shooting', 'locked'];

export const QC_STATUSES = ['pending', 'pass', 'warn', 'fail'];

export interface KeyframeParams {
  expression: string;
  light_side: string;
  intensity: number;
}

export interface Keyframe {
  id: string;
  project_id: string;
  shot_id: string;
  seed: number;
  params: KeyframeParams;
  approved: boolean;
  created_at: string;
}
