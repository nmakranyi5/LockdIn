import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useRef, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, radius } from "../../assets/colors/colors";
import Button from "../../components/ui/Button";
import IconButton from "../../components/ui/IconButton";
import ModalCard from "../../components/ui/ModalCard";
import Chips from "../../components/ui/Chips";
import WebPicker from "../../components/ui/WebPicker";
import {
  KIND_OPTIONS,
  PRIORITY_OPTIONS,
  REPEAT_OPTIONS,
} from "../../components/taskMeta";
import {
  ChecklistItem,
  kindOf,
  newId,
  Priority,
  priorityOf,
  repeatOf,
  Repeat,
  TaskKind,
} from "../../components/taskState";
import HelpTaskScreenModal from "./HelpTaskScreenModal";

const ESTIMATE_PRESETS = [
  { minutes: 15, label: "15m" },
  { minutes: 30, label: "30m" },
  { minutes: 45, label: "45m" },
  { minutes: 60, label: "1h" },
  { minutes: 120, label: "2h" },
];

const ESTIMATE_OPTIONS = [
  { value: "none", label: "None" },
  ...ESTIMATE_PRESETS.map((p) => ({ value: String(p.minutes), label: p.label })),
  { value: "custom", label: "Custom" },
];

type AddTaskModalProps = {
  isVisible: boolean;
  onClose: () => void;
  onSave: (taskData: any) => void;
  initialTask?: any | null;
  // A missed task being copied onto a new day: opens as a new task prefilled from it.
  rescheduleOf?: any | null;
  defaultDate?: Date;
};

