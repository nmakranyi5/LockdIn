import { StyleSheet, Text } from "react-native";
import { colors } from "../assets/colors/colors";
import { repeatLabel } from "./taskMeta";
import { Repeat } from "./taskState";
import Button from "./ui/Button";
import ModalCard from "./ui/ModalCard";

type DeleteRepeatModalProps = {
  visible: boolean;
  repeat: Repeat;
  count: number;
  onDeleteOne: () => void;
  onDeleteAll: () => void;
  onCancel: () => void;
};

export default function DeleteRepeatModal({
  visible,
  repeat,
  count,
  onDeleteOne,
  onDeleteAll,
  onCancel,
}: DeleteRepeatModalProps) {
  return (
    <ModalCard
      visible={visible}
      title="Delete repeating task?"
      maxWidth={380}
      footer={
        <>
          <Button label="Delete this task only" variant="secondary" onPress={onDeleteOne} />
          <Button
            label={count > 1 ? `Delete all ${count} repeats` : "Delete all repeats"}
            variant="danger"
            onPress={onDeleteAll}
          />
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
        </>
      }
    >
      <Text style={styles.message}>
        This task repeats {repeatLabel(repeat).toLowerCase()}. Delete just this
        one and the series continues, or delete every occurrence.
      </Text>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  message: { fontSize: 16, lineHeight: 23, color: colors.textMuted },
});
