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
          "Name your task and pick a type: Timer, Checklist or One & done.",
          "Set when it starts and its deadline. End of day sets 11:59 PM.",
          "Optionally set a priority and repeat. A timer estimate asks you to confirm early finishes and checks in if you run over.",
        ]}
      />
    </ModalCard>
  );
}
