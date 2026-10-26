import { createElement } from "react";
import { colors, radius } from "../../assets/colors/colors";

type WebPickerProps = {
  type: "date" | "time";
  value: Date;
  min?: Date;
  onChange: (next: Date) => void;
};

const pad = (n: number) => n.toString().padStart(2, "0");
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Native <input type="date|time"> for the browser; the native pickers from
// @react-native-community/datetimepicker don't render on web.
export default function WebPicker({ type, value, min, onChange }: WebPickerProps) {
  return createElement("input", {
    type,
    value: type === "date" ? toDateStr(value) : toTimeStr(value),
    min: min ? (type === "date" ? toDateStr(min) : toTimeStr(min)) : undefined,
    onChange: (e: { target: { value: string } }) => {
      const raw = e.target.value;
      if (!raw) return;
      const next = new Date(value);
      if (type === "date") {
        const [y, m, d] = raw.split("-").map(Number);
        next.setFullYear(y, m - 1, d);
      } else {
        const [h, mi] = raw.split(":").map(Number);
        next.setHours(h, mi, 0, 0);
      }
      onChange(next);
    },
    style: {
      flex: 1,
      minWidth: 0,
      height: 50,
      boxSizing: "border-box",
      padding: "0 14px",
      borderRadius: radius.md,
      border: `1px solid ${colors.border}`,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontSize: 16,
      fontFamily: "system-ui, -apple-system, \"Segoe UI\", sans-serif",
      colorScheme: "dark",
      outline: "none",
    },
  });
}
