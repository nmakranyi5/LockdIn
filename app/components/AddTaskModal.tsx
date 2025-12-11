import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { colors } from "../../assets/colors/colors";

type AddTaskModalProps = {
  isVisible: boolean;
  onClose: () => void;
  onSave: (taskData: any) => void;
};


export default function AddTaskModal({ isVisible, onClose, onSave }: AddTaskModalProps) {
    const [text, setText] = useState('')
    return (
        <Modal animationType="fade" transparent visible={isVisible}>
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
                        <TextInput placeholder="Enter task name" placeholderTextColor={colors.textLabel}/>
                    </View>
                    <Text style={styles.label}>Time</Text>
                    <View style={styles.inputBox}>
                        <TextInput placeholder="Enter time" placeholderTextColor={colors.textLabel}/>
                    </View>
                    <Text style={styles.label}>Frequency</Text>
                    <View style={styles.inputBox}>
                        <TextInput placeholder="Enter time" placeholderTextColor={colors.textLabel}/>
                    </View>
                    <Text style={styles.label}>Deadline</Text>
                    <View style={styles.inputBox}>
                        <TextInput placeholder="Enter time" placeholderTextColor={colors.textLabel}/>
                    </View>
                </View>
                <Pressable 
                    style={styles.saveButton} 
                    onPress={() => {
                        onSave({});
                        onClose();  
                    }}>
                    <Text style={styles.saveButtonText}>Save</Text>
                </Pressable>
                </View>
            </TouchableWithoutFeedback>

            </View>
        </TouchableWithoutFeedback>
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
        marginTop: 16,
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
    },
    body: {
        marginTop: 12,
        gap: 8
    },
    saveButton: {
        backgroundColor: colors.accent,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
        marginTop: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#fff",
    },
});
