import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius } from "../../assets/colors/colors";
import { IconName } from "../taskMeta";

export type ChipOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
  color?: string;
};

type ChipsProps<T extends string> = {
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
};

export default function Chips<T extends string>({
  options,
  value,
  onChange,
}: ChipsProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = o.value === value;
        const tint = o.color ?? colors.accent;
        return (
          <TouchableOpacity
            key={o.value}
            activeOpacity={0.8}
            onPress={() => onChange(o.value)}
            style={[
              styles.chip,
              active && { backgroundColor: tint + "26", borderColor: tint },
            ]}
          >
            {o.icon && (
              <Ionicons
                name={o.icon}
                size={14}
                color={active ? tint : colors.textMuted}
              />
            )}
            <Text style={[styles.text, active && { color: tint }]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
});
