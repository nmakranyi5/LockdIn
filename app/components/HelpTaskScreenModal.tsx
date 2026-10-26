import Button from "../../components/ui/Button";
import HelpList from "../../components/ui/HelpList";
import ModalCard from "../../components/ui/ModalCard";

type HelpModalProps = {
  isVisible: boolean;
  onClose: () => void;
};

export default function HelpTaskScreenModal({
  isVisible,
  onClose,
}: HelpModalProps) {
  return (
    <ModalCard
      visible={isVisible}
      title="Tasks"
      footer={<Button label="Continue" onPress={onClose} />}
    >
      <HelpList
        items={[
          "Here, you can manage a task.",
          "First, input a name and pick a type: Timer, Checklist, or One & done.",
          "Next, set the start date and time using the pickers.",
          "Then, set the deadline date and time with the pickers.",
          "Set a priority and repeat if you like. Timer tasks can take an estimate: you'll be asked to confirm an early finish, and checked in on if you run over.",
        ]}
      />
    </ModalCard>
  );
}
