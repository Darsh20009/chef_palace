import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import chefsplaceLogo from "@assets/blackrose-logo.png";
import { brand as sysBrand } from "@/lib/brand";

interface TableQRCardProps {
  tableNumber: string;
  qrToken: string;
  branchName: string;
  tableUrl: string;
}

const C = {
  black:    "#0a0a0a",
  darkBg:   "#111111",
  card:     "#161616",
  gold:     "#C9A96E",
  goldLight:"#E8D5A3",
  goldDark: "#A07840",
  white:    "#FFFFFF",
  offWhite: "#F5F0E8",
  muted:    "#888888",
  border:   "#2A2A2A",
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawGoldDivider(
  ctx: CanvasRenderingContext2D,
  cx: number, y: number,
  halfLen: number
) {
  const grad = ctx.createLinearGradient(cx - halfLen, y, cx + halfLen, y);
  grad.addColorStop(0,   "transparent");
  grad.addColorStop(0.3, C.gold);
  grad.addColorStop(0.5, C.goldLight);
  grad.addColorStop(0.7, C.gold);
  grad.addColorStop(1,   "transparent");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - halfLen, y);
  ctx.lineTo(cx + halfLen, y);
  ctx.stroke();

  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.arc(cx, y, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = C.goldDark;
  ctx.beginPath();
  ctx.arc(cx - 18, y, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 18, y, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawFloralSprig(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  scale: number,
  mirror: boolean,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (mirror) ctx.scale(-1, 1);

  const drawLeaf = (lx: number, ly: number, angle: number, len: number, color: string) => {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.25, -len * 0.5, len * 0.75, -len * 0.4, len, 0);
    ctx.bezierCurveTo(len * 0.75, len * 0.4, len * 0.25, len * 0.5, 0, 0);
    ctx.fill();
    ctx.restore();
  };

  const s = scale;
  drawLeaf(0, 0,   -0.4,  s * 45, C.gold + "99");
  drawLeaf(0, 0,   -0.9,  s * 35, C.goldDark + "77");
  drawLeaf(0, 0,    0.15, s * 40, C.gold + "66");
  drawLeaf(s * 15, -s * 12, -0.6, s * 28, C.goldLight + "55");
  drawLeaf(s * 8,   s * 10, 0.3,  s * 22, C.goldDark + "44");

  ctx.fillStyle = C.gold + "99";
  [[s * 22, -s * 18], [s * 30, -s * 8], [s * 16, -s * 28]].forEach(([bx, by]) => {
    ctx.beginPath();
    ctx.arc(bx, by, s * 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

export function TableQRCard({ tableNumber, qrToken, branchName, tableUrl }: TableQRCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const generateQRCard = async () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = 900;
      const H = 1300;
      canvas.width  = W;
      canvas.height = H;

      ctx.fillStyle = C.black;
      ctx.fillRect(0, 0, W, H);

      const bgGrad = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, H * 0.8);
      bgGrad.addColorStop(0, "#1a1710");
      bgGrad.addColorStop(0.5, "#111111");
      bgGrad.addColorStop(1, "#0a0a0a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      const goldGrad = ctx.createLinearGradient(0, 0, W, 0);
      goldGrad.addColorStop(0, C.goldDark);
      goldGrad.addColorStop(0.5, C.goldLight);
      goldGrad.addColorStop(1, C.goldDark);
      ctx.fillStyle = goldGrad;
      ctx.fillRect(0, 0, W, 4);
      ctx.fillRect(0, H - 4, W, 4);

      ctx.save();
      ctx.strokeStyle = C.gold + "40";
      ctx.lineWidth = 1;
      roundRect(ctx, 28, 28, W - 56, H - 56, 12);
      ctx.stroke();
      roundRect(ctx, 36, 36, W - 72, H - 72, 10);
      ctx.stroke();
      ctx.restore();

      drawFloralSprig(ctx, 60, 80,    1.0, false, 0.55);
      drawFloralSprig(ctx, W - 60, 80, 1.0, true,  0.55);
      drawFloralSprig(ctx, 60, H - 80, 1.0, false, 0.35);
      drawFloralSprig(ctx, W - 60, H - 80, 1.0, true, 0.35);

      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";

      const drawMain = (logoLoaded: boolean) => {
        const logoY  = 90;
        const logoSz = 160;
        const logoCX = W / 2;
        const logoCY = logoY + logoSz / 2;

        if (logoLoaded && logoImg.complete && logoImg.naturalWidth > 0) {
          const pad = 6;
          const r   = logoSz / 2 + pad;
          const circGrad = ctx.createRadialGradient(logoCX, logoCY, 0, logoCX, logoCY, r);
          circGrad.addColorStop(0, "#1a1a10");
          circGrad.addColorStop(1, "#0d0d0d");
          ctx.fillStyle = circGrad;
          ctx.beginPath();
          ctx.arc(logoCX, logoCY, r, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = C.gold;
          ctx.lineWidth   = 1.5;
          ctx.beginPath();
          ctx.arc(logoCX, logoCY, r + 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = C.goldDark + "55";
          ctx.lineWidth   = 1;
          ctx.beginPath();
          ctx.arc(logoCX, logoCY, r + 9, 0, Math.PI * 2);
          ctx.stroke();

          ctx.save();
          ctx.beginPath();
          ctx.arc(logoCX, logoCY, r, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(logoImg, logoCX - logoSz / 2, logoCY - logoSz / 2, logoSz, logoSz);
          ctx.restore();
        } else {
          ctx.fillStyle = "#1a1a10";
          ctx.beginPath();
          ctx.arc(logoCX, logoCY, logoSz / 2 + 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = C.gold;
          ctx.lineWidth   = 2;
          ctx.beginPath();
          ctx.arc(logoCX, logoCY, logoSz / 2 + 8, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = C.white;
          ctx.font      = `bold ${logoSz * 0.4}px 'Georgia', serif`;
          ctx.textAlign     = "center";
          ctx.textBaseline  = "middle";
          ctx.fillText("BR", logoCX, logoCY);
        }

        const nameY = logoCY + logoSz / 2 + 44;
        ctx.fillStyle     = C.white;
        ctx.font          = "bold 58px 'Georgia', 'Times New Roman', serif";
        ctx.textAlign     = "center";
        ctx.textBaseline  = "alphabetic";
        ctx.fillText("مكان الشيف البخاري", W / 2, nameY);

        ctx.fillStyle     = C.gold;
        ctx.font          = "22px 'Georgia', serif";
        ctx.letterSpacing = "8px";
        ctx.textAlign     = "center";
        ctx.fillText("C  A  F  E", W / 2, nameY + 34);
        ctx.letterSpacing = "0px";

        drawGoldDivider(ctx, W / 2, nameY + 66, 200);

        const tableBoxY = nameY + 90;
        const tableBoxH = 150;
        const tableBoxW = 420;
        const tableBoxX = (W - tableBoxW) / 2;

        const boxBg = ctx.createLinearGradient(tableBoxX, tableBoxY, tableBoxX + tableBoxW, tableBoxY + tableBoxH);
        boxBg.addColorStop(0, "#1c1a14");
        boxBg.addColorStop(0.5, "#201e16");
        boxBg.addColorStop(1, "#1c1a14");
        ctx.fillStyle = boxBg;
        roundRect(ctx, tableBoxX, tableBoxY, tableBoxW, tableBoxH, 12);
        ctx.fill();

        ctx.strokeStyle = C.gold + "60";
        ctx.lineWidth   = 1;
        roundRect(ctx, tableBoxX, tableBoxY, tableBoxW, tableBoxH, 12);
        ctx.stroke();

        const topBarGrad = ctx.createLinearGradient(tableBoxX, tableBoxY, tableBoxX + tableBoxW, tableBoxY);
        topBarGrad.addColorStop(0, C.goldDark + "00");
        topBarGrad.addColorStop(0.3, C.gold);
        topBarGrad.addColorStop(0.7, C.gold);
        topBarGrad.addColorStop(1, C.goldDark + "00");
        ctx.fillStyle = topBarGrad;
        roundRect(ctx, tableBoxX, tableBoxY, tableBoxW, 3, 12);
        ctx.fill();

        ctx.fillStyle    = C.muted;
        ctx.font         = "24px 'Georgia', serif";
        ctx.textAlign    = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("طاولة رقم  ·  TABLE", W / 2, tableBoxY + 44);

        const goldTextGrad = ctx.createLinearGradient(W / 2 - 80, 0, W / 2 + 80, 0);
        goldTextGrad.addColorStop(0, C.goldDark);
        goldTextGrad.addColorStop(0.5, C.goldLight);
        goldTextGrad.addColorStop(1, C.goldDark);
        ctx.fillStyle    = goldTextGrad;
        ctx.font         = "bold 96px 'Georgia', 'Times New Roman', serif";
        ctx.textAlign    = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(tableNumber, W / 2, tableBoxY + 135);

        drawQRSection(ctx, W, H, tableUrl, branchName);
      };

      logoImg.onload  = () => drawMain(true);
      logoImg.onerror = () => drawMain(false);
      logoImg.src     = chefsplaceLogo;
    };

    const drawQRSection = async (
      ctx: CanvasRenderingContext2D,
      W: number, H: number,
      tableUrl: string,
      branchName: string
    ) => {
      try {
        const finalUrl = tableUrl.replace(/https?:\/\/[^\/]+/, window.location.origin);

        const qrDataUrl = await QRCode.toDataURL(finalUrl, {
          width: 380,
          margin: 2,
          color: { dark: C.offWhite, light: "#00000000" },
          errorCorrectionLevel: "H",
        });

        const qrImg = new Image();
        qrImg.onload = () => {
          const qrSz = 360;
          const qrX  = (W - qrSz) / 2;
          const qrY  = 740;
          const pad  = 28;

          ctx.save();
          ctx.shadowColor   = C.gold + "30";
          ctx.shadowBlur    = 30;
          ctx.shadowOffsetY = 6;
          const qrBg = ctx.createLinearGradient(qrX - pad, qrY - pad, qrX + qrSz + pad, qrY + qrSz + pad);
          qrBg.addColorStop(0, "#1e1c14");
          qrBg.addColorStop(1, "#181610");
          ctx.fillStyle = qrBg;
          roundRect(ctx, qrX - pad, qrY - pad, qrSz + pad * 2, qrSz + pad * 2, 16);
          ctx.fill();
          ctx.restore();

          ctx.strokeStyle = C.gold + "50";
          ctx.lineWidth   = 1;
          roundRect(ctx, qrX - pad, qrY - pad, qrSz + pad * 2, qrSz + pad * 2, 16);
          ctx.stroke();

          const cornerL = 30;
          const cornerW = 3;
          const cX = qrX - pad, cY = qrY - pad;
          const cW = qrSz + pad * 2, cH = qrSz + pad * 2;
          const goldCorner = ctx.createLinearGradient(0, 0, 1, 1);
          goldCorner.addColorStop(0, C.goldLight);
          goldCorner.addColorStop(1, C.gold);
          ctx.fillStyle = goldCorner;
          [
            [cX, cY, cornerL, cornerW], [cX, cY, cornerW, cornerL],
            [cX + cW - cornerL, cY, cornerL, cornerW], [cX + cW - cornerW, cY, cornerW, cornerL],
            [cX, cY + cH - cornerW, cornerL, cornerW], [cX, cY + cH - cornerL, cornerW, cornerL],
            [cX + cW - cornerL, cY + cH - cornerW, cornerL, cornerW],
            [cX + cW - cornerW, cY + cH - cornerL, cornerW, cornerL],
          ].forEach(([rx, ry, rw, rh]) => ctx.fillRect(rx, ry, rw, rh));

          ctx.drawImage(qrImg, qrX, qrY, qrSz, qrSz);

          const ocx = W / 2;
          const ocy = qrY + qrSz / 2;
          const or  = 32;

          ctx.fillStyle = "#181610";
          ctx.beginPath();
          ctx.arc(ocx, ocy, or + 4, 0, Math.PI * 2);
          ctx.fill();

          const logoOverlay = new Image();
          logoOverlay.crossOrigin = "anonymous";
          logoOverlay.onload = () => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(ocx, ocy, or, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(logoOverlay, ocx - or, ocy - or, or * 2, or * 2);
            ctx.restore();

            ctx.strokeStyle = C.gold;
            ctx.lineWidth   = 1.5;
            ctx.beginPath();
            ctx.arc(ocx, ocy, or + 2, 0, Math.PI * 2);
            ctx.stroke();
          };
          logoOverlay.onerror = () => {
            const overlayGrad = ctx.createRadialGradient(ocx, ocy, 0, ocx, ocy, or);
            overlayGrad.addColorStop(0, "#201e14");
            overlayGrad.addColorStop(1, "#141210");
            ctx.fillStyle = overlayGrad;
            ctx.beginPath();
            ctx.arc(ocx, ocy, or, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = C.gold;
            ctx.lineWidth   = 1.5;
            ctx.beginPath();
            ctx.arc(ocx, ocy, or, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle    = C.gold;
            ctx.font         = "bold 18px 'Georgia', serif";
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("BR", ocx, ocy);
          };
          logoOverlay.src = chefsplaceLogo;

          const ctaY = qrY + qrSz + pad + 40;

          const ctaBtnW = 420;
          const ctaBtnH = 60;
          const ctaBtnX = (W - ctaBtnW) / 2;

          const ctaGrad = ctx.createLinearGradient(ctaBtnX, ctaY, ctaBtnX + ctaBtnW, ctaY);
          ctaGrad.addColorStop(0, C.goldDark);
          ctaGrad.addColorStop(0.5, C.gold);
          ctaGrad.addColorStop(1, C.goldDark);
          ctx.fillStyle = ctaGrad;
          roundRect(ctx, ctaBtnX, ctaY, ctaBtnW, ctaBtnH, 10);
          ctx.fill();

          ctx.fillStyle    = C.black;
          ctx.font         = "bold 30px 'Georgia', sans-serif";
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("امسح الكود للطلب", W / 2, ctaY + ctaBtnH / 2);

          ctx.fillStyle    = C.muted;
          ctx.font         = "20px 'Georgia', serif";
          ctx.textAlign    = "center";
          ctx.textBaseline = "alphabetic";
          ctx.fillText("Scan QR Code to Order", W / 2, ctaY + ctaBtnH + 34);

          drawGoldDivider(ctx, W / 2, ctaY + ctaBtnH + 62, 180);

          ctx.fillStyle    = C.offWhite;
          ctx.font         = "bold 28px 'Georgia', serif";
          ctx.textAlign    = "center";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(branchName, W / 2, ctaY + ctaBtnH + 96);

          ctx.fillStyle    = C.muted;
          ctx.font         = "14px 'Georgia', serif";
          ctx.textAlign    = "center";
          ctx.fillText(`Powered by ${sysBrand.platformNameEn}`, W / 2, H - 44);
        };
        qrImg.src = qrDataUrl;
      } catch (err) {
        console.error("QR generation failed:", err);
      }
    };

    generateQRCard();
  }, [tableNumber, qrToken, branchName, tableUrl]);

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        className="max-w-full h-auto rounded-lg shadow-2xl"
        style={{ background: "#0a0a0a" }}
      />
    </div>
  );
}

export function downloadQRCard(canvas: HTMLCanvasElement, tableNumber: string) {
  const link = document.createElement("a");
  link.download = `table-${tableNumber}-qr-card.png`;
  link.href     = canvas.toDataURL("image/png");
  link.click();
}
