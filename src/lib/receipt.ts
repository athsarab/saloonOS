import { Platform, Share } from 'react-native';
export async function shareReceipt(receipt: string) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
    await navigator.clipboard.writeText(receipt);
    return 'Receipt copied to clipboard.';
  }
  await Share.share({ title: 'SalonOS receipt', message: receipt });
  return 'Receipt ready to share.';
}
