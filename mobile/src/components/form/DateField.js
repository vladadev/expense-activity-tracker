import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import Field from './Field';
import { formatLongDate } from '../../i18n/dateFormat';
import { space, radius, type, HIT } from '../../theme/scale';

// The date, and the native picker behind it.
//
// It was a TouchableOpacity wearing the text input's style — a thing that
// looked like a field you could type in and was not, which is the same fault
// the calendar's date row had: a control that works and does not say so, or
// says the wrong thing about how. It has a calendar glyph and a chevron now,
// so it reads as something that opens.
//
// Dates are formatted by hand through i18n/dateFormat. Hermes ships without
// full ICU, so toLocaleDateString falls back to English on the device while
// looking perfectly correct in a browser and in jest.
export default function DateField({ label, hint, error, value, onChange, maximumDate, minimumDate }) {
  const { theme } = useTheme();
  const { language } = useSettings();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [open, setOpen] = useState(false);

  return (
    <Field label={label} hint={hint} error={error}>
      <Pressable onPress={() => setOpen(true)} style={styles.row} accessibilityRole="button">
        <Ionicons name="calendar-outline" size={19} color={theme.textSecondary} />
        <Text style={styles.text} numberOfLines={1}>
          {formatLongDate(value.toISOString().slice(0, 10), language)}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      </Pressable>

      {open && (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={(event, selected) => {
            setOpen(false);
            if (selected) onChange(selected);
          }}
        />
      )}
    </Field>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm + 4,
      minHeight: HIT,
      paddingHorizontal: space.sm + 4,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    text: { flex: 1, ...type.body, color: theme.text },
  });
}
