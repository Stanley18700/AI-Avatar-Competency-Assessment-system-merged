/**
 * Character/style pairs must match Microsoft standard avatars (real-time API).
 * @see https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech-avatar/standard-avatars
 * Using invalid pairs causes WebSocket 1007/1011 from the avatar service.
 * Microsoft docs currently exclude Lisa graceful/technical styles from the real-time API.
 */
export const AZURE_AVATAR_PRESETS = [
  { id: 'lisa-casual-sitting', character: 'lisa', style: 'casual-sitting', label: 'Lisa — สบายๆ' },
  { id: 'harry-business', character: 'harry', style: 'business', label: 'Harry — ธุรกิจ' },
  { id: 'lori-casual', character: 'lori', style: 'casual', label: 'Lori — สบายๆ' },
] as const;
