import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing, type } from '../theme/tokens';

type ProfileAvatarProps = {
  name?: string;
  size?: number;
  onPress?: () => void;
};

export function ProfileAvatar({ name = 'SalonOS user', size = 44, onPress }: ProfileAvatarProps) {
  const { colors } = useTheme();
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
  const content = <Text style={[type.bodyStrong, { color: colors.primary }]}>{initials}</Text>;
  const style = [styles.avatar, { backgroundColor: colors.primarySoft, height: size, width: size }];
  if (!onPress) return <Pressable accessibilityRole="image" accessibilityLabel={`${name} profile avatar`} style={style}>{content}</Pressable>;
  return <Pressable accessibilityRole="button" accessibilityLabel="Edit profile avatar" onPress={onPress} style={style}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', borderRadius: radius.pill, justifyContent: 'center', padding: spacing.xs },
});
