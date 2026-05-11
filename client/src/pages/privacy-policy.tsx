import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/">
          <button className="flex items-center gap-2 text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors">
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </button>
        </Link>

        <div className="space-y-8">
          <div className="text-center border-b pb-8">
            <h1 className="text-3xl font-bold mb-2">سياسة الخصوصية</h1>
            <p className="text-muted-foreground text-sm">Privacy Policy — مكان الشيف البخاري</p>
            <p className="text-xs text-muted-foreground mt-1">آخر تحديث: مايو 2026</p>
          </div>

          {/* Arabic */}
          <div className="space-y-6 text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold mb-2">١. المقدمة</h2>
              <p>
                مرحباً بك في تطبيق مكان الشيف البخاري. نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية.
                تصف هذه السياسة كيفية جمع معلوماتك واستخدامها وحمايتها عند استخدام تطبيقنا وموقعنا الإلكتروني.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">٢. المعلومات التي نجمعها</h2>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>الاسم ورقم الجوال عند إنشاء الحساب أو تسجيل الطلب</li>
                <li>بيانات الطلبات والمشتريات وتفضيلاتك</li>
                <li>موقعك الجغرافي عند طلب التوصيل (بإذنك فقط)</li>
                <li>صور إيصالات الدفع عند رفعها (بإذنك فقط)</li>
                <li>بيانات جهازك (نوع المتصفح، نظام التشغيل) لأغراض تقنية</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">٣. كيف نستخدم معلوماتك</h2>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>معالجة طلباتك وتأكيدها</li>
                <li>إرسال إشعارات بحالة الطلب والعروض</li>
                <li>إدارة برنامج النقاط والولاء</li>
                <li>تحسين خدماتنا وتجربة المستخدم</li>
                <li>الامتثال للمتطلبات القانونية</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">٤. مشاركة المعلومات</h2>
              <p className="text-muted-foreground">
                لا نبيع بياناتك الشخصية لأي طرف ثالث. قد نشارك المعلومات مع:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-2">
                <li>مزودي خدمة الدفع (لإتمام المعاملات المالية)</li>
                <li>خدمات التوصيل (لإيصال طلباتك)</li>
                <li>الجهات الحكومية عند الطلب القانوني</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">٥. الكاميرا والموقع والصور</h2>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>الكاميرا:</strong> تُستخدم لمسح رموز QR لتأكيد الطلبات والولاء فقط</li>
                <li><strong>الموقع:</strong> يُستخدم لإيصال الطلبات وإيجاد الفروع القريبة فقط</li>
                <li><strong>مكتبة الصور:</strong> تُستخدم لرفع إيصالات الدفع فقط</li>
              </ul>
              <p className="text-muted-foreground mt-2">جميع هذه الأذونات اختيارية ويمكنك إلغاؤها في أي وقت من إعدادات جهازك.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">٦. حماية البيانات</h2>
              <p className="text-muted-foreground">
                نستخدم بروتوكول HTTPS المشفر لجميع الاتصالات. يتم تخزين بياناتك بأمان على خوادم محمية.
                لا نستخدم أي تشفير مخصص خارج نطاق HTTPS القياسي.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">٧. الاحتفاظ بالبيانات</h2>
              <p className="text-muted-foreground">
                نحتفظ ببياناتك طالما حسابك نشط. يمكنك طلب حذف حسابك وبياناتك بالتواصل معنا.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">٨. حقوقك</h2>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>الحق في الاطلاع على بياناتك الشخصية</li>
                <li>الحق في تصحيح البيانات غير الدقيقة</li>
                <li>الحق في حذف بياناتك</li>
                <li>الحق في إلغاء الاشتراك في الإشعارات</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">٩. التواصل معنا</h2>
              <p className="text-muted-foreground">
                لأي استفسار حول سياسة الخصوصية أو بياناتك:
              </p>
              <div className="mt-2 p-3 bg-muted rounded-lg text-muted-foreground">
                <p>مكان الشيف البخاري</p>
                <p>البريد الإلكتروني: <a href="mailto:cafe@chefsplace.online" className="text-primary underline">cafe@chefsplace.online</a></p>
                <p>الموقع: <a href="https://www.chefsplace.online" className="text-primary underline">www.chefsplace.online</a></p>
              </div>
            </section>
          </div>

          {/* Divider */}
          <div className="border-t pt-8" dir="ltr">
            <h2 className="text-xl font-bold mb-4 text-center">Privacy Policy (English)</h2>
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-foreground">1. Introduction.</strong> مكان الشيف البخاري ("we", "us") respects your privacy.
                This policy explains how we collect, use, and protect your personal information when you use our app or website.
              </p>
              <p>
                <strong className="text-foreground">2. Information We Collect.</strong> We collect your name, phone number, order history,
                location (for delivery, with permission), and payment receipts (with permission).
              </p>
              <p>
                <strong className="text-foreground">3. How We Use It.</strong> To process orders, send order-status notifications,
                manage loyalty points, and improve our services.
              </p>
              <p>
                <strong className="text-foreground">4. Camera, Location & Photos.</strong> Camera is used only for QR scanning.
                Location is used only for delivery and branch discovery. Photo library is used only for uploading payment receipts.
                All permissions are optional and can be revoked in your device settings at any time.
              </p>
              <p>
                <strong className="text-foreground">5. Data Sharing.</strong> We do not sell your data. We share information only with
                payment processors, delivery partners, and legal authorities when required by law.
              </p>
              <p>
                <strong className="text-foreground">6. Security.</strong> All communications are encrypted via HTTPS.
                We do not use non-exempt encryption. (<code>ITSAppUsesNonExemptEncryption = false</code>)
              </p>
              <p>
                <strong className="text-foreground">7. Your Rights.</strong> You may access, correct, or delete your data at any time
                by contacting us at <a href="mailto:cafe@chefsplace.online" className="text-primary underline">cafe@chefsplace.online</a>.
              </p>
              <p>
                <strong className="text-foreground">8. Contact.</strong> مكان الشيف البخاري ·{" "}
                <a href="mailto:cafe@chefsplace.online" className="text-primary underline">cafe@chefsplace.online</a>
              </p>
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground border-t pt-6">
            © 2026 مكان الشيف البخاري — جميع الحقوق محفوظة
          </div>
        </div>
      </div>
    </div>
  );
}
