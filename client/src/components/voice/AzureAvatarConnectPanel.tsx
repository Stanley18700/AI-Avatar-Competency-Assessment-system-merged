import { Loader2, Video } from 'lucide-react';
import { AZURE_AVATAR_PRESETS } from './azureAvatarPresets';
import type { UseAzureTalkingAvatarReturn } from '../../hooks/useAzureTalkingAvatar';

interface AzureAvatarConnectPanelProps {
  azure: Pick<
    UseAzureTalkingAvatarReturn,
    | 'isConnected'
    | 'status'
    | 'connectError'
    | 'connect'
    | 'disconnect'
  >;
  azurePresetId: string;
  onPresetIdChange: (id: string) => void;
  azureVoiceGender: 'female' | 'male';
  onVoiceGenderChange: (g: 'female' | 'male') => void;
  disabled?: boolean;
}

export default function AzureAvatarConnectPanel({
  azure,
  azurePresetId,
  onPresetIdChange,
  azureVoiceGender,
  onVoiceGenderChange,
  disabled,
}: AzureAvatarConnectPanelProps) {
  return (
    <div className="mb-3 sm:mb-4 rounded-2xl border border-surface-200 bg-surface-50/80 p-3 sm:p-4 space-y-3">
      <div className="flex items-center gap-2 text-surface-800 font-semibold text-xs sm:text-sm">
        <Video className="w-4 h-4 text-primary-500 shrink-0" />
        <span>Avatar เสมือนจริง (Azure Speech — เสียงเคลื่อนไหวพร้อมกัน)</span>
      </div>
      {!azure.isConnected && (
        <p className="text-[10px] sm:text-xs text-surface-500 leading-snug">
          ต้องตั้งค่า AZURE_SPEECH_KEY / AZURE_SPEECH_REGION ที่เซิร์ฟเวอร์ และเปิดใช้ Talking Avatar ใน Azure
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-end">
        <label className="flex-1 min-w-0">
          <span className="block text-[10px] sm:text-xs text-surface-500 mb-1">ตัวละคร</span>
          <select
            className="input-field w-full !text-xs sm:!text-sm !py-2"
            value={azurePresetId}
            disabled={azure.isConnected || azure.status === 'connecting' || disabled}
            onChange={(e) => onPresetIdChange(e.target.value)}
          >
            {AZURE_AVATAR_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn-secondary !text-xs !py-2 !px-3 ${azureVoiceGender === 'female' ? 'ring-2 ring-primary-400' : ''}`}
            disabled={azure.isConnected || azure.status === 'connecting' || disabled}
            onClick={() => onVoiceGenderChange('female')}
          >
            เสียงผู้หญิง
          </button>
          <button
            type="button"
            className={`btn-secondary !text-xs !py-2 !px-3 ${azureVoiceGender === 'male' ? 'ring-2 ring-primary-400' : ''}`}
            disabled={azure.isConnected || azure.status === 'connecting' || disabled}
            onClick={() => onVoiceGenderChange('male')}
          >
            เสียงผู้ชาย
          </button>
        </div>
        <button
          type="button"
          className="btn-primary !text-xs sm:!text-sm !py-2.5 whitespace-nowrap shrink-0"
          disabled={disabled || azure.status === 'connecting'}
          onClick={() => {
            if (azure.isConnected) {
              void azure.disconnect();
            } else {
              void azure.connect();
            }
          }}
        >
          {azure.status === 'connecting' ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              กำลังเชื่อมต่อ…
            </span>
          ) : azure.isConnected ? (
            'ตัดการเชื่อมต่อ Avatar'
          ) : (
            'เชื่อมต่อ Avatar'
          )}
        </button>
      </div>
      {azure.connectError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{azure.connectError}</p>
      )}
    </div>
  );
}
