import { useLocation } from "wouter";

export default function WelcomePage() {
  const [, setLocation] = useLocation();

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <video
        autoPlay
        muted
        playsInline
        ref={(el) => { if (el) el.playbackRate = 2; }}
        onEnded={() => setLocation("/menu")}
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/splash-video.mov" type="video/mp4" />
      </video>
    </div>
  );
}
