import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

// A profile picture is stored in the same text field as an emoji avatar, as a
// small square JPEG data URI, so it syncs and shows up for friends without any
// file storage.
export const IMAGE_PREFIX = "data:image/jpeg;base64,";
export const MAX_AVATAR_CHARS = 24000;
export const MAX_EMOJI_CHARS = 16;

export const isImageAvatar = (a: unknown): a is string =>
  typeof a === "string" && a.startsWith(IMAGE_PREFIX) && a.length <= MAX_AVATAR_CHARS;

// Anything else (an emoji, short text) or a bad/oversized image falls back safely.
export const normalizeAvatar = (a: unknown, fallback: string): string =>
  isImageAvatar(a) ? a : typeof a === "string" && a.length > 0 && a.length <= MAX_EMOJI_CHARS ? a : fallback;

// Pick a picture from the library, crop it to a centred square and shrink it.
// Resolves to the avatar string, or null if the person backed out.
export async function pickAvatarImage(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const { uri, width, height } = res.assets[0];

  const side = Math.min(width, height);
  const crop = {
    originX: Math.floor((width - side) / 2),
    originY: Math.floor((height - side) / 2),
    width: side,
    height: side,
  };
  // Aim small; step down if a busy picture still comes out too big.
  for (const [size, quality] of [[128, 0.7], [112, 0.5], [96, 0.4], [64, 0.4]] as const) {
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop }, { resize: { width: size, height: size } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    const avatar = IMAGE_PREFIX + out.base64;
    if (out.base64 && avatar.length <= MAX_AVATAR_CHARS) return avatar;
  }
  return null;
}
