import { ReactNode } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { colors, radius } from "../../assets/colors/colors";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  style,
}: ButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.base, variantStyles[variant], style]}
    >
      {icon}
      <Text
        style={[
          styles.label,
          variant === "secondary" || variant === "ghost"
            ? styles.labelMuted
            : null,
          variant === "success" ? styles.labelOnLight : null,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: radius.md,
  },
  labelOnLight: { color: "#052e1c" },
  label: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  labelMuted: { color: colors.textLabel },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.accent },
  secondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: { backgroundColor: colors.danger },
  success: { backgroundColor: colors.success },
  ghost: { backgroundColor: "transparent" },
});
