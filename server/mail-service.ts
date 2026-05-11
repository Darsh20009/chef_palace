import nodemailer from "nodemailer";
import { appendOrderToSheet } from "./google-sheets";

let transporter: any = null;
let transporterInitialized = false;

async function loadSmtpSecrets() {
  return {
    smtpHost: process.env.SMTP_HOST || "mail.smtp2go.com",
    smtpPort: parseInt(process.env.SMTP_PORT || "587"),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    smtp2goApiKey: process.env.SMTP2GO_API_KEY,
    smtpFrom: process.env.SMTP_FROM || "noreply@chefsplace.online",
  };
}

// SMTP2GO HTTP API — works on any host (port 443, never blocked)
async function sendViaSMTP2GOApi(options: {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}): Promise<boolean> {
  const apiKey = process.env.SMTP2GO_API_KEY;
  if (!apiKey) return false;

  const toList = Array.isArray(options.to) ? options.to : [options.to];
  const payload = {
    api_key: apiKey,
    sender: options.from,
    to: toList,
    subject: options.subject,
    html_body: options.html || "",
    text_body: options.text || "",
  };

  try {
    const res = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data: any = await res.json();
    if (data?.data?.succeeded === 1) {
      return true;
    }
    console.warn("⚠️ SMTP2GO API response:", JSON.stringify(data));
    return false;
  } catch (err: any) {
    console.error("❌ SMTP2GO API error:", err.message);
    return false;
  }
}

async function getTransporter() {
  if (transporterInitialized) return transporter;

  const { smtpHost, smtpPort, smtpUser, smtpPass, smtp2goApiKey } = await loadSmtpSecrets();

  const isProduction = process.env.NODE_ENV === "production";
  console.log(`📧 Mail service initializing [${isProduction ? "PRODUCTION" : "DEVELOPMENT"}]:`);
  console.log("   SMTP_HOST:", smtpHost ? `✅ ${smtpHost}` : "❌");
  console.log("   SMTP_PORT:", smtpPort);
  console.log("   SMTP_USER:", smtpUser ? "✅" : "❌");
  console.log("   SMTP_PASS:", smtpPass ? "✅" : "❌");
  console.log("   SMTP2GO_API_KEY:", smtp2goApiKey ? "✅ (will use HTTP API)" : "❌");

  if (!smtpUser || !smtpPass) {
    console.warn("⚠️ SMTP credentials not configured. Email via SMTP disabled.");
    transporterInitialized = true;
    return null;
  }

  try {
    console.log(`📧 Creating SMTP transporter for ${smtpHost}:${smtpPort}`);
    const options: any = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false, minVersion: "TLSv1.2" },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
    };
    if (smtpPort === 587) {
      options.requireTLS = true;
      options.secure = false;
    }
    transporter = nodemailer.createTransport(options);
    transporterInitialized = true;
    console.log("✅ SMTP transporter created");

    transporter.verify().then(() => {
      console.log("✅ SMTP connection verified");
    }).catch((err: any) => {
      console.warn("⚠️ SMTP verify failed (may still work for sending):", err.message);
    });
  } catch (error: any) {
    console.error("❌ Error creating SMTP transporter:", error.message);
    transporterInitialized = true;
  }

  return transporter;
}

