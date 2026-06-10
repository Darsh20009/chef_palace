const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/thermal-printer-CIDwDsrL.js","assets/index-CwOLSL6J.js","assets/vendor-query-BgwjQ_Wi.js","assets/vendor-ui-Bcydj3qt.js","assets/vendor-utils-UagjiSbi.js","assets/index-BbFTGCRE.css"])))=>i.map(i=>d[i]);
import{al as z}from"./index-CwOLSL6J.js";import{a as L}from"./browser-BJzWpxwN.js";import"./vendor-query-BgwjQ_Wi.js";import"./vendor-ui-Bcydj3qt.js";import"./vendor-utils-UagjiSbi.js";const M=.15,U=new Map;function ue(e){const t=typeof e.total=="number"?e.total:parseFloat(String(e.total).replace(/[^0-9.-]/g,""))||0,o=t/(1+M),a=t-o,n=e.date?new Date(e.date).toISOString():new Date().toISOString(),s=`zatca:${e.orderNumber}:${t.toFixed(2)}`;if(U.has(s))return;const d=V({sellerName:A,vatNumber:e.vatNumber||O,timestamp:n,totalWithVat:t.toFixed(2),vatAmount:a.toFixed(2)});L.toString(d,{type:"svg",width:100,margin:1,errorCorrectionLevel:"M"}).then(r=>{const i=r.replace(/<\?xml[^?]*\?>/g,"").replace(/width="\d+"/,'width="100"').replace(/height="\d+"/,'height="100"');U.set(s,i)}).catch(()=>{})}function W(e){const t=String(e).trim(),o=t.replace(/\D/g,"");return o?`#${o.padStart(4,"0")}`:`#${t}`}function Y(e){const t=y(e.price??e.unitPrice);return t>0?t:y(e.coffeeItem.price)}function I(e){return e.selectedSize??e.customization?.selectedSize??void 0}function N(e){if(e.customization?.selectedItemAddons?.length)return e.customization.selectedItemAddons;const t=e.customization?.addons;return Array.isArray(t)&&t.length?t.map(o=>({nameAr:o.nameAr||o.name||String(o)})):[]}let _=[],C=!1,D=null;function ee(){D&&clearTimeout(D),D=setTimeout(()=>{C&&(console.warn("[Print] Watchdog: print job stuck >20s — resetting queue"),C=!1,D=null,_.length>0&&setTimeout(R,300))},2e4)}function te(){D&&(clearTimeout(D),D=null)}const ie="'Segoe UI', Tahoma, Arial, 'Helvetica Neue', sans-serif";function oe(e,t){return`<!DOCTYPE html><html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: ${t} auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 4px; font-family: ${ie}; direction: rtl; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    img { max-width: 100%; }
  </style>
</head>
<body>${e}</body>
</html>`}async function Z(e,t,o){const a=o?e:oe(e,t),n=document.createElement("iframe");n.setAttribute("aria-hidden","true");const s=t==="58mm"?220:302;n.style.cssText=`position:fixed;top:-9999px;left:-9999px;width:${s}px;height:1px;border:none;visibility:hidden;pointer-events:none;`,document.body.appendChild(n);const d=n.contentDocument||n.contentWindow?.document;if(!d){try{n.remove()}catch{}C=!1,setTimeout(R,300);return}d.open(),d.write(a),d.close();const r=n.contentWindow;if(!r){try{n.remove()}catch{}C=!1,setTimeout(R,300);return}return await new Promise(i=>setTimeout(i,20)),new Promise(i=>{let c=!1;const l=()=>{c||(c=!0,setTimeout(()=>{try{n.remove()}catch{}i()},200))};r.addEventListener("afterprint",l,{once:!0}),setTimeout(l,1e4);try{r.focus(),r.print()}catch{l()}})}function R(){if(C||_.length===0)return;C=!0,ee();const{html:e,paperWidth:t,isFullDoc:o}=_.shift();Z(e,t,o).catch(a=>console.warn("[Print] Error:",a)).finally(()=>{te(),C=!1,_.length>0&&setTimeout(R,80)})}function q(e,t,o={}){const{paperWidth:a="80mm",autoPrint:n=!0,showPrintButton:s=!0}=o;if(n){const l=/<html[\s>]/i.test(e);return _.push({html:e,paperWidth:a,isFullDoc:l}),R(),null}const d=`<style>
    @media print { @page { size: ${a} auto; margin: 0; } body { margin: 0; } .no-print { display: none !important; } }
  </style>`;let r=e.replace("</head>",`${d}</head>`);const i=s?`
    <div class="no-print" style="text-align:center;margin-top:20px;padding:20px;">
      <button onclick="window.print()" style="padding:12px 32px;font-size:16px;background:#b45309;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-left:10px;">طباعة</button>
      <button onclick="window.close()" style="padding:12px 32px;font-size:16px;background:#6b7280;color:#fff;border:none;border-radius:8px;cursor:pointer;">إغلاق</button>
    </div>`:"";s&&!r.includes('<div class="no-print"')&&(r=r.replace("</body>",`${i}</body>`));const c=window.open("","_blank","width=450,height=700,scrollbars=yes,resizable=yes");return c&&(c.document.write(r),c.document.close(),c.document.title=t),c}function ge(e,t="80mm"){_.push({html:e,paperWidth:t,isFullDoc:!1}),R()}function X(e,t="80mm"){const o=document.createElement("iframe");o.setAttribute("aria-hidden","true"),o.style.cssText="position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;",document.body.appendChild(o);const a=o.contentDocument||o.contentWindow?.document;if(!a){try{o.remove()}catch{}return}a.open(),a.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @page { size: ${t} auto; margin: 0; }
    html,body { margin:0; padding:0; background:#fff; }
    img { width: ${t}; display: block; margin: 0; padding: 0; }
  </style></head><body><img src="${e}" /></body></html>`),a.close();const n=a.querySelector("img");let s=!1;const d=()=>{s||(s=!0,setTimeout(()=>{try{o.remove()}catch{}},200))},r=()=>{try{o.contentWindow?.focus(),o.contentWindow?.print()}catch{}o.contentWindow?.addEventListener("afterprint",d,{once:!0}),setTimeout(d,5e3)};n&&!n.complete?(n.onload=()=>setTimeout(r,100),n.onerror=()=>setTimeout(r,100)):setTimeout(r,200)}async function be(e,t="مكان الشيف البخاري"){const{loadPrinterSettings:o,buildShiftReportEscPos:a,buildShiftReportCanvas:n,thermalPrint:s}=await z(async()=>{const{loadPrinterSettings:p,buildShiftReportEscPos:$,buildShiftReportCanvas:j,thermalPrint:x}=await import("./thermal-printer-CIDwDsrL.js");return{loadPrinterSettings:p,buildShiftReportEscPos:$,buildShiftReportCanvas:j,thermalPrint:x}},__vite__mapDeps([0,1,2,3,4,5])),d=o(),r=p=>p?new Date(p).toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit"}):"",i=p=>p?new Date(p).toLocaleDateString("ar-SA",{year:"numeric",month:"short",day:"numeric"}):"",c=e.openedAt||e.windowStart,l=e.closedAt||e.windowEnd,m=e.totalCash??e.totalCashSales??e.paymentBreakdown?.cash??0,u=e.totalCard??e.totalCardSales??(e.paymentBreakdown?.card??0)+(e.paymentBreakdown?.network??0),b=e.paymentBreakdown?.loyalty??0,f={shopName:t,reportTitle:e.reportTitle??(e.shiftNumber?"تقرير Z — إغلاق الوردية":e.isOngoing?"تقرير وردية جارية":"تقرير وردية مكتملة"),shiftNumber:e.shiftNumber,dateLabel:i(c),periodLabel:e.periodLabel,fromTime:r(c),toTime:e.isOngoing?"جارية...":r(l),cashierName:e.employeeName,totalOrders:e.totalOrders||0,totalSales:e.totalSales||0,totalCash:m,totalCard:u,totalLoyalty:b,productsByCategory:e.productsByCategory,paperWidth:d.paperWidth},h=await a(f);if(!(await s(h,"",d.paperWidth)).success){const $=(await n(f)).toDataURL("image/png");X($,d.paperWidth)}}async function he(e){const{loadPrinterSettings:t,buildRefundEscPos:o,buildRefundCanvas:a,thermalPrint:n}=await z(async()=>{const{loadPrinterSettings:i,buildRefundEscPos:c,buildRefundCanvas:l,thermalPrint:m}=await import("./thermal-printer-CIDwDsrL.js");return{loadPrinterSettings:i,buildRefundEscPos:c,buildRefundCanvas:l,thermalPrint:m}},__vite__mapDeps([0,1,2,3,4,5])),s=t(),d={shopName:e.shopName||A,refundId:e.refundId,originalOrderNumber:e.originalOrderNumber,items:e.items,refundAmount:e.refundAmount,paymentMethod:e.paymentMethod,cashAmount:e.cashAmount,cardAmount:e.cardAmount,reason:e.reason,employeeName:e.employeeName,date:e.date,originalPaymentMethod:e.originalPaymentMethod,paperWidth:s.paperWidth};if(s.enabled&&s.mode!=="browser")try{const i=await o(d);if((await n(i,"",s.paperWidth)).success)return}catch(i){console.warn("[printRefundThermal] Hardware print failed:",i)}const r=await a(d);X(r.toDataURL("image/png"),s.paperWidth)}async function xe(e){let t="";if(e.qrCode)try{t=(await L.toString(e.qrCode,{type:"svg",width:100,margin:1,errorCorrectionLevel:"M"})).replace(/<\?xml[^?]*\?>/g,"").replace(/width="\d+"/,'width="100"').replace(/height="\d+"/,'height="100"')}catch(a){console.error("Error generating QR code:",a)}const o=`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>بطاقة الموظف - ${e.employeeName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Tahoma, Arial, 'Segoe UI', sans-serif; background: #fff; color: #000; direction: rtl; }
    .card { margin: 20px auto; padding: 24px; border: 2px solid #333; border-radius: 12px; }
    .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 16px; margin-bottom: 16px; }
    .company-name { font-size: 20px; font-weight: 700; color: #b45309; }
    .employee-title { font-size: 12px; color: #666; margin-top: 4px; }
    .employee-name { font-size: 18px; font-weight: 700; margin: 16px 0 8px; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #eee; }
    .info-label { color: #666; }
    .info-value { font-weight: 600; }
    .qr-section { text-align: center; margin-top: 16px; padding-top: 16px; border-top: 2px dashed #333; }
    .qr-section img { width: 100px; height: 100px; }
    .qr-note { font-size: 10px; color: #888; margin-top: 8px; }
    @media print { body { margin: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="company-name">مكان الشيف البخاري</div>
      <div class="employee-title">بطاقة تعريف الموظف</div>
    </div>
    <div class="employee-name">${e.employeeName}</div>
    <div class="info-row"><span class="info-label">رقم الموظف:</span><span class="info-value">${e.employmentNumber}</span></div>
    <div class="info-row"><span class="info-label">المنصب:</span><span class="info-value">${e.role}</span></div>
    <div class="info-row"><span class="info-label">الجوال:</span><span class="info-value">${e.phone}</span></div>
    ${e.branchName?`<div class="info-row"><span class="info-label">الفرع:</span><span class="info-value">${e.branchName}</span></div>`:""}
    ${t?`
    <div class="qr-section">
      ${t}
      <div class="qr-note">امسح للتسجيل السريع</div>
    </div>
    `:""}
  </div>
</body>
</html>
  `;q(o,`بطاقة الموظف - ${e.employeeName}`,{paperWidth:"80mm",autoPrint:!0,showPrintButton:!0})}async function ye(e){const t=e.items.map(a=>`
    <div style="padding: 8px 0; border-bottom: 1px dashed #ccc; display: flex; justify-content: space-between; align-items: flex-start;">
      <div style="flex: 1; padding-left: 8px; font-size: 16px;">
        ${H(a.coffeeItem.nameAr,a.coffeeItem.nameEn)}
      </div>
      <div style="font-size: 24px; font-weight: 700; background: #000; color: #fff; padding: 4px 12px; border-radius: 8px; flex-shrink: 0;">x${a.quantity}</div>
    </div>
  `).join(""),o=`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>طلب المطبخ - ${e.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Tahoma, Arial, 'Segoe UI', sans-serif; background: #fff; color: #000; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .ticket { margin: 0 auto; padding: 16px; }
    .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
    .order-number { font-size: 28px; font-weight: 700; }
    .urgent { background: #dc2626; color: #fff; padding: 4px 12px; border-radius: 4px; display: inline-block; margin-top: 8px; animation: blink 1s infinite; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .table-info { font-size: 20px; font-weight: 700; color: #b45309; margin-top: 8px; }
    .timestamp { font-size: 12px; color: #666; }
    .items { margin: 16px 0; }
    .notes { background: #fef3c7; padding: 12px; border-radius: 8px; margin-top: 12px; font-size: 14px; }
    .notes-label { font-weight: 700; color: #92400e; }
    @media print { body { margin: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="header">
      <div class="order-number">${W(e.orderNumber)}</div>
      ${e.priority==="urgent"?'<div class="urgent">عاجل!</div>':""}
      ${e.tableNumber?`<div class="table-info">طاولة ${e.tableNumber}</div>`:""}
      <div class="timestamp">${e.timestamp}</div>
    </div>
    <div class="items">${t}</div>
    ${e.notes?`<div class="notes"><span class="notes-label">ملاحظات:</span> ${e.notes}</div>`:""}
  </div>
</body>
</html>
  `;q(o,`طلب المطبخ - ${e.orderNumber}`,{paperWidth:"80mm",autoPrint:!0,showPrintButton:!1})}const O="312718675800003",A="مكان الشيف البخاري",ne="مكان الشيف البخاري",re="فرع المروج، ينبع";function V(e){const t=(l,m)=>{const b=new TextEncoder().encode(m),f=new Uint8Array(2+b.length);return f[0]=l,f[1]=b.length,f.set(b,2),f},o=t(1,e.sellerName),a=t(2,e.vatNumber),n=t(3,e.timestamp),s=t(4,e.totalWithVat),d=t(5,e.vatAmount),r=new Uint8Array(o.length+a.length+n.length+s.length+d.length);let i=0;r.set(o,i),i+=o.length,r.set(a,i),i+=a.length,r.set(n,i),i+=n.length,r.set(s,i),i+=s.length,r.set(d,i);let c="";return r.forEach(l=>{c+=String.fromCharCode(l)}),btoa(c)}function y(e){if(e==null)return 0;if(typeof e=="number")return e;const t=parseFloat(e.toString().replace(/[^0-9.-]/g,""));return isNaN(t)?0:t}function H(e,t){return!t||t.trim()===""||t.trim()===e.trim()?`<span style="font-weight:600;">${e}</span>`:`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
    <span style="direction:ltr;text-align:left;font-size:10px;color:#444;flex:1;word-break:break-word;">${t}</span>
    <span style="direction:rtl;text-align:right;font-weight:600;flex:1;word-break:break-word;">${e}</span>
  </div>`}async function ae(e){await pe(e,{autoPrint:!0})}async function G(e,t,o,a){const{buildReceiptBitmapEscPos:n}=await z(async()=>{const{buildReceiptBitmapEscPos:p}=await import("./thermal-printer-CIDwDsrL.js");return{buildReceiptBitmapEscPos:p}},__vite__mapDeps([0,1,2,3,4,5])),s=y(e.total),d=s/(1+M),r=s-d,i=e.invoiceDiscount?y(e.invoiceDiscount):0,c=e.date?new Date(e.date).toISOString():new Date().toISOString(),{date:l,time:m}=B(e.date),u=V({sellerName:A,vatNumber:e.vatNumber||O,timestamp:c,totalWithVat:s.toFixed(2),vatAmount:r.toFixed(2)}),b=String(e.orderNumber).replace(/\D/g,"")||String(e.orderNumber),[f,h]=await Promise.all([(async()=>{try{const p=`${window.location.origin}/track/${b}`;return await L.toDataURL(p,{width:180,margin:1,errorCorrectionLevel:"M"})}catch{return""}})(),(async()=>{try{return await L.toDataURL(u,{width:140,margin:1,errorCorrectionLevel:"M"})}catch{return""}})()]),w=(()=>{const p=(e.paymentMethod||"").toLowerCase();return p==="cash"?"نقدي":p==="apple_pay"||p==="paymob-apple-pay"||p==="neoleap-apple-pay"?"Apple Pay":p==="stc-pay"||p==="stc_pay"?"STC Pay":p==="mada"?"مدى":p==="card"||p==="network"||p==="pos"||p==="pos-network"?"شبكة":p==="loyalty"||p.includes("qirox")||p.includes("qahwa")||p==="loyalty-card"?"بطاقة ولاء":p==="geidea"||p==="paymob-card"||p==="paymob"?"بطاقة ائتمان":p==="bank_transfer"||p==="rajhi"||p==="alinma"?"تحويل بنكي":p==="split"?"نقدي + شبكة":e.paymentMethod||"غير محدد"})();return n({shopName:A,vatNumber:e.vatNumber||O,branchName:e.branchName||re,orderNumber:e.orderNumber,orderDate:`${l} · ${m}`,cashierName:e.employeeName||"—",customerName:e.customerName&&e.customerName!=="عميل نقدي"?e.customerName:void 0,tableNumber:e.tableNumber,orderType:t||void 0,items:e.items.map(p=>({name:p.coffeeItem.nameAr,nameEn:p.coffeeItem.nameEn||"",qty:p.quantity,price:Y(p),addons:[...I(p)?[`الحجم: ${I(p)}`]:[],...N(p).map($=>$.nameAr)].filter(Boolean)})),subtotal:d,vat:r,total:s,discount:i>0?i:void 0,splitPayment:e.splitPayment,paymentMethod:w,...e.cashReceived?{cashReceived:e.cashReceived}:{},logoDataUrl:"/logo.png",trackingQrDataUrl:f||void 0,zatcaQrDataUrl:h||void 0,paperWidth:o,feedLines:a})}async function se(e,t="customer"){try{const{loadPrinterSettings:o,thermalPrint:a,buildEscPosKitchenTicketBitmap:n,getProfilesForRole:s,thermalPrintWithProfile:d}=await z(async()=>{const{loadPrinterSettings:i,thermalPrint:c,buildEscPosKitchenTicketBitmap:l,getProfilesForRole:m,thermalPrintWithProfile:u}=await import("./thermal-printer-CIDwDsrL.js");return{loadPrinterSettings:i,thermalPrint:c,buildEscPosKitchenTicketBitmap:l,getProfilesForRole:m,thermalPrintWithProfile:u}},__vite__mapDeps([0,1,2,3,4,5])),r=o();if(r.enabled&&r.mode!=="browser"){const i=e.orderTypeName||e.orderType||"",c=i==="dine_in"||i==="dine-in"?"محلي":i==="takeaway"||i==="pickup"?"سفري":i==="delivery"?"توصيل":i==="car_pickup"||i==="car-pickup"?"استلام بالسيارة":i||"محلي",l=i==="car_pickup"||i==="car-pickup"?[e.carInfo?.carType,e.carInfo?.carColor||e.carColor,e.carInfo?.plateNumber||e.plateNumber?`لوحة: ${e.carInfo?.plateNumber||e.plateNumber}`:""].filter(Boolean).join(" | "):void 0,m=s("receipt"),u=s("kitchen");if(t==="customer"||t==="both"){const b=await G(e,c,r.paperWidth,r.feedLines??4);if(m.length>0)for(const f of m)await d(b,f);else await a(b,"",r.paperWidth)}if(t==="kitchen"||t==="both"){t==="both"&&await new Promise(f=>setTimeout(f,1200));const b=await n({orderNumber:e.orderNumber,tableNumber:e.tableNumber,orderType:c,cashierName:e.employeeName||"—",items:e.items.map(f=>({name:f.coffeeItem.nameAr,nameEn:f.coffeeItem.nameEn||"",qty:f.quantity,addons:[...I(f)?[`الحجم: ${I(f)}`]:[],...N(f).map(h=>h.nameAr)]})),notes:[l,e.notes].filter(Boolean).join(" | ")||void 0,paperWidth:r.paperWidth});if(u.length>0)for(const f of u)await d(b,f);else await a(b,"",r.paperWidth)}return}}catch(o){console.warn("[printReceiptSection] Thermal error, falling back to browser:",o)}if(t==="customer"||t==="both"){const o=await K(e);_.push({html:o,paperWidth:"80mm",isFullDoc:!0})}if(t==="kitchen"||t==="both"){const o=Q(e);_.push({html:o,paperWidth:"80mm",isFullDoc:!0})}R()}async function ve(e){const t=await K(e),o=Q(e),a=W(e.orderNumber),n=window.open("","_blank","width=900,height=900,scrollbars=yes,resizable=yes");if(!n){await se(e,"both");return}const s=String(a).replace(/[&<>"']/g,i=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[i]),d=`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>معاينة فواتير الطلب #${s}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Cairo',Tahoma,Arial,sans-serif;background:#e8e8e8;padding:18px;text-align:center;color:#222;}
  .topbar{margin-bottom:18px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;align-items:center;}
  h2{font-size:18px;font-weight:900;margin-left:auto;margin-right:auto;color:#111;}
  .btn{padding:11px 22px;font-size:13px;border:none;border-radius:10px;cursor:pointer;font-weight:800;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(0,0,0,.1);}
  .btn-cust{background:#1e40af;color:#fff;}
  .btn-kit{background:#b45309;color:#fff;}
  .btn-both{background:#111;color:#fff;}
  .btn-close{background:#6b7280;color:#fff;}
  .frames{display:flex;gap:24px;flex-wrap:wrap;justify-content:center;align-items:flex-start;}
  .col{display:flex;flex-direction:column;align-items:center;gap:10px;}
  .label{font-size:13px;font-weight:800;color:#222;background:#fff;padding:6px 18px;border-radius:20px;border:2px solid #ccc;}
  iframe{border:none;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.18);background:#fff;}
  @media print{
    body{background:#fff;padding:0;}
    .topbar,.label{display:none!important;}
    .frames{display:block;}
    .col{display:block;page-break-after:always;}
    .col:last-child{page-break-after:auto;}
    iframe{box-shadow:none;border-radius:0;width:80mm!important;height:auto!important;}
    @page{size:80mm auto;margin:0;}
  }
</style></head><body>
<div class="topbar">
  <h2>📄 معاينة فواتير الطلب #${s}</h2>
  <button class="btn btn-cust" id="btn-cust">🖨️ طباعة فاتورة العميل</button>
  <button class="btn btn-kit"  id="btn-kit">🍳 طباعة المطبخ</button>
  <button class="btn btn-both" id="btn-both">🖨️ طباعة الكل</button>
  <button class="btn btn-close" id="btn-close">✕ إغلاق</button>
</div>
<div class="frames">
  <div class="col">
    <div class="label">📄 نسخة العميل</div>
    <iframe id="cust" width="340" height="760" sandbox="allow-same-origin allow-modals"></iframe>
  </div>
  <div class="col">
    <div class="label">🍳 نسخة المطبخ</div>
    <iframe id="kit"  width="340" height="760" sandbox="allow-same-origin allow-modals"></iframe>
  </div>
</div>
</body></html>`;n.document.open(),n.document.write(d),n.document.close(),setTimeout(()=>{try{const i=n.document,c=i.getElementById("cust"),l=i.getElementById("kit");c&&(c.srcdoc=t),l&&(l.srcdoc=o),i.getElementById("btn-cust")?.addEventListener("click",()=>{try{c?.contentWindow?.focus(),c?.contentWindow?.print()}catch{}}),i.getElementById("btn-kit")?.addEventListener("click",()=>{try{l?.contentWindow?.focus(),l?.contentWindow?.print()}catch{}}),i.getElementById("btn-both")?.addEventListener("click",()=>{try{n.focus(),n.print()}catch{}}),i.getElementById("btn-close")?.addEventListener("click",()=>{try{n.close()}catch{}})}catch(i){console.warn("[openReceiptPreviewWindow] wireUp error:",i)}},30)}async function we(e){const t=`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
    .invoice-page { width: 80mm; padding: 10px; border-bottom: 2px dashed #000; page-break-after: always; }
    .header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 10px; }
    .content { margin-top: 10px; }
    .row { display: flex; justify-content: space-between; margin: 5px 0; }
    .total { font-weight: bold; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
  </style>
</head>
<body>
  ${e.map(o=>{const a=new Date(o.createdAt),n=a.toLocaleDateString("ar-SA"),s=a.toLocaleTimeString("ar-SA");return`
    <div class="invoice-page">
      <div class="header">
        <h3>ملخص طلب موظف</h3>
        <div>رقم الطلب: ${W(o.orderNumber)}</div>
        <div>التاريخ: ${n} ${s}</div>
      </div>
      <div class="content">
        ${(o.items||[]).map(d=>`
          <div class="row">
            <span>${d.name||d.coffeeItem?.nameAr}</span>
            <span>${d.quantity}</span>
          </div>
        `).join("")}
        <div class="row total">
          <span>الإجمالي:</span>
          <span>${o.totalAmount} ر.س</span>
        </div>
      </div>
    </div>
    `}).join("")}
</body>
</html>
  `;q(t,"Bulk Employee Invoices",{paperWidth:"80mm",autoPrint:!0})}function B(e){try{const t=new Date(e);return isNaN(t.getTime())?{date:e,time:""}:{date:t.toLocaleDateString("ar-SA",{year:"numeric",month:"2-digit",day:"2-digit"}),time:t.toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!0})}}catch{return{date:e,time:""}}}async function K(e){const t=y(e.total),o=t/(1+M),a=t-o,n=e.invoiceDiscount?y(e.invoiceDiscount):0,{date:s,time:d}=B(e.date),r=String(e.orderNumber).replace(/\D/g,"").padStart(4,"0")||e.orderNumber,i=e.orderTypeName||e.orderType||"",c=i==="dine_in"||i==="dine-in"?"محلي":i==="takeaway"||i==="pickup"?"سفري":i==="delivery"?"توصيل":i==="car_pickup"||i==="car-pickup"?"🚗 سيارة":i,l=e.date?new Date(e.date).toISOString():new Date().toISOString(),m=V({sellerName:A,vatNumber:e.vatNumber||O,timestamp:l,totalWithVat:t.toFixed(2),vatAmount:a.toFixed(2)}),u=`zatca:${e.orderNumber}:${t.toFixed(2)}`;let b=U.get(u)||"";if(!b)try{b=(await L.toString(m,{type:"svg",width:100,margin:1,errorCorrectionLevel:"M"})).replace(/<\?xml[^?]*\?>/g,"").replace(/width="\d+"/,'width="100"').replace(/height="\d+"/,'height="100"'),U.set(u,b)}catch{}const f=e.items.reduce((x,S)=>x+(S.quantity||1),0),h='<div style="border-top:2px solid #111;margin:0 10px;"></div>',w='<div style="border-top:1px dashed #bbb;margin:8px 10px;"></div>',p=e.items.map(x=>{const S=Y(x),k=y(x.itemDiscount),E=x.quantity*S-k,T=N(x).map(g=>g.nameAr).join("، "),F=I(x),v=[F?`الحجم: ${F}`:"",T?`+ ${T}`:""].filter(Boolean).join(" · ");return`
      <div style="padding:6px 10px 0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:13px;line-height:1.7;">
          <span style="direction:ltr;flex-shrink:0;white-space:nowrap;font-weight:600;">﷼ ${E.toFixed(2)}</span>
          <span style="text-align:right;">
            ${x.coffeeItem.nameAr} &times;${x.quantity}
            ${v?`<br/><span style="font-size:11px;color:#666;">${v}</span>`:""}
            ${k>0?`<br/><span style="font-size:11px;color:#16a34a;">خصم -﷼${k.toFixed(2)}</span>`:""}
          </span>
        </div>
      </div>
      <div style="border-top:1px dashed #bbb;margin:6px 10px 0;"></div>`}).join(""),j=i==="car_pickup"||i==="car-pickup"?(()=>{const x=e.carInfo?.carType||"",S=e.carInfo?.carColor||e.carColor||"",k=e.carInfo?.plateNumber||e.plateNumber||"",E=[S,x,k?`لوحة: ${k}`:""].filter(Boolean);return E.length?`
    <div style="margin:0 10px 4px;background:#fef9c3;border:1px solid #fbbf24;border-radius:6px;padding:7px 10px;font-size:12px;font-weight:700;text-align:center;">
      🚗 ${E.join(" | ")}
    </div>`:""})():"";return`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Tahoma,Arial,'Segoe UI',sans-serif;direction:rtl;background:#e0ddd8;display:flex;justify-content:center;align-items:flex-start;padding:20px 10px;min-height:100vh;}
.paper{background:#fff;width:300px;box-shadow:0 4px 24px rgba(0,0,0,.22);font-size:13px;color:#111;line-height:1.5;padding-bottom:16px;}
@media print{
  @page{size:80mm auto;margin:0;}
  body{background:#fff!important;padding:0!important;}
  .paper{width:80mm!important;box-shadow:none!important;}
}
</style></head><body><div class="paper">

  <!-- ① مسافة علوية -->
  <div style="height:16px;"></div>

  <!-- ② رقم الطلب -->
  <div style="text-align:center;font-weight:900;font-size:26px;letter-spacing:3px;padding:6px 0 2px;">#${r}</div>

  <!-- ③ اسم المنشأة + بيانات -->
  <div style="text-align:center;font-size:12px;line-height:1.9;padding:4px 10px 6px;">
    <div style="font-weight:900;font-size:16px;letter-spacing:1px;">${A}</div>
    <div style="font-size:11px;color:#555;">ينبع، المملكة العربية السعودية</div>
    <div style="direction:ltr;font-size:11px;color:#555;">${e.vatNumber||O}</div>
    <div style="direction:ltr;font-size:11px;">${s} · ${d}</div>
  </div>

  ${h}

  <!-- ④ نوع الطلب -->
  <div style="text-align:center;font-size:13px;font-weight:700;padding:6px 0;">
    ${c||"طلب"}${e.tableNumber?` — طاولة ${e.tableNumber}`:""}
  </div>

  ${h}

  <!-- ⑤ عنوان الأصناف -->
  <div style="display:flex;justify-content:space-between;font-size:11px;color:#666;font-weight:700;padding:5px 10px 3px;">
    <span>السعر</span><span>الصنف</span>
  </div>
  ${w}

  <!-- ⑥ المنتجات -->
  ${p}

  <!-- ⑦ عدد المنتجات -->
  <div style="text-align:center;font-size:12px;color:#444;padding:6px 0 4px;">عدد المنتجات: ${f}</div>
  ${h}

  <!-- ⑧ الحساب -->
  <div style="padding:6px 10px 4px;">
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;color:#555;">
      <span style="direction:ltr;">﷼ ${o.toFixed(2)}</span>
      <span>المجموع قبل الضريبة</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;color:#555;">
      <span style="direction:ltr;">﷼ ${a.toFixed(2)}</span>
      <span>ضريبة القيمة المضافة 15%</span>
    </div>
    ${n>0?`<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;color:#16a34a;">
      <span style="direction:ltr;">-﷼ ${n.toFixed(2)}</span><span>الخصم</span>
    </div>`:""}
    <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;padding:7px 0 4px;border-top:2px solid #111;margin-top:6px;">
      <span style="direction:ltr;">﷼ ${t.toFixed(2)}</span>
      <span>الإجمالي</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;">
      <span style="font-weight:700;">${e.paymentMethod}</span>
      <span style="color:#555;">طريقة الدفع</span>
    </div>
    ${e.splitPayment?`
    <div style="border-top:1px dashed #ccc;margin:4px 0 2px;"></div>
    ${e.splitPayment.cash>0?`<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;padding:2px 0;">
      <span style="direction:ltr;">﷼ ${e.splitPayment.cash.toFixed(2)}</span><span>💵 نقدي</span>
    </div>`:""}
    ${e.splitPayment.card>0?`<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;padding:2px 0;">
      <span style="direction:ltr;">﷼ ${e.splitPayment.card.toFixed(2)}</span><span>💳 شبكة</span>
    </div>`:""}
    <div style="border-top:1px dashed #ccc;margin:2px 0;"></div>`:""}
    ${e.cashReceived&&e.cashReceived>0&&!e.splitPayment?`
    <div style="border-top:1px dashed #ccc;margin:4px 0 2px;"></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#555;padding:2px 0;">
      <span style="direction:ltr;font-weight:600;">﷼ ${e.cashReceived.toFixed(2)}</span><span>المبلغ المستلم</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#16a34a;padding:2px 0;font-weight:700;">
      <span style="direction:ltr;">﷼ ${Math.max(0,e.cashReceived-t).toFixed(2)}</span><span>↩ الباقي للعميل</span>
    </div>
    <div style="border-top:1px dashed #ccc;margin:2px 0;"></div>`:""}
  </div>

  ${h}

  <!-- بيانات السيارة (إن وُجدت) -->
  ${j}

  <!-- ملاحظات العميل -->
  ${e.notes?`
  <div style="margin:6px 10px 0;background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:8px 12px;font-size:12px;line-height:1.7;">
    <span style="font-weight:700;color:#92400e;">ملاحظات: </span><span>${e.notes}</span>
  </div>`:""}

  <!-- الكاشير + شعار -->
  <div style="padding:8px 10px 4px;text-align:center;">
    ${e.employeeName?`<div style="font-size:12px;color:#555;">تمت خدمتك من قبل: <strong>${e.employeeName}</strong></div>`:""}
    <div style="font-size:12px;font-weight:800;padding:4px 0;">"قهوة تُقال .. وورد يُهدى"</div>
  </div>

  ${w}

  <!-- Powered by -->
  <div style="text-align:center;font-size:11px;color:#aaa;padding:4px 0 6px;">
    Powered by <strong style="color:#2D9B6E;">QIROX STUDIO</strong>
  </div>


</div></body></html>`}function Q(e){const{date:t,time:o}=B(e.date),a=String(e.orderNumber).replace(/\D/g,"").padStart(4,"0")||e.orderNumber,n=e.orderTypeName||e.orderType||"",s=n==="dine_in"||n==="dine-in"?e.tableNumber?`محلي — طاولة رقم ${e.tableNumber}`:"محلي":n==="takeaway"||n==="pickup"?"سفري":n==="delivery"?"توصيل":n==="car_pickup"||n==="car-pickup"?"استلام بالسيارة":n,d=n==="car_pickup"||n==="car-pickup"?"#dc2626":n==="delivery"?"#2563eb":n==="dine_in"||n==="dine-in"?"#7c3aed":"#111",r=e.items.map((i,c)=>{const l=N(i).map(u=>u.nameAr).join("، "),m=I(i);return`
      <div style="padding:16px 0 12px 0;${c>0?"border-top:2px dashed #bbb;margin-top:4px;":""}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="font-size:20px;font-weight:800;line-height:1.6;flex:1;">${i.coffeeItem.nameAr}</div>
          <div style="font-size:28px;font-weight:900;background:#111;color:#fff;padding:4px 14px;border-radius:8px;flex-shrink:0;">×${i.quantity}</div>
        </div>
        ${m?`<div style="font-size:16px;color:#2563eb;margin-top:8px;margin-bottom:6px;padding-right:6px;line-height:1.8;">▸ الحجم: ${m}</div>`:""}
        ${l?`<div style="font-size:16px;color:#444;margin-top:8px;padding-right:6px;line-height:1.8;">▸ إضافات: ${l}</div>`:""}
      </div>`}).join("");return`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;border:0!important;}
hr{display:none!important;}
body{font-family:'Cairo',Tahoma,Arial,sans-serif;direction:rtl;background:#e8e6e0;display:flex;justify-content:center;align-items:flex-start;padding:24px 10px;min-height:100vh;}
.paper{background:#fff;width:320px;box-shadow:0 4px 20px rgba(0,0,0,.2);}
.tape{height:14px;background:repeating-linear-gradient(90deg,#fff 0,#fff 12px,#e8e6e0 12px,#e8e6e0 24px);}
.body{padding:18px 16px;}
.c{text-align:center;}
.gap{height:10px;}
.row{display:flex;justify-content:space-between;padding:10px 0;font-size:16px;border-bottom:1px solid #eee;line-height:1.8;}
@media print{
  @page{size:80mm auto;margin:0;}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;border:0!important;}
  hr{display:none!important;}
  body{display:block!important;background:#fff!important;padding:0!important;min-height:0!important;}
  .paper{width:76mm!important;max-width:76mm!important;margin:0!important;box-shadow:none!important;}
  .tape{display:none!important;}
  .body{padding:6px 4px 12px!important;}
}
</style></head><body><div class="paper">
<div class="tape"></div>
<div class="body">

  <!-- 2 blank lines at start of every invoice -->
  <div style="height:36px;"></div>

  <!-- Header -->
  <div class="c" style="font-size:20px;font-weight:900;padding-bottom:8px;border-bottom:3px double #000;">📋 نسخة الموظف / المطبخ</div>
  <div class="gap"></div>
  <div class="c" style="font-size:54px;font-weight:900;letter-spacing:4px;margin:6px 0;">#${a}</div>

  <!-- Order type badge -->
  ${s?`<div class="c" style="margin:6px 0;"><span style="display:inline-block;background:${d};color:#fff;font-size:16px;font-weight:700;padding:5px 18px;border-radius:20px;">${s}</span></div>`:""}

  <div style="height:18px;"></div>
  <div style="border-top:2px solid #000;width:100%;height:0;"></div>
  <div style="height:18px;"></div>

  <!-- Info rows -->
  <div class="row"><span style="color:#666;">الوقت:</span><span style="font-weight:700;">${o} — ${t}</span></div>
  ${e.employeeName?`<div class="row"><span style="color:#666;">الكاشير:</span><span style="font-weight:700;">${e.employeeName}</span></div>`:""}
  ${e.tableNumber&&!(n==="dine_in"||n==="dine-in")?`<div class="row"><span style="color:#666;">الطاولة:</span><span style="font-weight:900;font-size:18px;">رقم ${e.tableNumber}</span></div>`:""}

  <div style="height:18px;"></div>
  <div style="border-top:2px solid #000;width:100%;height:0;"></div>
  <div style="height:18px;"></div>

  <!-- Items -->
  <div style="font-size:15px;font-weight:700;color:#666;margin-bottom:4px;">الأصناف (${e.items.length} صنف):</div>
  ${r}

  <!-- ملاحظات الطلب -->
  ${e.notes?`
  <div style="height:18px;"></div>
  <div style="border-top:2px solid #000;width:100%;height:0;"></div>
  <div style="height:14px;"></div>
  <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:12px 14px;font-size:16px;line-height:1.8;">
    <div style="font-weight:900;color:#92400e;font-size:15px;margin-bottom:4px;">⚠ ملاحظات العميل:</div>
    <div style="font-weight:700;">${e.notes}</div>
  </div>`:""}

</div>
<div class="tape"></div>
</div></body></html>`}async function pe(e,t={}){const o=t.autoPrint!==void 0?t.autoPrint:!0;if(o)try{const{loadPrinterSettings:r,buildEscPosKitchenTicketBitmap:i,thermalPrint:c}=await z(async()=>{const{loadPrinterSettings:m,buildEscPosKitchenTicketBitmap:u,thermalPrint:b}=await import("./thermal-printer-CIDwDsrL.js");return{loadPrinterSettings:m,buildEscPosKitchenTicketBitmap:u,thermalPrint:b}},__vite__mapDeps([0,1,2,3,4,5])),l=r();if(l.enabled&&l.mode!=="browser"){const m=e.orderTypeName||e.orderType||"",u=m==="dine_in"||m==="dine-in"?"محلي":m==="takeaway"||m==="pickup"?"سفري":m==="delivery"?"توصيل":m==="car_pickup"||m==="car-pickup"?"استلام بالسيارة":m||"محلي",b=e.carInfo?.carType||"",f=e.carInfo?.carColor||e.carColor||"",h=e.carInfo?.plateNumber||e.plateNumber||"",w=m==="car_pickup"||m==="car-pickup"?[b,f,h?`لوحة: ${h}`:""].filter(Boolean).join(" | "):void 0,p=await G(e,u,l.paperWidth,l.feedLines??4),$=Math.max(1,Math.min(5,l.customerCopies||1)),j=Math.max(1,Math.min(5,l.kitchenCopies||1)),{getProfilesForRole:x,thermalPrintWithProfile:S}=await z(async()=>{const{getProfilesForRole:v,thermalPrintWithProfile:g}=await import("./thermal-printer-CIDwDsrL.js");return{getProfilesForRole:v,thermalPrintWithProfile:g}},__vite__mapDeps([0,1,2,3,4,5])),k=x("receipt"),E=x("kitchen");let T={success:!1,mode:"error",error:""};if(k.length>0){for(const v of k)for(let g=0;g<$;g++)g>0&&await new Promise(P=>setTimeout(P,1200)),T=await S(p,v);T.success=!0}else{T=await c(p,"",l.paperWidth);for(let v=1;v<$&&T.success;v++)await new Promise(g=>setTimeout(g,1200)),T=await c(p,"",l.paperWidth)}if(T.success||k.length>0){if(l.autoKitchenCopy||E.length>0){const v=await i({orderNumber:e.orderNumber,tableNumber:e.tableNumber,orderType:u,cashierName:e.employeeName||"—",items:e.items.map(g=>({name:g.coffeeItem.nameAr,nameEn:g.coffeeItem.nameEn||"",qty:g.quantity,addons:[...I(g)?[`الحجم: ${I(g)}`]:[],...N(g).map(P=>P.nameAr)]})),notes:[w,e.notes].filter(Boolean).join(" | ")||void 0,paperWidth:l.paperWidth});if(await new Promise(g=>setTimeout(g,1200)),E.length>0)for(const g of E)for(let P=0;P<j;P++)P>0&&await new Promise(J=>setTimeout(J,1200)),await S(v,g);else if(l.autoKitchenCopy)for(let g=0;g<j;g++)g>0&&await new Promise(P=>setTimeout(P,1400)),await c(v,"",l.paperWidth)}return}const F=T.error||"فشلت الطباعة الحرارية";console.error("[PrintTaxInvoice] Hardware print failed — mode:",l.mode,"— error:",F),typeof window<"u"&&window.__qiroxPrintError!==void 0?window.__qiroxPrintError(F):window.dispatchEvent(new CustomEvent("qirox:print-error",{detail:{error:F,mode:l.mode}}));return}}catch(r){console.warn("[PrintTaxInvoice] Thermal print error:",r)}const a=W(e.orderNumber),n=await K(e),s=Q(e),d=r=>Z(r,"80mm",!0);if(o){const{loadPrinterSettings:r}=await z(async()=>{const{loadPrinterSettings:m}=await import("./thermal-printer-CIDwDsrL.js");return{loadPrinterSettings:m}},__vite__mapDeps([0,1,2,3,4,5])),i=r(),c=Math.max(1,Math.min(5,i.customerCopies||1)),l=i.autoKitchenCopy?Math.max(1,Math.min(5,i.kitchenCopies||1)):0;for(let m=0;m<c;m++)m>0&&await new Promise(u=>setTimeout(u,150)),await d(n);for(let m=0;m<l;m++)await new Promise(u=>setTimeout(u,150)),await d(s)}else{const r=window.open("","_blank","width=820,height=860,scrollbars=yes,resizable=yes");r&&(r.document.open(),r.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>فواتير الطلب - ${a}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Tahoma,Arial,sans-serif;background:#e8e8e8;padding:16px;text-align:center;}
  .toolbar{margin-bottom:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
  .btn{padding:10px 22px;font-size:14px;border:none;border-radius:8px;cursor:pointer;font-weight:700;}
  .btn-print{background:#1a1a1a;color:#fff;}
  .btn-cust{background:#1e40af;color:#fff;}
  .btn-emp{background:#b45309;color:#fff;}
  .btn-close{background:#6b7280;color:#fff;}
  .frames{display:flex;gap:20px;flex-wrap:wrap;justify-content:center;align-items:flex-start;}
  .col{display:flex;flex-direction:column;align-items:center;}
  h3{font-size:12px;font-weight:700;color:#333;margin-bottom:8px;background:#fff;padding:4px 14px;border-radius:20px;border:1px solid #ccc;}
  iframe{border:none;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.15);}
  @media print{
    body{background:#fff;padding:0;}
    .toolbar,.no-print,h3{display:none!important;}
    .frames{display:block;}
    .col{display:block;page-break-after:always;}
    .col:last-child{page-break-after:auto;}
    iframe{box-shadow:none;border-radius:0;width:80mm!important;}
    @page{size:80mm auto;margin:0;}
  }
</style></head><body>
  <div class="toolbar no-print">
    <button class="btn btn-print" onclick="window.print()">طباعة النسختين</button>
    <button class="btn btn-cust" onclick="printOne('cust')">فاتورة العميل فقط</button>
    <button class="btn btn-emp" onclick="printOne('emp')">نسخة الموظف فقط</button>
    <button class="btn btn-close" onclick="window.close()">اغلاق</button>
  </div>
  <div class="frames">
    <div class="col" id="col-cust">
      <h3>فاتورة العميل</h3>
      <iframe id="fr-cust" width="320" height="700" srcdoc="${n.replace(/"/g,"&quot;").replace(/'/g,"&#39;")}"></iframe>
    </div>
    <div class="col" id="col-emp">
      <h3>نسخة الموظف</h3>
      <iframe id="fr-emp" width="320" height="700" srcdoc="${s.replace(/"/g,"&quot;").replace(/'/g,"&#39;")}"></iframe>
    </div>
  </div>
  <script>
    function printOne(which){
      var hideId=which==='cust'?'col-emp':'col-cust';
      var el=document.getElementById(hideId);
      var prev=el.style.display;
      el.style.display='none';
      window.print();
      setTimeout(function(){el.style.display=prev;},500);
    }
  <\/script>
</body></html>`),r.document.close());return}}async function $e(e){const t=String(e.orderNumber).replace(/\D/g,"")||String(e.orderNumber),o=`${window.location.origin}/track/${t}`;let a="";try{a=(await L.toString(o,{type:"svg",width:100,margin:1,errorCorrectionLevel:"M"})).replace(/<\?xml[^?]*\?>/g,"").replace(/width="\d+"/,'width="100"').replace(/height="\d+"/,'height="100"')}catch(i){console.error("Error generating order tracking QR:",i)}const{date:n,time:s}=B(e.date),d=e.deliveryTypeAr||(e.deliveryType==="dine-in"?"في الكافيه":e.deliveryType==="delivery"?"توصيل":"استلام"),r=`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>إيصال استلام - ${e.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #fff; color: #000; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .receipt { max-width: 80mm; margin: 0 auto; padding: 16px; }
    .header { text-align: center; border-bottom: 3px solid #b45309; padding-bottom: 16px; margin-bottom: 16px; }
    .company-name { font-size: 28px; font-weight: 700; color: #b45309; }
    .order-badge { display: inline-block; background: #fef3c7; border: 2px solid #b45309; padding: 12px 24px; border-radius: 12px; margin: 16px 0; }
    .order-number { font-size: 32px; font-weight: 700; color: #b45309; }
    .order-type { display: inline-block; background: ${e.deliveryType==="dine-in"?"#8b5cf6":e.deliveryType==="delivery"?"#10b981":"#3b82f6"}; color: white; padding: 8px 16px; border-radius: 20px; font-size: 16px; font-weight: 600; margin-top: 8px; }
    .section { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px dashed #ccc; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .items-section { background: #f9fafb; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    .item-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .item-row:last-child { border-bottom: none; }
    .item-name { font-weight: 600; }
    .item-qty { background: #000; color: #fff; padding: 2px 10px; border-radius: 12px; font-size: 14px; }
    .total-section { background: #fef3c7; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 16px; }
    .total-amount { font-size: 28px; font-weight: 700; color: #b45309; }
    .qr-section { text-align: center; padding: 16px; border: 2px dashed #b45309; border-radius: 12px; background: #fffbeb; }
    .qr-title { font-size: 14px; font-weight: 600; color: #92400e; margin-bottom: 8px; }
    .qr-container img { width: 120px; height: 120px; }
    .qr-note { font-size: 11px; color: #666; margin-top: 8px; }
    .footer { text-align: center; padding-top: 16px; font-size: 12px; color: #666; }
    @media print { body { margin: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1 class="company-name">${A}</h1>
      <p style="color: #666; font-size: 14px;">إيصال الاستلام</p>
      <div class="order-badge">
        <div class="order-number">${W(e.orderNumber)}</div>
      </div>
      <div class="order-type">${d}</div>
    </div>

    <div class="section">
      <div class="info-row">
        <span>العميل:</span>
        <span style="font-weight: 600;">${e.customerName}</span>
      </div>
      <div class="info-row">
        <span>التاريخ:</span>
        <span>${n} - ${s}</span>
      </div>
      ${e.tableNumber?`
      <div class="info-row">
        <span>الطاولة:</span>
        <span style="font-weight: 700; font-size: 18px;">${e.tableNumber}</span>
      </div>
      `:""}
    </div>

    <div class="items-section">
      ${e.items.map(i=>{const c=N(i).map(l=>l.nameAr).join("، ");return`
        <div class="item-row" style="align-items:flex-start;">
          <div class="item-name" style="flex:1;">
            ${H(i.coffeeItem.nameAr,i.coffeeItem.nameEn)}
            ${c?`<div style="font-size:11px;color:#92400e;margin-top:2px;">+ ${c}</div>`:""}
          </div>
          <span class="item-qty">x${i.quantity}</span>
        </div>`}).join("")}
    </div>

    <div class="total-section">
      <p style="font-size: 14px; color: #92400e;">الإجمالي المدفوع</p>
      <p class="total-amount">${e.total} ر.س</p>
      <p style="font-size: 12px; color: #666; margin-top: 4px;">${e.paymentMethod}</p>
    </div>

    <div class="footer">
      <p style="font-weight: 600;">شكراً لزيارتكم</p>
      <p>نتمنى لكم تجربة ممتعة</p>
      <p style="margin-top: 8px;">@مكان الشيف البخاري</p>
    </div>
  </div>
</body>
</html>
  `;q(r,`إيصال استلام - ${e.orderNumber}`,{paperWidth:"80mm",autoPrint:!0,showPrintButton:!0})}async function ke(e){const{date:t,time:o}=B(e.date),a=e.deliveryTypeAr||(e.deliveryType==="dine-in"?"في الكافيه":e.deliveryType==="delivery"?"توصيل":"استلام"),n=y(e.total),s=`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>نسخة الكاشير - ${e.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #fff; color: #000; direction: rtl; }
    .receipt { max-width: 80mm; margin: 0 auto; padding: 12px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
    .title { font-size: 14px; font-weight: 700; background: #000; color: #fff; padding: 4px 12px; display: inline-block; margin-bottom: 8px; }
    .order-number { font-size: 24px; font-weight: 700; }
    .order-type { font-size: 14px; font-weight: 600; color: #666; }
    .section { margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed #999; font-size: 12px; }
    .info-row { display: flex; justify-content: space-between; padding: 3px 0; }
    .items { font-size: 12px; }
    .item-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ccc; }
    .totals { font-size: 12px; margin-top: 12px; }
    .total-row { display: flex; justify-content: space-between; padding: 3px 0; }
    .total-grand { font-size: 16px; font-weight: 700; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; }
    .signature { margin-top: 24px; border-top: 1px solid #000; padding-top: 8px; }
    .signature-line { border-bottom: 1px solid #000; height: 30px; margin-top: 12px; }
    .footer { text-align: center; font-size: 10px; color: #666; margin-top: 12px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <span class="title">نسخة الكاشير</span>
      <div class="order-number">${W(e.orderNumber)}</div>
      <div class="order-type">${a}</div>
    </div>

    <div class="section">
      <div class="info-row"><span>التاريخ:</span><span>${t}</span></div>
      <div class="info-row"><span>الوقت:</span><span>${o}</span></div>
      <div class="info-row"><span>الكاشير:</span><span>${e.employeeName}</span></div>
      <div class="info-row"><span>العميل:</span><span>${e.customerName}</span></div>
      <div class="info-row"><span>الجوال:</span><span>${e.customerPhone}</span></div>
      ${e.tableNumber?`<div class="info-row"><span>الطاولة:</span><span>${e.tableNumber}</span></div>`:""}
    </div>

    <div class="items">
      ${e.items.map(d=>{const r=y(d.coffeeItem.price),i=N(d).map(c=>c.nameAr).join("، ");return`
        <div class="item-row" style="align-items:flex-start;">
          <div style="flex:1;">
            ${H(d.coffeeItem.nameAr,d.coffeeItem.nameEn)}<span style="font-size:11px;color:#555;"> x${d.quantity}</span>
            ${i?`<div style="font-size:10px;color:#777;margin-top:2px;">+ ${i}</div>`:""}
          </div>
          <span style="flex-shrink:0;">${(r*d.quantity).toFixed(2)}</span>
        </div>
        `}).join("")}
    </div>

    <div class="totals">
      <div class="total-row"><span>المجموع الفرعي:</span><span>${e.subtotal} ر.س</span></div>
      ${e.discount?`<div class="total-row" style="color: green;"><span>الخصم (${e.discount.percentage}%):</span><span>-${e.discount.amount} ر.س</span></div>`:""}
      <div class="total-row total-grand"><span>الإجمالي:</span><span>${n.toFixed(2)} ر.س</span></div>
      <div class="total-row"><span>طريقة الدفع:</span><span>${e.paymentMethod}</span></div>
      ${e.splitPayment?`
      ${e.splitPayment.cash>0?`<div class="total-row" style="font-size:11px;font-weight:600;"><span>💵 نقدي:</span><span>${e.splitPayment.cash.toFixed(2)} ر.س</span></div>`:""}
      ${e.splitPayment.card>0?`<div class="total-row" style="font-size:11px;font-weight:600;"><span>💳 شبكة:</span><span>${e.splitPayment.card.toFixed(2)} ر.س</span></div>`:""}`:""}
      ${e.cashReceived&&e.cashReceived>0&&!e.splitPayment?`
      <div class="total-row" style="font-size:11px;"><span>المبلغ المستلم:</span><span>${e.cashReceived.toFixed(2)} ر.س</span></div>
      <div class="total-row" style="font-size:11px;color:#16a34a;font-weight:700;"><span>↩ الباقي:</span><span>${Math.max(0,e.cashReceived-n).toFixed(2)} ر.س</span></div>`:""}
    </div>

    <div class="signature">
      <p style="font-size: 11px;">توقيع العميل (للدفع بالبطاقة):</p>
      <div class="signature-line"></div>
    </div>

    <div class="footer">
      <p>تم الحفظ في ${o} - ${t}</p>
    </div>
  </div>
</body>
</html>
  `;q(s,`نسخة الكاشير - ${e.orderNumber}`,{paperWidth:"80mm",autoPrint:!0,showPrintButton:!0})}async function Te(e){try{const{loadPrinterSettings:t,buildEscPosReceipt:o,buildEscPosKitchenTicketBitmap:a,thermalPrint:n}=await z(async()=>{const{loadPrinterSettings:d,buildEscPosReceipt:r,buildEscPosKitchenTicketBitmap:i,thermalPrint:c}=await import("./thermal-printer-CIDwDsrL.js");return{loadPrinterSettings:d,buildEscPosReceipt:r,buildEscPosKitchenTicketBitmap:i,thermalPrint:c}},__vite__mapDeps([0,1,2,3,4,5])),s=t();if(s.enabled&&s.autoPrint){const{date:d,time:r}=B(e.date),i=`${d} ${r}`,c=y(e.total),l=c/(1+M),m=c-l,u=e.orderTypeName||(e.orderType==="dine_in"?"محلي":e.orderType==="takeaway"?"سفري":e.orderType==="delivery"?"توصيل":e.deliveryTypeAr||""),b=o({shopName:A,vatNumber:e.vatNumber||O,branchName:e.branchName,address:e.branchAddress,orderNumber:e.orderNumber,date:i,cashierName:e.employeeName,customerName:e.customerName!=="عميل نقدي"?e.customerName:void 0,tableNumber:e.tableNumber,orderType:u||void 0,items:e.items.map(h=>({name:h.coffeeItem.nameAr,qty:h.quantity,price:y(h.coffeeItem.price),addons:N(h).map(w=>w.nameAr)})),subtotal:l,vat:m,total:c,discount:e.invoiceDiscount?y(e.invoiceDiscount):void 0,paymentMethod:e.paymentMethod,paperWidth:s.paperWidth,feedLines:s.feedLines}),f=await n(b,"",s.paperWidth);if(console.log("[PrintAllReceipts] Result:",f.mode,f.success),f.mode==="webusb"||f.mode==="network"){if(f.mode==="webusb"&&s.autoKitchenCopy){await new Promise(p=>setTimeout(p,1200));const h=await a({orderNumber:e.orderNumber,tableNumber:e.tableNumber,orderType:u||void 0,cashierName:e.employeeName,items:e.items.map(p=>({name:p.coffeeItem.nameAr,qty:p.quantity,addons:N(p).map($=>$.nameAr)})),notes:e.notes||void 0,paperWidth:s.paperWidth}),{thermalPrint:w}=await z(async()=>{const{thermalPrint:p}=await import("./thermal-printer-CIDwDsrL.js");return{thermalPrint:p}},__vite__mapDeps([0,1,2,3,4,5]));await w(h,"",s.paperWidth)}return}}}catch(t){console.error("[PrintAllReceipts] Thermal printer error, falling back:",t)}await ae(e)}async function Ne(e){const t=e.items.map(a=>{const s=y(a.coffeeItem.price)*a.quantity,d=N(a).map(r=>r.nameAr).join("، ");return`
      <tr style="border-bottom: 1px solid #e5e5e5;">
        <td style="padding: 8px 4px;">
          ${H(a.coffeeItem.nameAr,a.coffeeItem.nameEn)}
          ${d?`<div style="font-size:11px;color:#666;margin-top:2px;">+ ${d}</div>`:""}
        </td>
        <td style="padding: 8px 4px; text-align: center;">${a.quantity}</td>
        <td style="padding: 8px 4px; text-align: left;">${s.toFixed(2)}</td>
      </tr>
    `}).join(""),o=`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>إيصال - ${e.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: Tahoma, Arial, 'Segoe UI', sans-serif;
      background: #fff;
      color: #000;
      direction: rtl;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .receipt {
      max-width: 80mm;
      margin: 0 auto;
      padding: 16px;
    }
    
    .header {
      text-align: center;
      border-bottom: 2px dashed #333;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    
    .company-name { font-size: 24px; font-weight: 700; }
    .company-name-en { font-size: 14px; color: #666; }
    .order-num-block { text-align: center; margin: 12px 0; padding: 10px; background: #f0f0f0; border-radius: 6px; border: 1.5px solid #ccc; }
    .order-num-label { font-size: 11px; color: #666; margin-bottom: 4px; }
    .order-num-value { font-size: 26px; font-weight: 700; letter-spacing: 1px; color: #000; font-family: monospace; direction: ltr; }
    
    .section {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px dashed #ccc;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 14px;
    }
    
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { padding: 8px 4px; font-weight: 700; border-bottom: 2px solid #333; }
    th:first-child { text-align: right; }
    th:nth-child(2) { text-align: center; }
    th:last-child { text-align: left; }
    
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .total-row.grand { font-size: 18px; font-weight: 700; border-top: 2px solid #333; padding-top: 12px; }
    
    .footer { text-align: center; padding-top: 16px; border-top: 2px dashed #333; }
    
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1 class="company-name">${A}</h1>
      <p class="company-name-en">${ne}</p>
      <p style="margin-top: 8px; font-size: 12px;">فاتورة مبيعات</p>
    </div>

    <div class="order-num-block">
      <div class="order-num-label">رقم الطلب</div>
      <div class="order-num-value">${W(e.orderNumber)}</div>
    </div>

    <div class="section">
      <div class="info-row">
        <span>التاريخ:</span>
        <span>${e.date}</span>
      </div>
      <div class="info-row">
        <span>العميل:</span>
        <span>${e.customerName}</span>
      </div>
      <div class="info-row">
        <span>الجوال:</span>
        <span>${e.customerPhone}</span>
      </div>
      ${e.tableNumber?`
      <div class="info-row">
        <span>الطاولة:</span>
        <span>${e.tableNumber}</span>
      </div>
      `:""}
      <div class="info-row">
        <span>الكاشير:</span>
        <span>${e.employeeName}</span>
      </div>
    </div>

    <div class="section">
      <table>
        <thead>
          <tr>
            <th>المنتج</th>
            <th>الكمية</th>
            <th>السعر</th>
          </tr>
        </thead>
        <tbody>
          ${t}
        </tbody>
      </table>
    </div>

    <div>
      <div class="total-row">
        <span>المجموع الفرعي:</span>
        <span>${e.subtotal} ريال</span>
      </div>
      ${e.discount?`
      <div class="total-row" style="color: #16a34a;">
        <span>الخصم (${e.discount.code} - ${e.discount.percentage}%):</span>
        <span>-${e.discount.amount} ريال</span>
      </div>
      `:""}
      <div class="total-row grand">
        <span>الإجمالي:</span>
        <span>${e.total} ريال</span>
      </div>
      <div class="total-row" style="margin-top: 12px;">
        <span>طريقة الدفع:</span>
        <span><strong>${e.paymentMethod}</strong></span>
      </div>
    </div>


    <div class="footer">
      <p>شكراً لزيارتكم</p>
      <p style="font-size: 12px; color: #666;">نتمنى لكم تجربة ممتعة</p>
      <p style="margin-top: 12px; font-size: 12px;">تابعونا على وسائل التواصل الاجتماعي</p>
      <p style="font-family: monospace;">@مكان الشيف البخاري</p>
    </div>
  </div>

</body>
</html>
  `;q(o,`إيصال - ${e.orderNumber}`,{paperWidth:"80mm",autoPrint:!0,showPrintButton:!0})}export{Q as buildEmployeeReceiptPreviewHtml,K as buildReceiptPreviewHtml,W as fmtOrderNum,ve as openReceiptPreviewWindow,ue as prewarmZatcaQr,Te as printAllReceipts,we as printBulkEmployeeInvoices,ke as printCashierReceipt,$e as printCustomerPickupReceipt,xe as printEmployeeCard,ge as printHtmlInPage,ye as printKitchenOrder,se as printReceiptSection,he as printRefundThermal,be as printShiftThermal,Ne as printSimpleReceipt,pe as printTaxInvoice,ae as printUnifiedReceipt};
