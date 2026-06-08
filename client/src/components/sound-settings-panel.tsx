import { useState, useCallback } from "react";
import { Volume2, VolumeX, Play, ShoppingCart, Globe, Car, Bell, Zap, Music } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type SoundChannel,
  type ChannelSoundConfig,
  type NotificationSoundType,
  getChannelConfig,
  setChannelConfig,
  testSound,
  initAudioUnlock,
} from "@/lib/notification-sounds";
import { useTranslate } from "@/lib/useTranslate";

interface ChannelRow {
  key: SoundChannel;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  icon: React.ReactNode;
  color: string;
}

const CHANNELS: ChannelRow[] = [
  {
    key: "manual",
    labelAr: "طلبات نقطة البيع اليدوية",
    labelEn: "Manual POS Orders",
    descAr: "الطلبات التي يسجلها الكاشير مباشرة من الشاشة",
    descEn: "Orders placed directly by cashier at the POS screen",
    icon: <ShoppingCart className="w-4 h-4" />,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  {
    key: "online",
    labelAr: "الطلبات الأونلاين",
    labelEn: "Online Orders",
    descAr: "الطلبات الواردة عبر تطبيق العميل أو الموقع",
    descEn: "Orders coming from the customer app or website",
    icon: <Globe className="w-4 h-4" />,
    color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  {
    key: "car",
    labelAr: "طلبات السيارات (كيرب سايد)",
    labelEn: "Car Pickup Orders",
    descAr: "تنبيه وصول السيارة للاستلام أمام الفرع",
    descEn: "Alert for car arrival for curbside pickup",
    icon: <Car className="w-4 h-4" />,
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
];

const SOUND_OPTIONS: { value: NotificationSoundType; labelAr: string; labelEn: string; icon: React.ReactNode }[] = [
  { value: "onlineOrderVoice", labelAr: "تنبيه أونلاين (MP4)", labelEn: "Online Alert (MP4)", icon: <Music className="w-3.5 h-3.5" /> },
  { value: "newOrder",         labelAr: "جرس (تينج تينج)",      labelEn: "Bell (Ting Ting)",   icon: <Bell className="w-3.5 h-3.5" /> },
  { value: "cashierOrder",     labelAr: "بيب مزدوج",            labelEn: "Double Beep",         icon: <Zap className="w-3.5 h-3.5" /> },
  { value: "success",          labelAr: "صوت نجاح",             labelEn: "Success Tone",        icon: <Zap className="w-3.5 h-3.5" /> },
  { value: "alert",            labelAr: "صوت تحذير",            labelEn: "Alert Tone",          icon: <Zap className="w-3.5 h-3.5" /> },
  { value: "statusChange",     labelAr: "نبضة واحدة",           labelEn: "Single Pulse",        icon: <Zap className="w-3.5 h-3.5" /> },
];

interface ChannelCardProps {
  channel: ChannelRow;
  config: ChannelSoundConfig;
  onChange: (ch: SoundChannel, patch: Partial<ChannelSoundConfig>) => void;
}

function ChannelCard({ channel, config, onChange }: ChannelCardProps) {
  const tc = useTranslate();
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    await initAudioUnlock();
    await testSound(config.soundType, config.volume);
    setTesting(false);
  };

  return (
    <div
      className={`rounded-xl border-2 transition-all ${
        config.enabled
          ? "border-primary/30 bg-white dark:bg-gray-900"
          : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 opacity-70"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between p-3 pb-0">
        <div className="flex items-center gap-2.5">
          <span className={`p-1.5 rounded-lg ${channel.color}`}>{channel.icon}</span>
          <div>
            <p className="text-sm font-bold leading-tight">
              {tc(channel.labelAr, channel.labelEn)}
            </p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              {tc(channel.descAr, channel.descEn)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {config.enabled ? (
            <Volume2 className="w-4 h-4 text-primary" />
          ) : (
            <VolumeX className="w-4 h-4 text-muted-foreground" />
          )}
          <Switch
            checked={config.enabled}
            onCheckedChange={(val) => onChange(channel.key, { enabled: val })}
            data-testid={`switch-sound-${channel.key}`}
          />
        </div>
      </div>

      {/* Controls (only when enabled) */}
      {config.enabled && (
        <div className="p-3 pt-3 space-y-3">
          {/* Sound type */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-14 shrink-0">
              {tc("نوع الصوت", "Sound")}
            </span>
            <Select
              value={config.soundType}
              onValueChange={(val) => onChange(channel.key, { soundType: val as NotificationSoundType })}
            >
              <SelectTrigger
                className="h-8 text-xs flex-1"
                data-testid={`select-sound-type-${channel.key}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOUND_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      {opt.icon}
                      {tc(opt.labelAr, opt.labelEn)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-14 shrink-0">
              {tc("مستوى الصوت", "Volume")}
            </span>
            <Slider
              min={10}
              max={100}
              step={5}
              value={[Math.round(config.volume * 100)]}
              onValueChange={([v]) => onChange(channel.key, { volume: v / 100 })}
              className="flex-1"
              data-testid={`slider-volume-${channel.key}`}
            />
            <Badge variant="outline" className="text-xs w-10 justify-center shrink-0">
              {Math.round(config.volume * 100)}%
            </Badge>
          </div>

          {/* Test button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs gap-1.5"
            onClick={handleTest}
            disabled={testing}
            data-testid={`button-test-sound-${channel.key}`}
          >
            <Play className="w-3 h-3" />
            {testing ? tc("جاري التشغيل...", "Playing...") : tc("اختبار الصوت", "Test Sound")}
          </Button>
        </div>
      )}
    </div>
  );
}

export function SoundSettingsPanel() {
  const tc = useTranslate();

  const [configs, setConfigs] = useState<Record<SoundChannel, ChannelSoundConfig>>(() => ({
    manual: getChannelConfig("manual"),
    online: getChannelConfig("online"),
    car:    getChannelConfig("car"),
  }));

  const handleChange = useCallback((ch: SoundChannel, patch: Partial<ChannelSoundConfig>) => {
    setChannelConfig(ch, patch);
    setConfigs((prev) => ({
      ...prev,
      [ch]: { ...prev[ch], ...patch },
    }));
  }, []);

  const allMuted = !configs.manual.enabled && !configs.online.enabled && !configs.car.enabled;

  const toggleAll = () => {
    const next = allMuted;
    (["manual", "online", "car"] as SoundChannel[]).forEach((ch) =>
      handleChange(ch, { enabled: next })
    );
  };

  return (
    <div className="space-y-4">
      {/* Master toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {allMuted ? (
            <VolumeX className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Volume2 className="w-5 h-5 text-primary" />
          )}
          <div>
            <p className="text-sm font-bold">{tc("الصوت العام", "Master Sound")}</p>
            <p className="text-xs text-muted-foreground">
              {allMuted
                ? tc("جميع القنوات صامتة", "All channels muted")
                : tc("تحكم في كل قناة بشكل مستقل أدناه", "Control each channel independently below")}
            </p>
          </div>
        </div>
        <Button
          variant={allMuted ? "default" : "outline"}
          size="sm"
          onClick={toggleAll}
          className="text-xs shrink-0"
          data-testid="button-toggle-all-sound"
        >
          {allMuted ? tc("تشغيل الكل", "Enable All") : tc("كتم الكل", "Mute All")}
        </Button>
      </div>

      {/* Per-channel cards */}
      <div className="space-y-3">
        {CHANNELS.map((ch) => (
          <ChannelCard
            key={ch.key}
            channel={ch}
            config={configs[ch.key]}
            onChange={handleChange}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pb-1">
        {tc(
          "يتم حفظ هذه الإعدادات على هذا الجهاز تلقائياً",
          "These settings are saved automatically on this device"
        )}
      </p>
    </div>
  );
}
