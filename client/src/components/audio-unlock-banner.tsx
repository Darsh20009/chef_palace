import { useState, useEffect } from "react";
import { Volume2, VolumeX, Bell, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAudioUnlocked, initAudioUnlock, getSoundEnabled, setSoundEnabled, testSound } from "@/lib/notification-sounds";

interface AudioUnlockBannerProps {
  pageKey: string;
  soundEnabled: boolean;
  onToggleSound: (val: boolean) => void;
  compact?: boolean;
}

export function AudioUnlockBanner({ pageKey, soundEnabled, onToggleSound, compact = false }: AudioUnlockBannerProps) {
  const [unlocked, setUnlocked] = useState(isAudioUnlocked());
  const [checking, setChecking] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setUnlocked(isAudioUnlocked());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUnlock = async () => {
    setChecking(true);
    await initAudioUnlock();
    // Test play a soft sound to confirm unlock worked
    await testSound('success', 0.5);
    setUnlocked(isAudioUnlocked());
    setChecking(false);
  };

  const handleTest = async () => {
    if (testing) return;
    setTesting(true);
    if (!unlocked) await initAudioUnlock();
    await testSound('newOrder', 0.8);
    setUnlocked(isAudioUnlocked());
    setTesting(false);
  };

  const handleToggle = () => {
    const next = !soundEnabled;
    onToggleSound(next);
    setSoundEnabled(pageKey, next);
  };

  // Show unlock prompt if audio context not unlocked yet and sound is enabled
  if (!unlocked && soundEnabled) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleUnlock}
          disabled={checking}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-medium transition-colors"
          data-testid="button-unlock-audio"
        >
          <Bell className="w-3.5 h-3.5 animate-pulse" />
          {checking ? "جاري التفعيل..." : "اضغط لتفعيل الصوت"}
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleToggle}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
            soundEnabled
              ? "border-primary text-primary bg-primary/5"
              : "border-muted-foreground/30 text-muted-foreground"
          }`}
          data-testid="button-toggle-sound"
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          {soundEnabled ? "الصوت" : "صامت"}
        </button>
        {soundEnabled && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-1 px-2 py-1.5 rounded-full border border-muted-foreground/20 text-muted-foreground hover:text-primary hover:border-primary/40 text-xs transition-colors"
            title="اختبار الصوت"
            data-testid="button-test-sound"
          >
            <PlayCircle className={`w-3.5 h-3.5 ${testing ? 'animate-pulse text-primary' : ''}`} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        className={soundEnabled ? "border-primary text-primary" : "border-muted text-muted-foreground"}
        data-testid="button-toggle-sound"
      >
        {soundEnabled ? <Volume2 className="h-4 w-4 ml-1" /> : <VolumeX className="h-4 w-4 ml-1" />}
        {soundEnabled ? "الصوت" : "صامت"}
      </Button>
      {soundEnabled && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleTest}
          disabled={testing}
          className="text-muted-foreground hover:text-primary px-2"
          title="اختبار الصوت"
          data-testid="button-test-sound"
        >
          <PlayCircle className={`h-4 w-4 ${testing ? 'animate-pulse text-primary' : ''}`} />
        </Button>
      )}
    </div>
  );
}
