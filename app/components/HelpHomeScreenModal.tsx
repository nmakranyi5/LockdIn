import Button from "../../components/ui/Button";
import HelpList from "../../components/ui/HelpList";
import ModalCard from "../../components/ui/ModalCard";

type HelpModalProps = {
  isVisible: boolean;
  onClose: () => void;
};

export default function HelpHomeScreenModal({
  isVisible,
  onClose,
}: HelpModalProps) {
  return (
    <ModalCard
      visible={isVisible}
      title="Welcome!"
      footer={<Button label="Continue" onPress={onClose} />}
    >
      <HelpList
        items={[
          "With LockdIn, stay on top of your tasks and get things done.",
          "Use the arrows to switch tasks. Tap the pencil to edit or the trash to delete.",
          "Tap the ? to reopen this help screen, or the settings icon to manage the app.",
          "Hit the + button to create your first task and get started.",
        ]}
      />
    </ModalCard>
  );
}
