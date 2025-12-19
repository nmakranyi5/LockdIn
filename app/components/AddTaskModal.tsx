import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../../assets/colors/colors";

type AddTaskModalProps = {
  isVisible: boolean;
  onClose: () => void;
  onSave: (taskData: any) => void;
  initialTask?: any | null;
};

export default function AddTaskModal({
  isVisible,
  onClose,
  onSave,
  initialTask,
}: AddTaskModalProps) {
  const [title, setTitle] = useState("");
  const [repeats, setRepeats] = useState("");
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const isAndroid = Platform.OS === "android";
  const [showStartTime, setShowStartTime] = useState(!isAndroid);
  const [showEndTime, setShowEndTime] = useState(!isAndroid);
  const [showStartDate, setShowStartDate] = useState(!isAndroid);
  const [showEndDate, setShowEndDate] = useState(!isAndroid);

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

  useEffect(() => {
    if (!isAndroid) return;

    const nowDate = new Date();
    nowDate.setSeconds(0, 0);

    let minStart = nowDate;

    if (startDate.toDateString() !== nowDate.toDateString()) return;

    setStartTime((prev) => {
      const normalized = normalize(prev);
      return normalized < minStart ? minStart : normalized;
    });
  }, [startDate, now]);

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

  return (
    <Modal animationType="fade" transparent visible={isVisible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.backdrop}>
          <View style={styles.popup}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {initialTask ? "Edit Task" : "Add Task"}
              </Text>
              <MaterialIcons
                name="close"
                size={24}
                color={colors.textMuted}
                onPress={onClose}
              />
            </View>
            <View style={styles.body}>
              <Text style={styles.label}>Task Name</Text>
              <View style={styles.inputBox}>
                <TextInput
                  placeholder="Enter task name"
                  placeholderTextColor={colors.textLabel}
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>
              <Text style={styles.label}>Start</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  style={isAndroid ? styles.inputBox : undefined}
                  onPress={() => isAndroid && setShowStartDate(true)}
                >
                  {isAndroid && (
                    <Text style={{ color: colors.textPrimary }}>
                      {formatDate(startDate)}
                    </Text>
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
                  style={isAndroid ? styles.inputBox : undefined}
                  onPress={() => isAndroid && setShowStartTime(true)}
                >
                  {isAndroid && (
                    <Text style={{ color: colors.textPrimary }}>
                      {formatTime(startTime)}
                    </Text>
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

              <Text style={styles.label}>Deadline</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  style={isAndroid ? styles.inputBox : undefined}
                  onPress={() => isAndroid && setShowEndDate(true)}
                >
                  {isAndroid && (
                    <Text style={{ color: colors.textPrimary }}>
                      {formatDate(endDate)}
                    </Text>
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
                  style={isAndroid ? styles.inputBox : undefined}
                  onPress={() => isAndroid && setShowEndTime(true)}
                >
                  {isAndroid && (
                    <Text style={{ color: colors.textPrimary }}>
                      {formatTime(endTime)}
                    </Text>
                  )}
                  {(!isAndroid || showEndTime) && (
                    <DateTimePicker
                      key={endTime.getTime()}
                      value={endTime}
                      mode="time"
                      display={isAndroid ? "clock" : "default"}
                      onChange={onChangeEndTime}
                      themeVariant="dark"
                      minimumDate={
                        endDate.toDateString() === startDate.toDateString()
                          ? (() => {
                              const d = new Date(startDate);
                              d.setHours(
                                startTime.getHours(),
                                startTime.getMinutes() + 1,
                                0,
                                0
                              );
                              return d;
                            })()
                          : undefined
                      }
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => {
                const combinedStartDate = new Date(startDate);
                combinedStartDate.setHours(
                  startTime.getHours(),
                  startTime.getMinutes(),
                  0,
                  0
                );

                const finalStart = roundMinute(combinedStartDate);

                const combinedEndDate = new Date(endDate);
                combinedEndDate.setHours(
                  endTime.getHours(),
                  endTime.getMinutes(),
                  0,
                  0
                );
                combinedEndDate.setSeconds(0, 0);
                combinedEndDate.setMilliseconds(0);

                onSave({
                  title: title,
                  startDate: finalStart,
                  endDate: combinedEndDate,
                  repeats,
                });

                onClose();
              }}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  popup: {
    width: "90%",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    maxWidth: 560,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.textPrimary,
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    color: colors.textLabel,
    marginBottom: 6,
    marginTop: 8,
    fontWeight: "bold",
  },
  inputBox: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    justifyContent: "center",
    marginBottom: 20,
  },
  body: {
    marginTop: 12,
    gap: 8,
  },
  saveButton: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  input: {
    height: 40,
    color: colors.textPrimary,
    outlineColor: "transparent",
    outlineWidth: 0,
  },
});
