/*
# Cinematic Series Director — core schema (single-tenant, no auth)

1. New Tables
- `projects` — one series bible: title, logline, genre, audience, tone, premise (4 layers), visual style, production settings (target episodes, episode seconds, models).
- `characters` — character bible with immutable identity lock (face, hair, body, distinguishing features), performance identity, and forbidden drift rules.
- `wardrobes` — wardrobe entries owned by a character, referenced by shots.
- `locations` — location bible: layout, materials, hero objects, palette, lighting, forbidden changes.
- `props` — prop bible: description, mutable state, narrative function.
- `episodes` — one episode: beat sheet fields (hook, context, conflict, escalation, reversal, consequence, cliffhanger) and status.
- `scenes` — a scene inside an episode: location, time of day, objective, conflict, entry/exit state.
- `shots` — a shot inside a scene: size, angle, lens, camera move, character, wardrobe, action, performance, dialogue, audio, lighting, blocking, duration.

2. Security
- RLS enabled on every table.
- Policies `TO anon, authenticated` with USING/WITH CHECK (true) because this app is intentionally single-tenant and shared (no sign-in screen).

3. Notes
- All child tables cascade on delete from their parent.
- Indexes on every foreign key for list queries.
*/

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'id-ID',
  genre text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT '',
  logline text NOT NULL DEFAULT '',
  series_promise text NOT NULL DEFAULT '',
  premise jsonb NOT NULL DEFAULT '{"wants":"","needs":"","obstacle":"","question":""}'::jsonb,
  visual_style jsonb NOT NULL DEFAULT '{"genre_visual":"","lighting":"","color":"","texture":"","prohibited":""}'::jsonb,
  target_episodes integer NOT NULL DEFAULT 60,
  episode_seconds integer NOT NULL DEFAULT 60,
  image_model text NOT NULL DEFAULT 'Midjourney / Runway Gen-4',
  video_model text NOT NULL DEFAULT 'Veo 3.1',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  canonical_name text NOT NULL,
  role text NOT NULL DEFAULT 'protagonist',
  age integer,
  gender text NOT NULL DEFAULT '',
  identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  forbidden_drift text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wardrobes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  character_id uuid REFERENCES characters(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  layout text NOT NULL DEFAULT '',
  materials text NOT NULL DEFAULT '',
  hero_objects text NOT NULL DEFAULT '',
  palette text NOT NULL DEFAULT '',
  lighting text NOT NULL DEFAULT '',
  forbidden_changes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS props (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  narrative_function text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number integer NOT NULL,
  title text NOT NULL DEFAULT '',
  hook text NOT NULL DEFAULT '',
  context text NOT NULL DEFAULT '',
  conflict text NOT NULL DEFAULT '',
  escalation text NOT NULL DEFAULT '',
  reversal text NOT NULL DEFAULT '',
  consequence text NOT NULL DEFAULT '',
  cliffhanger text NOT NULL DEFAULT '',
  cliffhanger_visual text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, number)
);

CREATE TABLE IF NOT EXISTS scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  scene_number integer NOT NULL DEFAULT 1,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  time_of_day text NOT NULL DEFAULT '',
  objective text NOT NULL DEFAULT '',
  conflict text NOT NULL DEFAULT '',
  entry_state text NOT NULL DEFAULT '',
  exit_state text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id uuid NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  shot_number integer NOT NULL DEFAULT 1,
  shot_size text NOT NULL DEFAULT 'MCU',
  camera_angle text NOT NULL DEFAULT 'eye level',
  lens_mm integer NOT NULL DEFAULT 50,
  camera_move text NOT NULL DEFAULT 'locked-off',
  character_id uuid REFERENCES characters(id) ON DELETE SET NULL,
  wardrobe_id uuid REFERENCES wardrobes(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT '',
  performance text NOT NULL DEFAULT '',
  dialogue text NOT NULL DEFAULT '',
  audio text NOT NULL DEFAULT '',
  lighting text NOT NULL DEFAULT '',
  blocking text NOT NULL DEFAULT '',
  duration integer NOT NULL DEFAULT 4,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE wardrobes ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE props ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','characters','wardrobes','locations','props','episodes','scenes','shots'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "public_crud_%1$s" ON %1$I', t);
    EXECUTE format(
      'CREATE POLICY "public_crud_%1$s" ON %1$I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_wardrobes_project ON wardrobes(project_id);
CREATE INDEX IF NOT EXISTS idx_wardrobes_character ON wardrobes(character_id);
CREATE INDEX IF NOT EXISTS idx_locations_project ON locations(project_id);
CREATE INDEX IF NOT EXISTS idx_props_project ON props(project_id);
CREATE INDEX IF NOT EXISTS idx_episodes_project ON episodes(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_episode ON scenes(episode_id);
CREATE INDEX IF NOT EXISTS idx_shots_project ON shots(project_id);
CREATE INDEX IF NOT EXISTS idx_shots_scene ON shots(scene_id);
