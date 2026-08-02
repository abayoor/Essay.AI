-- Slipstream now has one deliberate visual identity: the dark theme.
update public.users
set theme_preference = 'dark'
where theme_preference is distinct from 'dark';

alter table public.users
  alter column theme_preference set default 'dark',
  drop constraint if exists users_theme_preference_allowed,
  add constraint users_theme_preference_allowed check (theme_preference = 'dark');
