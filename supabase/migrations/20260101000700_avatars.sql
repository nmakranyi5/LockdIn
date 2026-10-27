-- Profile pictures. An avatar is an emoji (up to 16 characters, as before) or
-- a small square JPEG stored as a data URI, so it syncs and shows up for
-- friends without any file storage. Nothing else is accepted, so the column
-- can't be used to store arbitrary text.

alter table public.profiles drop constraint if exists profiles_avatar_check;

alter table public.profiles
  add constraint profiles_avatar_check check (
    char_length(avatar) <= 16
    or (avatar like 'data:image/jpeg;base64,%' and char_length(avatar) <= 24000)
  );
