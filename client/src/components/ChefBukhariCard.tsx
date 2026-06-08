import cardFrame from "@assets/Screenshot_2026-05-10_at_10.11.23_PM_1778440831420.png";

interface ChefBukhariCardProps {
  phone?: string;
  points?: number;
  sarValue?: number | string;
  customerName?: string;
  className?: string;
}

export default function ChefBukhariCard({
  phone,
  points = 0,
  sarValue,
  customerName,
  className = "",
}: ChefBukhariCardProps) {
  const displayPhone = phone
    ? phone.replace(/^\+?966|^00966/, "966").replace(/^0(\d{9})$/, "966$1")
    : "966XXXXXXXXX";

  const sarNum =
    typeof sarValue === "number"
      ? sarValue
      : typeof sarValue === "string"
      ? parseFloat(sarValue) || 0
      : points * 0.02;

  const displaySar = sarNum.toLocaleString("en-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      style={{
        width: "100%",
        aspectRatio: "85.6 / 53.98",
        borderRadius: 22,
        backgroundImage: `url(${cardFrame})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        boxShadow:
          "0 20px 60px rgba(0,0,0,0.30), 0 0 0 1px rgba(192,101,32,0.15)",
      }}
      data-testid="loyalty-card"
    >
      {/* Middle: Phone number + name */}
      <div
        style={{
          position: "absolute",
          top: "54%",
          left: "7%",
          right: "7%",
          transform: "translateY(-50%)",
        }}
      >
        <p
          dir="ltr"
          style={{
            color: "#7B3F1A",
            fontWeight: 700,
            fontSize: "clamp(11px, 3vw, 18px)",
            letterSpacing: "0.18em",
            margin: 0,
            fontFamily: "'Courier New', 'Trebuchet MS', monospace",
            textShadow: "0 1px 3px rgba(255,255,255,0.6)",
          }}
          data-testid="text-phone-display"
        >
          {displayPhone}
        </p>
        {customerName && (
          <p
            style={{
              color: "#A0522D",
              fontSize: "clamp(7px, 1.6vw, 11px)",
              margin: "5px 0 0",
              letterSpacing: "0.12em",
              textShadow: "0 1px 3px rgba(255,255,255,0.5)",
              textTransform: "uppercase",
            }}
          >
            {customerName}
          </p>
        )}
      </div>

      {/* Bottom: Points + SAR */}
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          left: "7%",
          right: "7%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              color: "#A0522D",
              fontSize: "clamp(5px, 1.3vw, 8px)",
              letterSpacing: "0.35em",
              margin: 0,
              textTransform: "uppercase",
              textShadow: "0 1px 3px rgba(255,255,255,0.5)",
            }}
          >
            نقاط
          </p>
          <p
            style={{
              color: "#7B3F1A",
              fontWeight: 900,
              fontSize: "clamp(20px, 5.2vw, 32px)",
              margin: 0,
              lineHeight: 1,
              textShadow: "0 2px 6px rgba(255,255,255,0.4)",
            }}
            data-testid="text-points"
          >
            {points.toLocaleString()}
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <p
            style={{
              color: "#A0522D",
              fontSize: "clamp(5px, 1.3vw, 8px)",
              letterSpacing: "0.25em",
              margin: 0,
              textTransform: "uppercase",
              textShadow: "0 1px 3px rgba(255,255,255,0.5)",
            }}
          >
            الرصيد
          </p>
          <p
            style={{
              color: "#7B3F1A",
              fontSize: "clamp(10px, 2.4vw, 14px)",
              margin: 0,
              fontFamily: "monospace",
              letterSpacing: "0.04em",
              textShadow: "0 1px 4px rgba(255,255,255,0.4)",
            }}
            data-testid="text-sar-value"
          >
            {displaySar} ر.س
          </p>
        </div>
      </div>
    </div>
  );
}
