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
  const [showStartTime, setShowStartTime] = useState(true);
  const [showEndTime, setShowEndTime] = useState(true);
  const [showStartDate, setShowStartDate] = useState(true);
  const [showEndDate, setShowEndDate] = useState(true);
  const showStartDateSelect = () => setShowStartDate(true);
  const showStartTimeSelect = () => setShowStartTime(true);
  const showEndDateSelect = () => setShowEndDate(true);
  const showEndTimeSelect = () => setShowEndTime(true);

  const onChangeStartDate = (_: any, d?: Date) => {
    setShowStartDate(true);
    if (d) setStartDate(d);
  };

  const onChangeStartTime = (_: any, t?: Date) => {
    setShowStartTime(true);
    if (t) setStartTime(t);
  };

  const onChangeEndDate = (_: any, d?: Date) => {
    setShowEndDate(true);
    if (d) setEndDate(d);
  };

  const onChangeEndTime = (_: any, t?: Date) => {
    setShowEndTime(true);
    if (t) setEndTime(t);
  };

  const getMinuteNow = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d;
  };

  const getNextMinute = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);
    return d;
  };

  const [now, setNow] = useState(getNextMinute);

  useEffect(() => {
    // ms until the next minute boundary
    const msToNextMinute = 60000 - (Date.now() % 60000);

    const timeout = setTimeout(() => {
      setNow(getNextMinute());

      // after first sync, update exactly every minute
      const interval = setInterval(() => {
        setNow(getNextMinute());
      }, 60000);

      // cleanup interval on unmount
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
              <View style={{ flexDirection: "row" }}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={showStartDateSelect}
                >
                  {showStartDate && (
                    <DateTimePicker
                      value={startDate}
                      mode="date"
                      display="default"
                      onChange={onChangeStartDate}
                      themeVariant="dark"
                      minimumDate={now}
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={showStartTimeSelect}
                >
                  {showStartTime && (
                    <DateTimePicker
                      value={startTime}
                      mode="time"
                      display="default"
                      onChange={onChangeStartTime}
                      themeVariant="dark"
                      minimumDate={
                        startDate.toDateString() === new Date().toDateString()
                          ? getMinStartTime()
                          : undefined
                      }
                    />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Deadline</Text>
              <View style={{ flexDirection: "row" }}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={showEndDateSelect}
                >
                  {showEndDate && (
                    <DateTimePicker
                      value={endDate}
                      mode="date"
                      display="default"
                      onChange={onChangeEndDate}
                      themeVariant="dark"
                      minimumDate={startDate}
                    />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={showEndTimeSelect}
                >
                  {showEndTime && (
                    <DateTimePicker
                      value={endTime}
                      mode="time"
                      display="default"
                      onChange={onChangeEndTime}
                      themeVariant="dark"
                      minimumDate={(() => {
                        const d = new Date(startDate);
                        d.setHours(
                          startTime.getHours(),
                          startTime.getMinutes() + 1,
                          0,
                          0
                        );
                        return d;
                      })()}
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
