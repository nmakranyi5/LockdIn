import { StyleSheet, Text } from "react-native";
import { colors } from "../assets/colors/colors";
import { humanDuration, Task } from "./taskState";
import Button from "./ui/Button";
import ModalCard from "./ui/ModalCard";

type CheckInModalProps = {
  task: Task | undefined;
  now: number;
  onStillWorking: () => void;
  onDone: () => void;
};

// Shown when a running timer task has gone past its estimate, in case the
// person forgot to stop it.
export default function CheckInModal({
  task,
  now,
  onStillWorking,
  onDone,
}: CheckInModalProps) {
  const over =
    task?.startedAt && task.estimateMinutes
      ? now - (task.startedAt + task.estimateMinutes * 60_000)
      : 0;

  const estimate = task?.estimateMinutes
    ? humanDuration(task.estimateMinutes * 60_000)
    : "";
  const message = `“${task?.title || "Your task"}” is ${humanDuration(
    Math.max(0, over)
  )} past your ${estimate} estimate. Are you still on it, or did you forget to stop the timer?`;

  return (
    <ModalCard
      visible={!!task}
      title="Still working?"
      maxWidth={380}
      footer={
        <>
          <Button label="Still working" onPress={onStillWorking} />
          <Button label="I'm done" variant="secondary" onPress={onDone} />
        </>
      }
    >
      <Text style={styles.message}>{message}</Text>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  message: { fontSize: 16, lineHeight: 23, color: colors.textMuted },
});
