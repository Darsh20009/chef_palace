import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const logoPath = path.join(root, "attached_assets/qirox-logo-customer.png");
const logoStaffPath = path.join(root, "attached_assets/qirox-logo-staff.png");
const outDir = path.join(root, "public");

const BG = "#0D0D0D";
const GREEN = "#2D9B6E";

async function makeIcon(srcPath, size, outputPath, { maskable = false, bg = BG } = {}) {
  const padding = maskable ? Math.round(size * 0.18) : Math.round(size * 0.14);
  const logoSize = size - padding * 2;

  const logo = await sharp(srcPath)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const background = {
    r: parseInt(bg.slice(1, 3), 16),
    g: parseInt(bg.slice(3, 5), 16),
    b: parseInt(bg.slice(5, 7), 16),
    alpha: 255,
  };

  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  console.log(`✓ ${path.basename(outputPath)} (${size}x${size})`);
}

const customerSizes = [16, 32, 48, 57, 60, 72, 76, 96, 114, 120, 144, 152, 167, 180, 192, 512, 1024];
const staffSizes = [192, 512];

console.log("\n🎨 Generating QIROX customer icons...");
for (const size of customerSizes) {
  const name = size === 192 ? "logo-192" : size === 512 ? "logo-512" : `icon-${size}`;
  await makeIcon(logoPath, size, path.join(outDir, `${name}.png`));
}

await makeIcon(logoPath, 192, path.join(outDir, "logo-192.png"), { maskable: true });
await makeIcon(logoPath, 512, path.join(outDir, "logo-512.png"), { maskable: true });
await makeIcon(logoPath, 180, path.join(outDir, "apple-touch-icon.png"));

console.log("\n🎨 Generating QIROX staff icons...");
for (const size of staffSizes) {
  const name = size === 192 ? "employee-logo-192" : "employee-logo-512";
  await makeIcon(logoStaffPath, size, path.join(outDir, `${name}.png`));
}
await makeIcon(logoStaffPath, 192, path.join(outDir, "employee-logo-192.png"), { maskable: true });
await makeIcon(logoStaffPath, 512, path.join(outDir, "employee-logo-512.png"), { maskable: true });

console.log("\n✅ All icons generated successfully!\n");
