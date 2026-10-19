-- Eseguire una volta nel SQL Editor Supabase come postgres, dopo themes.sql.
alter table public.manila_theme_settings
 add column if not exists background_color text,
 add column if not exists accent_color text;
alter table public.manila_theme_settings
 drop constraint if exists manila_theme_background_hex;
alter table public.manila_theme_settings
 add constraint manila_theme_background_hex check(background_color is null or background_color ~ '^#[0-9A-Fa-f]{6}$');
alter table public.manila_theme_settings
 drop constraint if exists manila_theme_accent_hex;
alter table public.manila_theme_settings
 add constraint manila_theme_accent_hex check(accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$');
