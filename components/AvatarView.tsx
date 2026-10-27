import { Image, StyleSheet, Text, View } from "react-native";
import { isImageAvatar } from "./avatar";

type AvatarViewProps = {
  avatar: string;
  size: number;
  // Emoji size; defaults to about half of the circle.
  fontSize?: number;
};

// An emoji or a picture, always in a circle of the same size.
export default function AvatarView({ avatar, size, fontSize }: AvatarViewProps) {
  const circle = { width: size, height: size, borderRadius: size / 2 };
  if (isImageAvatar(avatar)) {
    return (
      <Image
        source={{ uri: avatar }}
        style={[styles.image, circle]}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.center, circle]}>
      <Text style={{ fontSize: fontSize ?? Math.round(size * 0.55) }}>{avatar}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: "#1C1C24" },
  center: { alignItems: "center", justifyContent: "center" },
});
