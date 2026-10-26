import { Ionicons } from "@expo/vector-icons";
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { colors } from "../../assets/colors/colors";

type IconButtonProps = {
  name: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  size?: number;
  color?: string;
  background?: string;
  disabled?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export default function IconButton({
  name,
  onPress,
  size = 22,
  color = colors.textPrimary,
  background = colors.surface,
  disabled,
  label,
  style,
}: IconButtonProps) {
  const box = size + 22;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.base,
        {
          width: box,
          height: box,
          borderRadius: box / 2,
          backgroundColor: background,
          opacity: disabled ? 0.35 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
});