export default function AddTaskModal({
  isVisible,
  onClose,
  onSave,
  initialTask,
  rescheduleOf,
  defaultDate,
}: AddTaskModalProps) {
  const [title, setTitle] = useState("");
  const [repeats, setRepeats] = useState<Repeat>("none");
  const [kind, setKind] = useState<TaskKind>("timer");
  const [priority, setPriority] = useState<Priority>("normal");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [itemsError, setItemsError] = useState(false);
  const [estimateKey, setEstimateKey] = useState<string>("none");
  const [customMinutes, setCustomMinutes] = useState("");
  const [estimateError, setEstimateError] = useState(false);
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);

  const isAndroid = Platform.OS === "android";
  const [showStartTime, setShowStartTime] = useState(!isAndroid);
  const [showEndTime, setShowEndTime] = useState(!isAndroid);
  const [showStartDate, setShowStartDate] = useState(!isAndroid);
  const [showEndDate, setShowEndDate] = useState(!isAndroid);

  useEffect(() => {
    if (!isVisible) return;

    setItemsError(false);
    setEstimateError(false);
    lastDuration.current = 60 * 60_000;

    const est: number | undefined = (initialTask ?? rescheduleOf)?.estimateMinutes;
    if (!est) {
      setEstimateKey("none");
      setCustomMinutes("");
    } else if (ESTIMATE_PRESETS.some((p) => p.minutes === est)) {
      setEstimateKey(String(est));
      setCustomMinutes("");
    } else {
      setEstimateKey("custom");
      setCustomMinutes(String(est));
    }

    if (initialTask) {
      const wasDone = !!initialTask.completedAt;
      setKind(kindOf(initialTask));
      setPriority(priorityOf(initialTask));
      setRepeats(repeatOf(initialTask));
      // Rescheduling a finished task starts its checklist over.
      setItems(
        (initialTask.items ?? []).map((i: ChecklistItem) => ({
          ...i,
          done: wasDone ? false : i.done,
        }))
      );
      setTitle(initialTask.title ?? "");
      setStartDate(new Date(initialTask.startDate));
      setStartTime(new Date(initialTask.startDate));
      setEndDate(new Date(initialTask.endDate));
      setEndTime(new Date(initialTask.endDate));
      return;
    }

    const base = new Date();
    base.setSeconds(0, 0);
    const day = defaultDate ? new Date(defaultDate) : new Date(base);
    const isToday = day.toDateString() === base.toDateString();

    // Today: start next minute. Any other day: start at 9:00.
    const start = new Date(day);
    if (isToday) {
      start.setHours(base.getHours(), base.getMinutes() + 1, 0, 0);
    } else {
      start.setHours(9, 0, 0, 0);
    }
    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    if (rescheduleOf) {
      // Same task, new slot: keep its length, start its checklist over.
      const length = Math.max(
        60_000,
        new Date(rescheduleOf.endDate).getTime() - new Date(rescheduleOf.startDate).getTime()
      );
      const until = new Date(start.getTime() + length);
      lastDuration.current = length;
      setKind(kindOf(rescheduleOf));
      setPriority(priorityOf(rescheduleOf));
      setRepeats("none");
      setItems(
        (rescheduleOf.items ?? []).map((i: ChecklistItem) => ({ ...i, done: false }))
      );
      setTitle(rescheduleOf.title ?? "");
      setStartDate(start);
      setStartTime(start);
      setEndDate(until);
      setEndTime(until);
      return;
    }

    setKind("timer");
    setPriority("normal");
    setRepeats("none");
    setItems([]);
    setTitle("");
    setStartDate(start);
    setStartTime(start);
    setEndDate(end);
    setEndTime(end);
  }, [isVisible]);

  const formatDate = (d: Date) => d.toLocaleDateString();

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const showStartDateSelect = () => setShowStartDate(true);
  const showStartTimeSelect = () => setShowStartTime(true);
  const showEndDateSelect = () => setShowEndDate(true);
  const showEndTimeSelect = () => setShowEndTime(true);

  const onChangeStartDate = (_: any, d?: Date) => {
    if (d) setStartDate(d);
    if (isAndroid) setShowStartDate(false);
  };

  const getNextMinute = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);
    return d;
  };

  const [now, setNow] = useState(getNextMinute);

  const onChangeStartTime = (_: any, t?: Date) => {
    if (isAndroid) setShowStartTime(false);
    if (!t) return;

    const picked = normalize(t);

    if (isAndroid) {
      const nowDate = new Date();
      nowDate.setSeconds(0, 0);

      if (
        startDate.toDateString() === nowDate.toDateString() &&
        picked < nowDate
      ) {
        setStartTime(nowDate);
        return;
      }
    }

    setStartTime(picked);
  };

  const onChangeEndDate = (_: any, d?: Date) => {
    if (d) setEndDate(d);
    if (isAndroid) setShowEndDate(false);
  };

  const onChangeEndTime = (_: any, selectedDate?: Date) => {
    if (isAndroid) setShowEndTime(false);
    if (!selectedDate) return;

    const picked = normalize(selectedDate);

    let minAllowed = new Date(startDate);
    minAllowed.setHours(startTime.getHours(), startTime.getMinutes() + 1, 0, 0);

    if (isAndroid) {
      const nowDate = new Date();
      nowDate.setSeconds(0, 0);

      if (endDate.toDateString() === nowDate.toDateString()) {
        const minNow = new Date(nowDate);
        minNow.setMinutes(minNow.getMinutes() + 1);
        if (minNow > minAllowed) minAllowed = minNow;
      }
    }

    setEndTime(picked < minAllowed ? minAllowed : picked);
  };

  const getMinuteNow = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d;
  };

  const handleCloseHelp = async () => {
    try {
      await AsyncStorage.setItem("hasSeenTaskHelp", "true");
      setIsHelpModalVisible(false);
    } catch (e) {
      console.log("Error saving help modal flag", e);
    }
  };

  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const hasSeenTaskHelp = await AsyncStorage.getItem("hasSeenTaskHelp");

        if (!hasSeenTaskHelp) {
          setIsHelpModalVisible(true);
        }
      } catch (e) {
        console.log("Error checking help modal flag", e);
      }
    };

    checkFirstLaunch();
  }, []);

  // Past start times are only off limits for new tasks and reschedules;
  // editing a task that already started must not move its start to "now".
  const clampStart = !initialTask || !!initialTask.completedAt;

  useEffect(() => {
    if (Platform.OS === "ios" || !clampStart) return;

    const nowDate = new Date();
    nowDate.setSeconds(0, 0);

    let minStart = nowDate;

    if (startDate.toDateString() !== nowDate.toDateString()) return;

    setStartTime((prev) => {
      const normalized = normalize(prev);
      return normalized < minStart ? minStart : normalized;
    });
  }, [startDate, now]);

  const isWeb = Platform.OS === "web";

  // The pickers only limit what can be chosen for the deadline, not what
  // happens to it when the start moves. If the start passes the deadline,
  // push the deadline out and keep the task's previous length.
  const lastDuration = useRef(60 * 60_000);
  useEffect(() => {
    const start = new Date(startDate);
    start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    const end = new Date(endDate);
    end.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

    if (end.getTime() <= start.getTime()) {
      const fixed = new Date(start.getTime() + lastDuration.current);
      setEndDate(fixed);
      setEndTime(fixed);
    } else {
      lastDuration.current = end.getTime() - start.getTime();
    }
  }, [startDate, startTime, endDate, endTime]);

  function normalize(date: Date) {
    const d = new Date(date);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
  }

  function minDeadlineFromStart(start: Date) {
    const d = new Date(start);
    d.setMinutes(d.getMinutes() + 1);
    return d;
  }

  useEffect(() => {
    const msToNextMinute = 60000 - (Date.now() % 60000);

    const timeout = setTimeout(() => {
      setNow(getNextMinute());

      const interval = setInterval(() => {
        setNow(getNextMinute());
      }, 60000);

      return () => clearInterval(interval);
    }, msToNextMinute);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      d.setSeconds(0, 0);
      setNow(d);
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!clampStart) return;
    const currentTime = new Date(now);
    currentTime.setSeconds(0, 0);

    const selectedStart = new Date(startTime);

    if (
      startDate.toDateString() === now.toDateString() &&
      selectedStart.getTime() < currentTime.getTime()
    ) {
      setStartTime(currentTime);
    }
  }, [now, startDate]);

  const roundMinute = (date: Date) => {
    const d = new Date(date);
    d.setSeconds(0, 0);

    if (d.getTime() <= Date.now()) {
      d.setMinutes(d.getMinutes() + 1);
    }
    return d;
  };

  const getMinStartTime = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);
    return d;
  };

  const handleSave = () => {
    let estimateMinutes: number | undefined;
    if (kind === "timer" && estimateKey !== "none") {
      estimateMinutes =
        estimateKey === "custom" ? parseInt(customMinutes, 10) : Number(estimateKey);
      if (!estimateMinutes || estimateMinutes < 1 || estimateMinutes > 1440) {
        setEstimateError(true);
        return;
      }
    }

    const cleanItems =
      kind === "checklist" ? items.filter((i) => i.text.trim()) : [];
    if (kind === "checklist" && cleanItems.length === 0) {
      setItemsError(true);
      return;
    }

    const combinedStartDate = new Date(startDate);
    combinedStartDate.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

    const finalStart = clampStart
      ? roundMinute(combinedStartDate)
      : combinedStartDate;

    const combinedEndDate = new Date(endDate);
    combinedEndDate.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    combinedEndDate.setSeconds(0, 0);
    combinedEndDate.setMilliseconds(0);

    onSave({
      title: title,
      startDate: finalStart,
      endDate: combinedEndDate,
      repeats,
      kind,
      priority,
      estimateMinutes,
      items: cleanItems.map((i) => ({ ...i, text: i.text.trim() })),
    });

    onClose();
  };

  // Deadline shortcut: the end of the day the task starts on.
  const isEndOfDay =
    endTime.getHours() === 23 &&
    endTime.getMinutes() === 59 &&
    endDate.toDateString() === startDate.toDateString();
  const setEndOfDay = () => {
    const d = new Date(startDate);
    d.setHours(23, 59, 0, 0);
    setEndDate(d);
    setEndTime(d);
  };

  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const startEndMinDeadline = () => {
    if (endDate.toDateString() !== startDate.toDateString()) return undefined;
    const d = new Date(startDate);
    d.setHours(startTime.getHours(), startTime.getMinutes() + 1, 0, 0);
    return d;
  };

  return (
    <ModalCard
      visible={isVisible}
      title={initialTask ? "Edit Task" : rescheduleOf ? "Reschedule Task" : "Add Task"}
      headerRight={
        <View style={styles.headerActions}>
          <IconButton
            name="help-outline"
            label="Help"
            size={18}
            onPress={() => setIsHelpModalVisible(true)}
          />
          <IconButton name="close" label="Close" size={18} onPress={onClose} />
        </View>
      }
      maxWidth={480}
      footer={<Button label="Save" onPress={handleSave} />}
      overlay={
        <HelpTaskScreenModal
          isVisible={isHelpModalVisible}
          onClose={handleCloseHelp}
        />
      }
    >
      <Text style={styles.label}>Task name</Text>
      <View style={styles.field}>
        <TextInput
          placeholder="What needs to get done?"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      <Text style={styles.label}>Type</Text>
      <Chips options={KIND_OPTIONS} value={kind} onChange={setKind} />
      <Text style={[styles.hint, { marginTop: 8 }]}>
        {KIND_OPTIONS.find((o) => o.value === kind)?.hint}
      </Text>

      {kind === "timer" && (
        <>
          <Text style={styles.label}>Estimated time</Text>
          <Chips
            options={ESTIMATE_OPTIONS}
            value={estimateKey}
            onChange={(k) => {
              setEstimateKey(k);
              setEstimateError(false);
            }}
          />
          {estimateKey === "custom" && (
            <View style={[styles.field, styles.estimateField]}>
              <TextInput
                value={customMinutes}
                onChangeText={(t) => {
                  setCustomMinutes(t.replace(/[^0-9]/g, ""));
                  setEstimateError(false);
                }}
                placeholder="Minutes"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={4}
                style={[styles.input, { flex: 1, minWidth: 0 }]}
              />
              <Text style={styles.unit}>min</Text>
            </View>
          )}
          {estimateError && (
            <Text style={styles.error}>Enter an estimate between 1 and 1440 minutes.</Text>
          )}
          <Text style={[styles.hint, { marginTop: 8 }]}>
            {estimateKey === "none"
              ? "Optional. With an estimate you'll be asked to confirm if you finish early, and get check-ins if you run over."
              : "You'll be asked to confirm if you finish early, and get check-ins if you run over."}
          </Text>
        </>
      )}

      {kind === "checklist" && (
        <View style={styles.checklist}>
          {items.map((item, idx) => (
            <View key={item.id} style={styles.itemRow}>
              <Ionicons
                name="square-outline"
                size={20}
                color={colors.textMuted}
              />
              <TextInput
                value={item.text}
                placeholder={`Item ${idx + 1}`}
                placeholderTextColor={colors.textMuted}
                style={styles.itemInput}
                onChangeText={(text) => {
                  setItemsError(false);
                  setItems((prev) =>
                    prev.map((i) => (i.id === item.id ? { ...i, text } : i))
                  );
                }}
              />
              <TouchableOpacity
                hitSlop={10}
                onPress={() =>
                  setItems((prev) => prev.filter((i) => i.id !== item.id))
                }
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={styles.addItem}
            onPress={() =>
              setItems((prev) => [
                ...prev,
                { id: newId(), text: "", done: false },
              ])
            }
          >
            <Ionicons name="add" size={18} color={colors.accent} />
            <Text style={styles.addItemText}>Add item</Text>
          </TouchableOpacity>
          {itemsError && (
            <Text style={styles.error}>Add at least one checklist item.</Text>
          )}
        </View>
      )}

      <Text style={styles.label}>Start</Text>
      {isWeb ? (
        <View style={styles.pickerRow}>
          <WebPicker
            type="date"
            value={startDate}
            min={startOfToday()}
            onChange={setStartDate}
          />
          <WebPicker
            type="time"
            value={startTime}
            min={
              startDate.toDateString() === now.toDateString()
                ? getMinStartTime()
                : undefined
            }
            onChange={(t) => setStartTime(normalize(t))}
          />
        </View>
      ) : (
      <View style={styles.pickerRow}>
        <TouchableOpacity
          style={isAndroid ? styles.field : undefined}
          onPress={() => isAndroid && setShowStartDate(true)}
        >
          {isAndroid && (
            <Text style={styles.fieldText}>{formatDate(startDate)}</Text>
          )}
          {(!isAndroid || showStartDate) && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={isAndroid ? "calendar" : "default"}
              onChange={onChangeStartDate}
              themeVariant="dark"
              minimumDate={now}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={isAndroid ? styles.field : undefined}
          onPress={() => isAndroid && setShowStartTime(true)}
        >
          {isAndroid && (
            <Text style={styles.fieldText}>{formatTime(startTime)}</Text>
          )}
          {(!isAndroid || showStartTime) && (
            <DateTimePicker
              value={startTime}
              mode="time"
              display={isAndroid ? "clock" : "default"}
              onChange={onChangeStartTime}
              themeVariant="dark"
              minimumDate={
                startDate.toDateString() === now.toDateString()
                  ? getMinStartTime()
                  : undefined
              }
            />
          )}
        </TouchableOpacity>
      </View>

      )}

      <Text style={styles.label}>Deadline</Text>
      {isWeb ? (
        <View style={styles.pickerRow}>
          <WebPicker
            type="date"
            value={endDate}
            min={startDate}
            onChange={setEndDate}
          />
          <WebPicker
            type="time"
            value={endTime}
            min={startEndMinDeadline()}
            onChange={(t) => setEndTime(normalize(t))}
          />
        </View>
      ) : (
      <View style={styles.pickerRow}>
        <TouchableOpacity
          style={isAndroid ? styles.field : undefined}
          onPress={() => isAndroid && setShowEndDate(true)}
        >
          {isAndroid && (
            <Text style={styles.fieldText}>{formatDate(endDate)}</Text>
          )}
          {(!isAndroid || showEndDate) && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={isAndroid ? "calendar" : "default"}
              onChange={onChangeEndDate}
              themeVariant="dark"
              minimumDate={startDate}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={isAndroid ? styles.field : undefined}
          onPress={() => isAndroid && setShowEndTime(true)}
        >
          {isAndroid && (
            <Text style={styles.fieldText}>{formatTime(endTime)}</Text>
          )}
          {(!isAndroid || showEndTime) && (
            <DateTimePicker
              value={endTime}
              mode="time"
              display={isAndroid ? "clock" : "default"}
              onChange={onChangeEndTime}
              themeVariant="dark"
              minimumDate={startEndMinDeadline()}
            />
          )}
        </TouchableOpacity>
      </View>

      )}

      <View style={styles.eod}>
        <Chips
          options={[{ value: "eod", label: "End of day · 11:59 PM", icon: "moon-outline" }]}
          value={isEndOfDay ? "eod" : ""}
          onChange={setEndOfDay}
        />
      </View>

      <Text style={styles.label}>Priority</Text>
      <Chips options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />

      <Text style={styles.label}>Repeat</Text>
      <Chips options={REPEAT_OPTIONS} value={repeats} onChange={setRepeats} />

      <Text style={styles.hint}>
        Pickers automatically adjust to prevent selecting times that have
        already passed.
      </Text>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  eod: { marginTop: 10 },
  headerActions: { flexDirection: "row", gap: 8 },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
    marginTop: 16,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  field: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  fieldText: { color: colors.textPrimary, fontSize: 16 },
  pickerRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    height: 50,
    color: colors.textPrimary,
    fontSize: 16,
    outlineColor: "transparent",
    outlineWidth: 0,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  estimateField: { marginTop: 10, flexDirection: "row", alignItems: "center" },
  unit: { color: colors.textMuted, fontSize: 15, marginLeft: 8 },
  checklist: { marginTop: 12, gap: 8 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  itemInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    color: colors.textPrimary,
    fontSize: 15,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  addItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  addItemText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  error: { color: colors.danger, fontSize: 13 },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
  },
});
