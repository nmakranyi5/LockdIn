import { Ionicons } from "@expo/vector-icons";
import { colors } from "../assets/colors/colors";
import { Priority, Repeat, TaskKind } from "./taskState";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

export const KIND_OPTIONS: {
  value: TaskKind;
  label: string;
  icon: IconName;
  hint: string;
}[] = [
  {
    value: "timer",
    label: "Timer",
    icon: "timer-outline",
    hint: "Start and stop a timer while you work.",
  },
  {
    value: "checklist",
    label: "Checklist",
    icon: "list-outline",
    hint: "Tick off items. Completes when all are done.",
  },
  {
    value: "oneshot",
    label: "One & done",
    icon: "checkmark-circle-outline",
    hint: "Just mark it done when it's finished.",
  },
];

export const PRIORITY_OPTIONS: {
  value: Priority;
  label: string;
  icon: IconName;
  color: string;
}[] = [
  { value: "low", label: "Low", icon: "arrow-down", color: colors.textMuted },
  { value: "normal", label: "Normal", icon: "remove", color: colors.accent },
  { value: "important", label: "Important", icon: "star", color: colors.warning },
  { value: "urgent", label: "Urgent", icon: "flame", color: colors.danger },
];

export const REPEAT_OPTIONS: { value: Repeat; label: string }[] = [
  { value: "none", label: "Never" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const priorityRank: Record<Priority, number> = {
  low: 0,
  normal: 1,
  important: 2,
  urgent: 3,
};

export const priorityMeta = (p: Priority) =>
  PRIORITY_OPTIONS.find((o) => o.value === p)!;
export const kindMeta = (k: TaskKind) => KIND_OPTIONS.find((o) => o.value === k)!;
export const repeatLabel = (r: Repeat) =>
  REPEAT_OPTIONS.find((o) => o.value === r)?.label ?? "";
