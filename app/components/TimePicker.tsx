import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Button, Text, View } from "react-native";

export default function TimePickerTest() {
  const [time, setTime] = useState(new Date());
  const [open, setOpen] = useState(false);

  return (
    <View style={{ padding: 40 }}>
      <Text>Selected Time: {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>

      <Button title="Pick Time" onPress={() => setOpen(true)} />

      {open && (
        <DateTimePicker
          mode="time"
          value={time}
          onChange={(event, selected) => {
            setOpen(false);
            if (selected) setTime(selected);
          }}
        />
      )}
    </View>
  );
}
