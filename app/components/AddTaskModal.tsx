import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
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
import WebPicker from "../../components/ui/WebPicker";
import HelpTaskScreenModal from "./HelpTaskScreenModal";

type AddTaskModalProps = {
  isVisible: boolean;
  onClose: () => void;
  onSave: (taskData: any) => void;
  initialTask?: any | null;
  defaultDate?: Date;
};

export default function AddTaskModal({
  isVisible,
  onClose,
  onSave,
  initialTask,
  defaultDate,
}: AddTaskModalProps) {
  const [title, setTitle] = useState("");
  const [repeats, setRepeats] = useState("");
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

    if (initialTask) {
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

  useEffect(() => {
    if (Platform.OS === "ios") return;

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

  // Web has no native min/max enforcement across the pickers, so keep the
  // deadline at least a minute after the start.
  useEffect(() => {
    if (!isWeb) return;
    const start = new Date(startDate);
    start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    const end = new Date(endDate);
    end.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    if (end.getTime() <= start.getTime()) {
      const fixed = new Date(start.getTime() + 60_000);
      setEndDate(fixed);
      setEndTime(fixed);
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
    const combinedStartDate = new Date(startDate);
    combinedStartDate.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

    const finalStart = roundMinute(combinedStartDate);

    const combinedEndDate = new Date(endDate);
    combinedEndDate.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    combinedEndDate.setSeconds(0, 0);
    combinedEndDate.setMilliseconds(0);

    onSave({
      title: title,
      startDate: finalStart,
      endDate: combinedEndDate,
      repeats,
    });

    onClose();
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
      title={initialTask ? "Edit Task" : "Add Task"}
      headerRight={
        <View style={styles.headerActions}>
          <IconButton
            name="help-outline"
            size={18}
            onPress={() => setIsHelpModalVisible(true)}
          />
          <IconButton name="close" size={18} onPress={onClose} />
        </View>
      }
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

      <Text style={styles.hint}>
        Pickers automatically adjust to prevent selecting times that have
        already passed.
      </Text>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
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
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
  },
});
