import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from "../../assets/colors/colors";

type Props = {
  isVisible: boolean;
  onClose: () => void;
};

export default function AddTaskModal({ isVisible, onClose }: Props) {
  return (
    <Modal animationType="fade" transparent={true} visible={isVisible}>
      <View style={styles.background}>
        <View style={styles.popUp}>
          <Text style={styles.title}>Add Task</Text>
          <Pressable onPress={onClose}>
            <MaterialIcons name="close" color="#fff" size={22} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  popUp: {
    width: "90%",
    backgroundColor: colors.card,
    padding: 20,
    borderRadius: 16,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: colors.accent,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff", 
    fontSize: 16,
    fontWeight: "bold",
    },
});
