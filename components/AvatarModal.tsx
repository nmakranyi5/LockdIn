import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius } from "../assets/colors/colors";
import AvatarView from "./AvatarView";
import { isImageAvatar, pickAvatarImage } from "./avatar";
import Button from "./ui/Button";
import ModalCard from "./ui/ModalCard";
import { AVATARS } from "./useProfile";

type AvatarModalProps = {
  visible: boolean;
  avatar: string;
  onSelect: (avatar: string) => void;
  onClose: () => void;
};

// Every avatar in one place: your own photo, or any of the emoji.
export default function AvatarModal({ visible, avatar, onSelect, onClose }: AvatarModalProps) {
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choosePhoto = async () => {
    setPicking(true);
    setError(null);
    try {
      const picked = await pickAvatarImage();
      if (picked) onSelect(picked);
    } catch (e) {
      console.log("Could not pick a picture", e);
      setError("Couldn't use that picture. Try another one, or allow photo access in Settings.");
    } finally {
      setPicking(false);
    }
  };

  const hasPhoto = isImageAvatar(avatar);
  return (
    <ModalCard
      visible={visible}
      title="Choose an avatar"
      maxWidth={400}
      footer={<Button label="Done" onPress={onClose} />}
    >
      <View style={styles.preview}>
        <View style={styles.previewRing}>
          <AvatarView avatar={avatar} size={92} fontSize={48} />
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Choose a profile picture"
        disabled={picking}
        onPress={choosePhoto}
        style={[styles.photo, picking && { opacity: 0.5 }]}
      >
        <Ionicons name="image-outline" size={20} color={colors.accent} />
        <Text style={styles.photoText}>{hasPhoto ? "Choose a different photo" : "Choose a photo"}</Text>
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.label}>Or pick one</Text>
      <View style={styles.grid}>
        {AVATARS.map((a) => (
          <TouchableOpacity
            key={a}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Avatar ${a}`}
            accessibilityState={{ selected: a === avatar }}
            onPress={() => onSelect(a)}
            style={[styles.tile, a === avatar && styles.tileActive]}
          >
            <Text style={styles.tileText}>{a}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: "center", marginBottom: 14 },
  previewRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  photoText: { fontSize: 15, fontWeight: "700", color: colors.accent },
  error: { marginTop: 8, fontSize: 13, color: colors.danger },
  label: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  // Four across; the tiles share the width so they never run off the edge.
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "22%",
    flexGrow: 1,
    aspectRatio: 1,
    maxWidth: 80,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  tileText: { fontSize: 28 },
});
