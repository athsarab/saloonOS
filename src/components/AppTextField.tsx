import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputInstance, TextInputProps, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { control, iconSize, radius, spacing, type } from '../theme/tokens';

export type AppTextFieldProps = TextInputProps & {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  /** Adds a show/hide control to a password field. Implies secureTextEntry. */
  secureToggle?: boolean;
};

export const AppTextField = forwardRef<TextInputInstance, AppTextFieldProps>(function AppTextField(
  { label, required = false, error, hint, secureToggle, secureTextEntry, editable = true, onFocus, onBlur, style, ...props },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hidden = secureToggle ? !revealed : secureTextEntry;
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.borderStrong;

  return (
    <View style={styles.field}>
      <Text style={[type.label, { color: colors.text }]}>{label}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}</Text>
      <View style={[styles.box, { borderColor, backgroundColor: editable ? colors.input : colors.surfaceMuted }]}>
        <TextInput
          ref={ref}
          accessibilityLabel={required ? `${label}, required` : label}
          accessibilityHint={error ?? hint}
          editable={editable}
          placeholderTextColor={colors.inputPlaceholder}
          secureTextEntry={hidden}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          style={[styles.input, type.body, { color: editable ? colors.text : colors.textMuted }, style]}
          {...props}
        />
        {secureToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((value) => !value)}
            style={styles.toggle}
          >
            {revealed ? <EyeOff color={colors.textMuted} size={iconSize.md} /> : <Eye color={colors.textMuted} size={iconSize.md} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[type.caption, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[type.caption, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: spacing.xs + 2 },
  box: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', minHeight: control.input },
  input: { flex: 1, minHeight: control.input - 2, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm },
  toggle: { alignItems: 'center', height: control.input - 2, justifyContent: 'center', width: control.input - 2 },
});
