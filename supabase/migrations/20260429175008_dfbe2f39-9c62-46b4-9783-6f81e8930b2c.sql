ALTER TABLE public.apk_builds
ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'android';