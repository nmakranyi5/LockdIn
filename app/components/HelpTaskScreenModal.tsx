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
          "First, input a name for the task.",
          "Next, set the start date and time using the pickers.",
          "Then, set the deadline date and time with the pickers.",
          "Finally, hit the save button to finish managing the task.",
        ]}
      />
    </ModalCard>
  );
}
