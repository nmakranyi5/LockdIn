import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";
import { colors } from "../../assets/colors/colors";

type AddTaskModalProps = {
  isVisible: boolean;
  onClose: () => void;
  onSave: (taskData: any) => void;
};

export default function AddTaskModal({
  isVisible,
  onClose,
  onSave,
}: AddTaskModalProps) {
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState("");
  const [time, setTime] = useState(new Date());
  const [date, setDate] = useState(new Date());
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<"date" | "time">("date");

  const onChange = (event: any, selectedTime: any) => {
    setTime(selectedTime);
    setShow(false);
  };

  const showMode = (modeToShow: "date" | "time") => {
    setShow(true);
    setMode(modeToShow);
  };

  return (
    <Modal animationType="fade" transparent visible={isVisible}>
        <KeyboardAvoidingView
  behavior={Platform.OS === "ios" ? "padding" : undefined}
  style={{ flex: 1 }}
>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.popup}>
              <View style={styles.header}>
                <Text style={styles.title}>Add Task</Text>
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
                <Text style={styles.label}>Start Time</Text>
                <TouchableOpacity
                  style={styles.inputBox}
                  onPress={() => showMode("time")}
                >
                  {show && (
                    <DateTimePicker
                      value={date}
                      mode={mode}
                      display="default"
                      onChange={onChange}
                    />
                  )}
                </TouchableOpacity>
                <Text style={styles.label}>Deadline</Text>
                <TouchableOpacity
                  style={styles.inputBox}
                  onPress={() => showMode("date")}
                >
                  {show && (
                    <DateTimePicker
                      value={date}
                      mode={mode}
                      display="default"
                      onChange={onChange}
                    />
                  )}
                </TouchableOpacity>
                <Text style={styles.label}>Frequency</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    placeholder="Enter time"
                    placeholderTextColor={colors.textLabel}
                    style={styles.input}
                    value={frequency}
                    onChangeText={setFrequency}
                  />
                </View>
              </View>
              <Pressable
                style={styles.saveButton}
                onPress={() => {
                  onSave({
                    title: title,
                    time: time,
                    date: date,
                    frequency: frequency,
                  });
                  onClose();
                }}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