// Central send function: tries SMTP2GO API first, falls back to SMTP
async function sendMail(options: {
  from?: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<boolean> {
  const from = options.from || process.env.SMTP_FROM || "noreply@chefsplace.online";

  // 1. Try HTTP API (works on Render, Vercel, etc.)
  if (process.env.SMTP2GO_API_KEY) {
    const sent = await sendViaSMTP2GOApi({ ...options, from });
    if (sent) return true;
    console.warn("⚠️ SMTP2GO API failed, falling back to SMTP...");
  }

  // 2. Fall back to SMTP
  const transport = await getTransporter();
  if (!transport) {
    console.warn("⚠️ No email transport available. Email not sent.");
    return false;
  }
  try {
    const info = await transport.sendMail({ from, ...options });
    console.log(`✅ Mail sent via SMTP. MessageID: ${info.messageId}`);
    return true;
  } catch (err: any) {
    console.error("❌ SMTP send error:", err.message);
    return false;
  }
}

export async function checkMailServiceHealth(): Promise<{ healthy: boolean; message: string }> {
  if (process.env.SMTP2GO_API_KEY) {
    return { healthy: true, message: "SMTP2GO API key configured" };
  }
  try {
    const transport = await getTransporter();
    if (!transport) return { healthy: false, message: "SMTP credentials not configured" };
    await transport.verify();
    return { healthy: true, message: "SMTP connection verified" };
  } catch (error: any) {
    return { healthy: false, message: `SMTP error: ${error.message}` };
  }
}

export async function sendOrderNotificationEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  orderStatus: string,
  orderTotal: number,
  originalOrder?: any
) {
  const statusAr =
    orderStatus === "completed" ? "مكتمل" :
    orderStatus === "preparing" || orderStatus === "in_progress" ? "قيد التحضير" :
    orderStatus === "ready" ? "جاهز" :
    orderStatus === "cancelled" ? "ملغي" : "قيد المعالجة";

  const statusColor =
    orderStatus === "completed" ? "#4CAF50" :
    orderStatus === "ready" ? "#2196F3" :
    orderStatus === "in_progress" || orderStatus === "preparing" ? "#FF9800" :
    orderStatus === "cancelled" ? "#f44336" : "#9C27B0";

  const message =
    orderStatus === "completed" ? "شكراً لك! طلبك جاهز للاستلام الآن. نتمنى أن تستمتع بقهوتك!" :
    orderStatus === "ready" ? "تمام! طلبك أصبح جاهزاً. تفضل للاستلام من الفرع." :
    orderStatus === "in_progress" || orderStatus === "preparing" ? "قيد الإعداد - فريقنا يحضر طلبك الآن بعناية." :
    orderStatus === "cancelled" ? "تم إلغاء طلبك. إذا كان لديك أي استفسار، تواصل معنا." :
    "قيد المعالجة - سيتم تحديثك قريباً.";

  return sendMail({
    to: customerEmail,
    subject: `تحديث طلبك - ${orderId}`,
    text: `مرحباً ${customerName}\n\nرقم الطلب: ${orderId}\nالحالة: ${statusAr}\nالمبلغ: ${orderTotal} ريال\n\n${message}\n\nمكان الشيف البخاري`,
    html: `
      <html dir="rtl" lang="ar">
      <head><meta charset="UTF-8">
      <style>
        body{font-family:Arial,sans-serif;margin:0;padding:0;background:#f5f5f5;}
        .wrap{background:#f5f5f5;padding:20px;}
        .box{max-width:500px;margin:0 auto;background:#fff;padding:30px;}
        .hdr{text-align:center;border-bottom:2px solid #8B5A2B;padding-bottom:20px;margin-bottom:20px;}
        .hdr h1{color:#8B5A2B;font-size:28px;margin:10px 0;}
        .status{background:${statusColor};color:#fff;padding:20px;text-align:center;margin:20px 0;border-radius:5px;}
        .status-val{font-size:24px;font-weight:bold;}
        .details{background:#f9f9f9;padding:15px;margin:20px 0;border-right:3px solid #8B5A2B;}
        .msg{background:#faf5f0;padding:15px;margin:20px 0;border-radius:5px;color:#5c3d2e;font-size:14px;line-height:1.5;}
        .ftr{border-top:1px solid #e0e0e0;padding-top:15px;font-size:12px;color:#888;text-align:center;margin-top:20px;}
      </style></head>
      <body><div class="wrap"><div class="box">
        <div class="hdr"><img src="https://www.chefsplace.online/logo.png" alt="مكان الشيف البخاري" style="width:120px;height:auto;margin-bottom:8px;" /><h1 style="color:#C06520;font-size:22px;margin:0;">مكان الشيف البخاري</h1><p style="color:#666;font-size:13px;">مطعم البخاري الأصيل في الرياض</p></div>
        <p style="font-size:16px;color:#333;">مرحباً ${customerName}!</p>
        <div class="status">
          <div style="font-size:12px;margin-bottom:10px;">حالة الطلب</div>
          <div class="status-val">${statusAr}</div>
        </div>
        <div class="details">
          <div style="padding:8px 0;"><div style="color:#888;font-size:12px;font-weight:bold;">رقم الطلب</div><div style="color:#333;font-size:16px;font-weight:bold;">${orderId}</div></div>
          <div style="padding:8px 0;margin-top:10px;"><div style="color:#888;font-size:12px;font-weight:bold;">المبلغ الإجمالي</div><div style="color:#333;font-size:16px;font-weight:bold;">${orderTotal} ريال</div></div>
        </div>
        <div class="msg">${message}</div>
        <div class="ftr"><p>© 2025 مكان الشيف البخاري - جميع الحقوق محفوظة</p><p>هذا البريد مرسل تلقائياً. يرجى عدم الرد.</p></div>
      </div></div></body></html>
    `,
  });
}

export async function sendReferralEmail(
  customerEmail: string,
  customerName: string,
  referralCode: string
) {
  return sendMail({
    to: customerEmail,
    subject: "انضم إلى برنامج الإحالات الخاص بنا",
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;">
        <h2>مرحباً ${customerName}</h2>
        <p>شارك رمز الإحالة الخاص بك واحصل على نقاط!</p>
        <div style="background:#4CAF50;color:#fff;padding:20px;border-radius:5px;margin:20px 0;text-align:center;">
          <p style="font-size:24px;font-weight:bold;margin:0;">${referralCode}</p>
        </div>
        <p>احصل على <strong>50 نقطة</strong> لكل صديق تحيله بنجاح!</p>
      </div>
    `,
  });
}

export async function sendLoyaltyPointsEmail(
  customerEmail: string,
  customerName: string,
  pointsEarned: number,
  totalPoints: number
) {
  return sendMail({
    to: customerEmail,
    subject: "لقد حصلت على نقاط جديدة!",
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;">
        <h2>مبروك ${customerName}!</h2>
        <div style="background:#FFD700;padding:15px;border-radius:5px;margin:20px 0;">
          <p style="font-size:18px;"><strong>النقاط المكتسبة:</strong> +${pointsEarned}</p>
          <p style="font-size:18px;"><strong>إجمالي النقاط:</strong> ${totalPoints}</p>
        </div>
        <p>استخدم نقاطك للحصول على خصومات رائعة!</p>
      </div>
    `,
  });
}

export async function sendPromotionEmail(
  customerEmail: string,
  customerName: string,
  subject: string,
  promotionDescription: string,
  discountCode?: string
) {
  return sendMail({
    to: customerEmail,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;">
        <h2 style="color:#8B5A2B;">مرحباً ${customerName}</h2>
        <p>${promotionDescription}</p>
        ${discountCode ? `
          <div style="background:#f0f0f0;padding:15px;border-radius:5px;text-align:center;margin:20px 0;">
            <p>استخدم رمز الخصم هذا:</p>
            <p style="font-size:24px;font-weight:bold;color:#8B5A2B;margin:0;">${discountCode}</p>
          </div>
        ` : ""}
        <div style="margin-top:20px;border-top:1px solid #eee;padding-top:10px;font-size:12px;color:#888;">
          تم الإرسال بواسطة نظام مكان الشيف البخاري
        </div>
      </div>
    `,
  });
}

export async function sendReservationConfirmationEmail(
  customerEmail: string,
  customerName: string,
  tableNumber: string,
  reservationDate: string,
  reservationTime: string,
  numberOfGuests: number,
  expiryTime: string
) {
  const formattedDate = new Date(reservationDate).toLocaleDateString("ar");
  const formattedExpiry = new Date(expiryTime).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });

  return sendMail({
    to: customerEmail,
    subject: `تأكيد حجزك - طاولة ${tableNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;border:1px solid #eee;border-radius:10px;">
        <h2 style="color:#8B5A2B;">مرحباً ${customerName}</h2>
        <p>تم تأكيد حجزك في مكان الشيف البخاري!</p>
        <div style="background:#f9f9f9;padding:20px;border-radius:8px;margin:20px 0;border-right:5px solid #8B5A2B;">
          <p><strong>رقم الطاولة:</strong> ${tableNumber}</p>
          <p><strong>التاريخ:</strong> ${formattedDate}</p>
          <p><strong>الوقت:</strong> ${reservationTime}</p>
          <p><strong>عدد الضيوف:</strong> ${numberOfGuests}</p>
          <p style="color:#FF6B6B;"><strong>ينتهي الحجز في:</strong> ${formattedExpiry}</p>
        </div>
        <p style="color:#666;font-size:14px;"><strong>ملاحظة:</strong> الطاولة محجوزة لمدة ساعة واحدة.</p>
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
        <p style="font-size:12px;color:#999;">شكراً لاختيارك مكان الشيف البخاري!</p>
      </div>
    `,
  });
}

export async function sendReservationExpiryWarningEmail(
  customerEmail: string,
  customerName: string,
  tableNumber: string,
  expiryTime: string
) {
  const formattedExpiry = new Date(expiryTime).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });

  return sendMail({
    to: customerEmail,
    subject: `⏰ تذكير: حجزك سينتهي بعد 15 دقيقة`,
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;border:2px solid #FF6B6B;border-radius:10px;">
        <h2 style="color:#FF6B6B;">تنبيه!</h2>
        <p>مرحباً ${customerName}</p>
        <div style="background:#FFE5E5;padding:20px;border-radius:8px;margin:20px 0;">
          <p><strong>حجزك في الطاولة رقم ${tableNumber}</strong> سينتهي في:</p>
          <p style="font-size:24px;color:#FF6B6B;font-weight:bold;margin:10px 0;">${formattedExpiry}</p>
        </div>
        <p>يمكنك تمديد الحجز لساعة إضافية من التطبيق الآن!</p>
        <p style="font-size:12px;color:#999;">هذا البريد مرسل تلقائياً، يرجى عدم الرد.</p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(customerEmail: string, customerName: string) {
  return sendMail({
    to: customerEmail,
    subject: "أهلاً بك في مكان الشيف البخاري! ☕",
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;">
        <h2 style="color:#8B5A2B;">مرحباً ${customerName}</h2>
        <p>يسعدنا انضمامك إلينا في عائلة مكان الشيف البخاري.</p>
        <p>يمكنك الآن البدء في طلب قهوتك المفضلة وجمع النقاط مع كل طلب!</p>
        <p>نتطلع لخدمتك قريباً!</p>
      </div>
    `,
  });
}

export async function sendAbandonedCartEmail(customerEmail: string, customerName: string) {
  return sendMail({
    to: customerEmail,
    subject: "نسيت شيئاً في عربتك؟ 🛒",
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;">
        <h2 style="color:#8B5A2B;">مرحباً ${customerName}</h2>
        <p>لاحظنا أنك تركت بعض الأصناف الرائعة في عربة التسوق الخاصة بك.</p>
        <p>لا تدع قهوتك تبرد! عد الآن وأكمل طلبك.</p>
      </div>
    `,
  });
}

export async function testEmailConnection(): Promise<boolean> {
  if (process.env.SMTP2GO_API_KEY) return true;
  try {
    const transport = await getTransporter();
    if (!transport) return false;
    await transport.verify();
    return true;
  } catch {
    return false;
  }
}

export async function sendPointsVerificationEmail(
  customerEmail: string,
  customerName: string,
  code: string,
  points: number,
  valueSAR: number
) {
  return sendMail({
    to: customerEmail,
    subject: "رمز التحقق لاستبدال نقاطك",
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;">
        <h2 style="color:#8B5A2B;">مرحباً ${customerName}</h2>
        <p>تم طلب استبدال <strong>${points} نقطة</strong> بقيمة <strong>${valueSAR.toFixed(2)} ريال</strong>.</p>
        <div style="background:#8B5A2B;color:#fff;padding:20px;border-radius:8px;text-align:center;margin:20px 0;">
          <p style="margin:0;font-size:13px;opacity:.8;">رمز التحقق</p>
          <p style="font-size:36px;font-weight:bold;letter-spacing:8px;margin:10px 0;">${code}</p>
          <p style="margin:0;font-size:12px;opacity:.7;">صالح لمدة 5 دقائق</p>
        </div>
        <p style="color:#666;font-size:13px;">إذا لم تطلب هذا الرمز، تجاهل هذا البريد.</p>
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
        <p style="font-size:12px;color:#999;">© 2025 مكان الشيف البخاري</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  customerEmail: string,
  customerName: string,
  token: string,
  resetUrl: string
) {
  return sendMail({
    to: customerEmail,
    subject: "إعادة تعيين كلمة المرور — مكان الشيف البخاري",
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;max-width:500px;margin:0 auto;">
        <h2 style="color:#8B5A2B;">مرحباً ${customerName} 👋</h2>
        <p>تلقّينا طلباً لإعادة تعيين كلمة مرورك في تطبيق مكان الشيف.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${resetUrl}" style="background:#8B5A2B;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
            إعادة تعيين كلمة المرور
          </a>
        </div>
        <p style="color:#666;font-size:13px;">هذا الرابط صالح لمدة ساعة واحدة فقط.</p>
        <p style="color:#999;font-size:12px;">إذا لم تطلب إعادة التعيين، تجاهل هذا البريد الإلكتروني.</p>
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
        <p style="font-size:12px;color:#999;">© 2025 مكان الشيف البخاري</p>
      </div>
    `,
  });
}

export async function sendOTPEmail(
  customerEmail: string,
  customerName: string,
  otp: string
) {
  return sendMail({
    to: customerEmail,
    subject: "رمز التحقق OTP — مكان الشيف البخاري",
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;max-width:500px;margin:0 auto;">
        <h2 style="color:#8B5A2B;">مرحباً ${customerName} 👋</h2>
        <p>رمز التحقق الخاص بك لتسجيل الدخول إلى مكان الشيف:</p>
        <div style="background:#8B5A2B;color:#fff;padding:20px;border-radius:8px;text-align:center;margin:20px 0;">
          <p style="margin:0;font-size:13px;opacity:.8;">رمز OTP</p>
          <p style="font-size:40px;font-weight:bold;letter-spacing:10px;margin:10px 0;">${otp}</p>
          <p style="margin:0;font-size:12px;opacity:.7;">صالح لمدة 10 دقائق</p>
        </div>
        <p style="color:#999;font-size:12px;">إذا لم تطلب هذا الرمز، تجاهل هذا البريد الإلكتروني.</p>
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
        <p style="font-size:12px;color:#999;">© 2025 مكان الشيف البخاري</p>
      </div>
    `,
  });
}

// Abandoned cart checker
setInterval(async () => {
  try {
    const { CartItemModel } = await import("@shared/schema");
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const abandonedCarts = await CartItemModel.find({
      createdAt: { $gte: twoHoursAgo, $lte: oneHourAgo },
    }).distinct("sessionId");
    if (abandonedCarts.length > 0) {
      console.log(`[CART] ${abandonedCarts.length} potentially abandoned cart(s) detected.`);
    }
  } catch {
    // Non-critical background task
  }
}, 30 * 60 * 1000);
