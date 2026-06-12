const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/thermal-printer-B-zBwe4a.js","assets/index-1guhoBdA.js","assets/vendor-query-8nwRBUPC.js","assets/vendor-ui-D-0K_PxP.js","assets/vendor-utils-UagjiSbi.js","assets/index-CzMzbmJX.css"])))=>i.map(i=>d[i]);
import{al as z}from"./index-1guhoBdA.js";import{a as O}from"./browser-BJzWpxwN.js";import"./vendor-query-8nwRBUPC.js";import"./vendor-ui-D-0K_PxP.js";import"./vendor-utils-UagjiSbi.js";const H=.15,M=new Map;function ge(e){const i=typeof e.total=="number"?e.total:parseFloat(String(e.total).replace(/[^0-9.-]/g,""))||0,o=i/(1+H),r=i-o,n=e.date?new Date(e.date).toISOString():new Date().toISOString(),a=`zatca:${e.orderNumber}:${i.toFixed(2)}`;if(M.has(a))return;const s=K({sellerName:A,vatNumber:e.vatNumber||q,timestamp:n,totalWithVat:i.toFixed(2),vatAmount:r.toFixed(2)});O.toString(s,{type:"svg",width:100,margin:1,errorCorrectionLevel:"M"}).then(p=>{const t=p.replace(/<\?xml[^?]*\?>/g,"").replace(/width="\d+"/,'width="100"').replace(/height="\d+"/,'height="100"');M.set(a,t)}).catch(()=>{})}function W(e){const i=String(e).trim(),o=i.replace(/\D/g,"");return o?`#${o.padStart(4,"0")}`:`#${i}`}function Z(e){const i=y(e.price??e.unitPrice);return i>0?i:y(e.coffeeItem.price)}function I(e){return e.selectedSize??e.customization?.selectedSize??void 0}function T(e){if(e.customization?.selectedItemAddons?.length)return e.customization.selectedItemAddons;const i=e.customization?.addons;return Array.isArray(i)&&i.length?i.map(o=>({nameAr:o.nameAr||o.name||String(o)})):[]}let _=[],C=!1,D=null;function te(){D&&clearTimeout(D),D=setTimeout(()=>{C&&(console.warn("[Print] Watchdog: print job stuck >20s — resetting queue"),C=!1,D=null,_.length>0&&setTimeout(R,300))},2e4)}function ie(){D&&(clearTimeout(D),D=null)}const oe="'Segoe UI', Tahoma, Arial, 'Helvetica Neue', sans-serif";function ne(e,i){return`<!DOCTYPE html><html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: ${i} auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 4px; font-family: ${oe}; direction: rtl; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    img { max-width: 100%; }
  </style>
</head>
<body>${e}</body>
</html>`}async function X(e,i,o){const r=o?e:ne(e,i),n=document.createElement("iframe");n.setAttribute("aria-hidden","true");const a=i==="58mm"?220:302;n.style.cssText=`position:fixed;top:-9999px;left:-9999px;width:${a}px;height:1px;border:none;visibility:hidden;pointer-events:none;`,document.body.appendChild(n);const s=n.contentDocument||n.contentWindow?.document;if(!s){try{n.remove()}catch{}C=!1,setTimeout(R,300);return}s.open(),s.write(r),s.close();const p=n.contentWindow;if(!p){try{n.remove()}catch{}C=!1,setTimeout(R,300);return}return await new Promise(t=>setTimeout(t,20)),new Promise(t=>{let l=!1;const c=()=>{l||(l=!0,setTimeout(()=>{try{n.remove()}catch{}t()},200))};p.addEventListener("afterprint",c,{once:!0}),setTimeout(c,1e4);try{p.focus(),p.print()}catch{c()}})}function R(){if(C||_.length===0)return;C=!0,te();const{html:e,paperWidth:i,isFullDoc:o}=_.shift();X(e,i,o).catch(r=>console.warn("[Print] Error:",r)).finally(()=>{ie(),C=!1,_.length>0&&setTimeout(R,80)})}function B(e,i,o={}){const{paperWidth:r="80mm",autoPrint:n=!0,showPrintButton:a=!0}=o;if(n){const c=/<html[\s>]/i.test(e);return _.push({html:e,paperWidth:r,isFullDoc:c}),R(),null}const s=`<style>
    @media print { @page { size: ${r} auto; margin: 0; } body { margin: 0; } .no-print { display: none !important; } }
  </style>`;let p=e.replace("</head>",`${s}</head>`);const t=a?`
    <div class="no-print" style="text-align:center;margin-top:20px;padding:20px;">
      <button onclick="window.print()" style="padding:12px 32px;font-size:16px;background:#b45309;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-left:10px;">طباعة</button>
      <button onclick="window.close()" style="padding:12px 32px;font-size:16px;background:#6b7280;color:#fff;border:none;border-radius:8px;cursor:pointer;">إغلاق</button>
    </div>`:"";a&&!p.includes('<div class="no-print"')&&(p=p.replace("</body>",`${t}</body>`));const l=window.open("","_blank","width=450,height=700,scrollbars=yes,resizable=yes");return l&&(l.document.write(p),l.document.close(),l.document.title=i),l}function be(e,i="80mm"){_.push({html:e,paperWidth:i,isFullDoc:!1}),R()}function G(e,i="80mm"){const o=document.createElement("iframe");o.setAttribute("aria-hidden","true"),o.style.cssText="position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;",document.body.appendChild(o);const r=o.contentDocument||o.contentWindow?.document;if(!r){try{o.remove()}catch{}return}r.open(),r.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @page { size: ${i} auto; margin: 0; }
    html,body { margin:0; padding:0; background:#fff; }
    img { width: ${i}; display: block; margin: 0; padding: 0; }
  </style></head><body><img src="${e}" /></body></html>`),r.close();const n=r.querySelector("img");let a=!1;const s=()=>{a||(a=!0,setTimeout(()=>{try{o.remove()}catch{}},200))},p=()=>{try{o.contentWindow?.focus(),o.contentWindow?.print()}catch{}o.contentWindow?.addEventListener("afterprint",s,{once:!0}),setTimeout(s,5e3)};n&&!n.complete?(n.onload=()=>setTimeout(p,100),n.onerror=()=>setTimeout(p,100)):setTimeout(p,200)}async function he(e,i="مكان الشيف البخاري"){const{loadPrinterSettings:o,buildShiftReportEscPos:r,buildShiftReportCanvas:n,thermalPrint:a}=await z(async()=>{const{loadPrinterSettings:d,buildShiftReportEscPos:w,buildShiftReportCanvas:j,thermalPrint:x}=await import("./thermal-printer-B-zBwe4a.js");return{loadPrinterSettings:d,buildShiftReportEscPos:w,buildShiftReportCanvas:j,thermalPrint:x}},__vite__mapDeps([0,1,2,3,4,5])),s=o(),p=d=>d?new Date(d).toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit"}):"",t=d=>d?new Date(d).toLocaleDateString("ar-SA",{year:"numeric",month:"short",day:"numeric"}):"",l=e.openedAt||e.windowStart,c=e.closedAt||e.windowEnd,f=e.totalCash??e.totalCashSales??e.paymentBreakdown?.cash??0,m=e.totalCard??e.totalCardSales??(e.paymentBreakdown?.card??0)+(e.paymentBreakdown?.network??0),g=e.paymentBreakdown?.loyalty??0,u={shopName:i,reportTitle:e.reportTitle??(e.shiftNumber?"تقرير Z — إغلاق الوردية":e.isOngoing?"تقرير وردية جارية":"تقرير وردية مكتملة"),shiftNumber:e.shiftNumber,dateLabel:t(l),periodLabel:e.periodLabel,fromTime:p(l),toTime:e.isOngoing?"جارية...":p(c),cashierName:e.employeeName,totalOrders:e.totalOrders||0,totalSales:e.totalSales||0,totalCash:f,totalCard:m,totalLoyalty:g,productsByCategory:e.productsByCategory,paperWidth:s.paperWidth},h=await r(u);if(!(await a(h,"",s.paperWidth)).success){const w=(await n(u)).toDataURL("image/png");G(w,s.paperWidth)}}async function xe(e){const{loadPrinterSettings:i,buildRefundEscPos:o,buildRefundCanvas:r,thermalPrint:n}=await z(async()=>{const{loadPrinterSettings:t,buildRefundEscPos:l,buildRefundCanvas:c,thermalPrint:f}=await import("./thermal-printer-B-zBwe4a.js");return{loadPrinterSettings:t,buildRefundEscPos:l,buildRefundCanvas:c,thermalPrint:f}},__vite__mapDeps([0,1,2,3,4,5])),a=i(),s={shopName:e.shopName||A,refundId:e.refundId,originalOrderNumber:e.originalOrderNumber,items:e.items,refundAmount:e.refundAmount,paymentMethod:e.paymentMethod,cashAmount:e.cashAmount,cardAmount:e.cardAmount,reason:e.reason,employeeName:e.employeeName,date:e.date,originalPaymentMethod:e.originalPaymentMethod,paperWidth:a.paperWidth};if(a.enabled&&a.mode!=="browser")try{const t=await o(s);if((await n(t,"",a.paperWidth)).success)return}catch(t){console.warn("[printRefundThermal] Hardware print failed:",t)}const p=await r(s);G(p.toDataURL("image/png"),a.paperWidth)}async function ye(e){let i="";if(e.qrCode)try{i=(await O.toString(e.qrCode,{type:"svg",width:100,margin:1,errorCorrectionLevel:"M"})).replace(/<\?xml[^?]*\?>/g,"").replace(/width="\d+"/,'width="100"').replace(/height="\d+"/,'height="100"')}catch(r){console.error("Error generating QR code:",r)}const o=`
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
    ${i?`
    <div class="qr-section">
      ${i}
      <div class="qr-note">امسح للتسجيل السريع</div>
    </div>
    `:""}
  </div>
</body>
</html>
  `;B(o,`بطاقة الموظف - ${e.employeeName}`,{paperWidth:"80mm",autoPrint:!0,showPrintButton:!0})}async function ve(e){const i=e.items.map(r=>`
    <div style="padding: 8px 0; border-bottom: 1px dashed #ccc; display: flex; justify-content: space-between; align-items: flex-start;">
      <div style="flex: 1; padding-left: 8px; font-size: 16px;">
        ${V(r.coffeeItem.nameAr,r.coffeeItem.nameEn)}
      </div>
      <div style="font-size: 24px; font-weight: 700; background: #000; color: #fff; padding: 4px 12px; border-radius: 8px; flex-shrink: 0;">x${r.quantity}</div>
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
    <div class="items">${i}</div>
    ${e.notes?`<div class="notes"><span class="notes-label">ملاحظات:</span> ${e.notes}</div>`:""}
  </div>
</body>
</html>
  `;B(o,`طلب المطبخ - ${e.orderNumber}`,{paperWidth:"80mm",autoPrint:!0,showPrintButton:!1})}const q="310894802100003",A="مكان الشيف البخاري",re="مكان الشيف البخاري",ae="فرع المروج، الرياض";function K(e){const i=(c,f)=>{const g=new TextEncoder().encode(f),u=new Uint8Array(2+g.length);return u[0]=c,u[1]=g.length,u.set(g,2),u},o=i(1,e.sellerName),r=i(2,e.vatNumber),n=i(3,e.timestamp),a=i(4,e.totalWithVat),s=i(5,e.vatAmount),p=new Uint8Array(o.length+r.length+n.length+a.length+s.length);let t=0;p.set(o,t),t+=o.length,p.set(r,t),t+=r.length,p.set(n,t),t+=n.length,p.set(a,t),t+=a.length,p.set(s,t);let l="";return p.forEach(c=>{l+=String.fromCharCode(c)}),btoa(l)}function y(e){if(e==null)return 0;if(typeof e=="number")return e;const i=parseFloat(e.toString().replace(/[^0-9.-]/g,""));return isNaN(i)?0:i}function V(e,i){return!i||i.trim()===""||i.trim()===e.trim()?`<span style="font-weight:600;">${e}</span>`:`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
    <span style="direction:ltr;text-align:left;font-size:10px;color:#444;flex:1;word-break:break-word;">${i}</span>
    <span style="direction:rtl;text-align:right;font-weight:600;flex:1;word-break:break-word;">${e}</span>
  </div>`}async function se(e){await de(e,{autoPrint:!0})}async function J(e,i,o,r){const{buildReceiptBitmapEscPos:n}=await z(async()=>{const{buildReceiptBitmapEscPos:d}=await import("./thermal-printer-B-zBwe4a.js");return{buildReceiptBitmapEscPos:d}},__vite__mapDeps([0,1,2,3,4,5])),a=y(e.total),s=a/(1+H),p=a-s,t=e.invoiceDiscount?y(e.invoiceDiscount):0,l=e.date?new Date(e.date).toISOString():new Date().toISOString(),{date:c,time:f}=U(e.date),m=K({sellerName:A,vatNumber:e.vatNumber||q,timestamp:l,totalWithVat:a.toFixed(2),vatAmount:p.toFixed(2)}),g=String(e.orderNumber).replace(/\D/g,"")||String(e.orderNumber),[u,h]=await Promise.all([(async()=>{try{const d=`${window.location.origin}/track/${g}`;return await O.toDataURL(d,{width:180,margin:1,errorCorrectionLevel:"M"})}catch{return""}})(),(async()=>{try{return await O.toDataURL(m,{width:140,margin:1,errorCorrectionLevel:"M"})}catch{return""}})()]),v=(()=>{const d=(e.paymentMethod||"").toLowerCase();return d==="cash"?"نقدي":d==="apple_pay"||d==="paymob-apple-pay"||d==="neoleap-apple-pay"?"Apple Pay":d==="stc-pay"||d==="stc_pay"?"STC Pay":d==="mada"?"مدى":d==="card"||d==="network"||d==="pos"||d==="pos-network"?"شبكة":d==="loyalty"||d.includes("qirox")||d.includes("qahwa")||d==="loyalty-card"?"بطاقة ولاء":d==="geidea"||d==="paymob-card"||d==="paymob"?"بطاقة ائتمان":d==="bank_transfer"||d==="rajhi"||d==="alinma"?"تحويل بنكي":d==="split"?"نقدي + شبكة":e.paymentMethod||"غير محدد"})();return n({shopName:A,vatNumber:e.vatNumber||q,branchName:e.branchName||ae,orderNumber:e.orderNumber,orderDate:`${c} · ${f}`,cashierName:e.employeeName||"—",customerName:e.customerName&&e.customerName!=="عميل نقدي"?e.customerName:void 0,tableNumber:e.tableNumber,orderType:i||void 0,items:e.items.map(d=>({name:d.coffeeItem.nameAr,nameEn:d.coffeeItem.nameEn||"",qty:d.quantity,price:Z(d),addons:[...I(d)?[`الحجم: ${I(d)}`]:[],...T(d).map(w=>w.nameAr)].filter(Boolean)})),subtotal:s,vat:p,total:a,discount:t>0?t:void 0,splitPayment:e.splitPayment,paymentMethod:v,...e.cashReceived?{cashReceived:e.cashReceived}:{},logoDataUrl:"/logo.png",trackingQrDataUrl:u||void 0,zatcaQrDataUrl:h||void 0,paperWidth:o,feedLines:r})}async function pe(e,i="customer"){try{const{loadPrinterSettings:o,thermalPrint:r,buildEscPosKitchenTicketBitmap:n,getProfilesForRole:a,thermalPrintWithProfile:s}=await z(async()=>{const{loadPrinterSettings:t,thermalPrint:l,buildEscPosKitchenTicketBitmap:c,getProfilesForRole:f,thermalPrintWithProfile:m}=await import("./thermal-printer-B-zBwe4a.js");return{loadPrinterSettings:t,thermalPrint:l,buildEscPosKitchenTicketBitmap:c,getProfilesForRole:f,thermalPrintWithProfile:m}},__vite__mapDeps([0,1,2,3,4,5])),p=o();if(p.enabled&&p.mode!=="browser"){const t=e.orderTypeName||e.orderType||"",l=t==="dine_in"||t==="dine-in"?"محلي":t==="takeaway"||t==="pickup"?"سفري":t==="delivery"?"توصيل":t==="car_pickup"||t==="car-pickup"?"استلام بالسيارة":t||"محلي",c=t==="car_pickup"||t==="car-pickup"?[e.carInfo?.carType,e.carInfo?.carColor||e.carColor,e.carInfo?.plateNumber||e.plateNumber?`لوحة: ${e.carInfo?.plateNumber||e.plateNumber}`:""].filter(Boolean).join(" | "):void 0,f=a("receipt"),m=a("kitchen");if(i==="customer"||i==="both"){const g=await J(e,l,p.paperWidth,p.feedLines??4);if(f.length>0)for(const u of f)await s(g,u);else await r(g,"",p.paperWidth)}if(i==="kitchen"||i==="both"){i==="both"&&await new Promise(u=>setTimeout(u,1200));const g=await n({orderNumber:e.orderNumber,tableNumber:e.tableNumber,orderType:l,cashierName:e.employeeName||"—",items:e.items.map(u=>({name:u.coffeeItem.nameAr,nameEn:u.coffeeItem.nameEn||"",qty:u.quantity,addons:[...I(u)?[`الحجم: ${I(u)}`]:[],...T(u).map(h=>h.nameAr)]})),notes:[c,e.notes].filter(Boolean).join(" | ")||void 0,paperWidth:p.paperWidth});if(m.length>0)for(const u of m)await s(g,u);else await r(g,"",p.paperWidth)}return}}catch(o){console.warn("[printReceiptSection] Thermal error, falling back to browser:",o)}if(i==="customer"||i==="both"){const o=await Q(e);_.push({html:o,paperWidth:"80mm",isFullDoc:!0})}if(i==="kitchen"||i==="both"){const o=Y(e);_.push({html:o,paperWidth:"80mm",isFullDoc:!0})}R()}async function we(e){const i=W(e.orderNumber),o=window.open("","_blank","width=900,height=900,scrollbars=yes,resizable=yes");if(!o){await pe(e,"both");return}const r=await Q(e),n=Y(e),a=String(i).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),s=`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>معاينة فواتير الطلب #${a}</title>
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
  <h2>📄 معاينة فواتير الطلب #${a}</h2>
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
</body></html>`;o.document.open(),o.document.write(s),o.document.close(),setTimeout(()=>{try{const t=o.document,l=t.getElementById("cust"),c=t.getElementById("kit");l&&(l.srcdoc=r),c&&(c.srcdoc=n),t.getElementById("btn-cust")?.addEventListener("click",()=>{try{l?.contentWindow?.focus(),l?.contentWindow?.print()}catch{}}),t.getElementById("btn-kit")?.addEventListener("click",()=>{try{c?.contentWindow?.focus(),c?.contentWindow?.print()}catch{}}),t.getElementById("btn-both")?.addEventListener("click",()=>{try{o.focus(),o.print()}catch{}}),t.getElementById("btn-close")?.addEventListener("click",()=>{try{o.close()}catch{}})}catch(t){console.warn("[openReceiptPreviewWindow] wireUp error:",t)}},30)}async function $e(e){const i=`
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
  ${e.map(o=>{const r=new Date(o.createdAt),n=r.toLocaleDateString("ar-SA"),a=r.toLocaleTimeString("ar-SA");return`
    <div class="invoice-page">
      <div class="header">
        <h3>ملخص طلب موظف</h3>
        <div>رقم الطلب: ${W(o.orderNumber)}</div>
        <div>التاريخ: ${n} ${a}</div>
      </div>
      <div class="content">
        ${(o.items||[]).map(s=>`
          <div class="row">
            <span>${s.name||s.coffeeItem?.nameAr}</span>
            <span>${s.quantity}</span>
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
  `;B(i,"Bulk Employee Invoices",{paperWidth:"80mm",autoPrint:!0})}function U(e){try{const i=new Date(e);return isNaN(i.getTime())?{date:e,time:""}:{date:i.toLocaleDateString("ar-SA",{year:"numeric",month:"2-digit",day:"2-digit"}),time:i.toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!0})}}catch{return{date:e,time:""}}}async function Q(e){const i=y(e.total),o=i/(1+H),r=i-o,n=e.invoiceDiscount?y(e.invoiceDiscount):0,{date:a,time:s}=U(e.date),p=String(e.orderNumber).replace(/\D/g,"").padStart(4,"0")||e.orderNumber,t=e.orderTypeName||e.orderType||"",l=t==="dine_in"||t==="dine-in"?"محلي":t==="takeaway"||t==="pickup"?"سفري":t==="delivery"?"توصيل":t==="car_pickup"||t==="car-pickup"?"🚗 سيارة":t,c=e.date?new Date(e.date).toISOString():new Date().toISOString(),f=K({sellerName:A,vatNumber:e.vatNumber||q,timestamp:c,totalWithVat:i.toFixed(2),vatAmount:r.toFixed(2)}),m=`zatca:${e.orderNumber}:${i.toFixed(2)}`;let g=M.get(m)||"";if(!g)try{g=(await O.toString(f,{type:"svg",width:100,margin:1,errorCorrectionLevel:"M"})).replace(/<\?xml[^?]*\?>/g,"").replace(/width="\d+"/,'width="100"').replace(/height="\d+"/,'height="100"'),M.set(m,g)}catch{}const u=e.items.reduce((x,S)=>x+(S.quantity||1),0),h='<div style="border-top:2px solid #111;margin:0 10px;"></div>',v='<div style="border-top:1px dashed #bbb;margin:8px 10px;"></div>',d=e.items.map(x=>{const S=Z(x),N=y(x.itemDiscount),E=x.quantity*S-N,F=T(x).map($=>$.nameAr).join("، "),k=I(x),L=[k?`الحجم: ${k}`:"",F?`+ ${F}`:""].filter(Boolean).join(" · ");return`
      <div style="padding:6px 10px 0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:13px;line-height:1.7;">
          <span style="direction:ltr;flex-shrink:0;white-space:nowrap;font-weight:600;">﷼ ${E.toFixed(2)}</span>
          <span style="text-align:right;">
            ${x.coffeeItem.nameAr} &times;${x.quantity}
            ${L?`<br/><span style="font-size:11px;color:#666;">${L}</span>`:""}
            ${N>0?`<br/><span style="font-size:11px;color:#16a34a;">خصم -﷼${N.toFixed(2)}</span>`:""}
          </span>
        </div>
      </div>
      <div style="border-top:1px dashed #bbb;margin:6px 10px 0;"></div>`}).join(""),j=t==="car_pickup"||t==="car-pickup"?(()=>{const x=e.carInfo?.carType||"",S=e.carInfo?.carColor||e.carColor||"",N=e.carInfo?.plateNumber||e.plateNumber||"",E=[S,x,N?`لوحة: ${N}`:""].filter(Boolean);return E.length?`
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
  <div style="text-align:center;font-weight:900;font-size:26px;letter-spacing:3px;padding:6px 0 2px;">#${p}</div>

  <!-- ③ اسم المنشأة + بيانات -->
  <div style="text-align:center;font-size:12px;line-height:1.9;padding:4px 10px 6px;">
    <div style="font-weight:900;font-size:16px;letter-spacing:1px;">${A}</div>
    <div style="font-size:11px;color:#555;">الرياض، المملكة العربية السعودية</div>
    <div style="direction:ltr;font-size:11px;color:#555;">${e.vatNumber||q}</div>
    <div style="direction:ltr;font-size:11px;">${a} · ${s}</div>
  </div>

  ${h}

  <!-- ④ نوع الطلب -->
  <div style="text-align:center;font-size:13px;font-weight:700;padding:6px 0;">
    ${l||"طلب"}${e.tableNumber?` — طاولة ${e.tableNumber}`:""}
  </div>

  ${h}

  <!-- ⑤ عنوان الأصناف -->
  <div style="display:flex;justify-content:space-between;font-size:11px;color:#666;font-weight:700;padding:5px 10px 3px;">
    <span>السعر</span><span>الصنف</span>
  </div>
  ${v}

  <!-- ⑥ المنتجات -->
  ${d}

  <!-- ⑦ عدد المنتجات -->
  <div style="text-align:center;font-size:12px;color:#444;padding:6px 0 4px;">عدد المنتجات: ${u}</div>
  ${h}

  <!-- ⑧ الحساب -->
  <div style="padding:6px 10px 4px;">
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;color:#555;">
      <span style="direction:ltr;">﷼ ${o.toFixed(2)}</span>
      <span>المجموع قبل الضريبة</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;color:#555;">
      <span style="direction:ltr;">﷼ ${r.toFixed(2)}</span>
      <span>ضريبة القيمة المضافة 15%</span>
    </div>
    ${n>0?`<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;color:#16a34a;">
      <span style="direction:ltr;">-﷼ ${n.toFixed(2)}</span><span>الخصم</span>
    </div>`:""}
    <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;padding:7px 0 4px;border-top:2px solid #111;margin-top:6px;">
      <span style="direction:ltr;">﷼ ${i.toFixed(2)}</span>
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
      <span style="direction:ltr;">﷼ ${Math.max(0,e.cashReceived-i).toFixed(2)}</span><span>↩ الباقي للعميل</span>
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

  ${v}

  <!-- Powered by -->
  <div style="text-align:center;font-size:11px;color:#aaa;padding:4px 0 6px;">
    Powered by <strong style="color:#2D9B6E;">QIROX STUDIO</strong>
  </div>


</div></body></html>`}function Y(e){const{date:i,time:o}=U(e.date),r=String(e.orderNumber).replace(/\D/g,"").padStart(4,"0")||e.orderNumber,n=e.orderTypeName||e.orderType||"",a=n==="dine_in"||n==="dine-in"?e.tableNumber?`محلي — طاولة رقم ${e.tableNumber}`:"محلي":n==="takeaway"||n==="pickup"?"سفري":n==="delivery"?"توصيل":n==="car_pickup"||n==="car-pickup"?"استلام بالسيارة":n,s=n==="car_pickup"||n==="car-pickup"?"#dc2626":n==="delivery"?"#2563eb":n==="dine_in"||n==="dine-in"?"#7c3aed":"#111",p=e.items.map((t,l)=>{const c=T(t).map(m=>m.nameAr).join("، "),f=I(t);return`
      <div style="padding:16px 0 12px 0;${l>0?"border-top:2px dashed #bbb;margin-top:4px;":""}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="font-size:20px;font-weight:800;line-height:1.6;flex:1;">${t.coffeeItem.nameAr}</div>
          <div style="font-size:28px;font-weight:900;background:#111;color:#fff;padding:4px 14px;border-radius:8px;flex-shrink:0;">×${t.quantity}</div>
        </div>
        ${f?`<div style="font-size:16px;color:#2563eb;margin-top:8px;margin-bottom:6px;padding-right:6px;line-height:1.8;">▸ الحجم: ${f}</div>`:""}
        ${c?`<div style="font-size:16px;color:#444;margin-top:8px;padding-right:6px;line-height:1.8;">▸ إضافات: ${c}</div>`:""}
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
  <div class="c" style="font-size:54px;font-weight:900;letter-spacing:4px;margin:6px 0;">#${r}</div>

  <!-- Order type badge -->
  ${a?`<div class="c" style="margin:6px 0;"><span style="display:inline-block;background:${s};color:#fff;font-size:16px;font-weight:700;padding:5px 18px;border-radius:20px;">${a}</span></div>`:""}

  <div style="height:18px;"></div>
  <div style="border-top:2px solid #000;width:100%;height:0;"></div>
  <div style="height:18px;"></div>

  <!-- Info rows -->
  <div class="row"><span style="color:#666;">الوقت:</span><span style="font-weight:700;">${o} — ${i}</span></div>
  ${e.employeeName?`<div class="row"><span style="color:#666;">الكاشير:</span><span style="font-weight:700;">${e.employeeName}</span></div>`:""}
  ${e.tableNumber&&!(n==="dine_in"||n==="dine-in")?`<div class="row"><span style="color:#666;">الطاولة:</span><span style="font-weight:900;font-size:18px;">رقم ${e.tableNumber}</span></div>`:""}

  <div style="height:18px;"></div>
  <div style="border-top:2px solid #000;width:100%;height:0;"></div>
  <div style="height:18px;"></div>

  <!-- Items -->
  <div style="font-size:15px;font-weight:700;color:#666;margin-bottom:4px;">الأصناف (${e.items.length} صنف):</div>
  ${p}

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
</div></body></html>`}async function de(e,i={}){const o=i.autoPrint!==void 0?i.autoPrint:!0;if(o)try{const{loadPrinterSettings:t,buildEscPosKitchenTicketBitmap:l,thermalPrint:c}=await z(async()=>{const{loadPrinterSettings:m,buildEscPosKitchenTicketBitmap:g,thermalPrint:u}=await import("./thermal-printer-B-zBwe4a.js");return{loadPrinterSettings:m,buildEscPosKitchenTicketBitmap:g,thermalPrint:u}},__vite__mapDeps([0,1,2,3,4,5])),f=t();if(f.enabled&&f.mode!=="browser"){const m=e.orderTypeName||e.orderType||"",g=m==="dine_in"||m==="dine-in"?"محلي":m==="takeaway"||m==="pickup"?"سفري":m==="delivery"?"توصيل":m==="car_pickup"||m==="car-pickup"?"استلام بالسيارة":m||"محلي",u=e.carInfo?.carType||"",h=e.carInfo?.carColor||e.carColor||"",v=e.carInfo?.plateNumber||e.plateNumber||"",d=m==="car_pickup"||m==="car-pickup"?[u,h,v?`لوحة: ${v}`:""].filter(Boolean).join(" | "):void 0,w=await J(e,g,f.paperWidth,f.feedLines??4),j=Math.max(1,Math.min(5,f.customerCopies||1)),x=Math.max(1,Math.min(5,f.kitchenCopies||1)),{getProfilesForRole:S,thermalPrintWithProfile:N}=await z(async()=>{const{getProfilesForRole:$,thermalPrintWithProfile:b}=await import("./thermal-printer-B-zBwe4a.js");return{getProfilesForRole:$,thermalPrintWithProfile:b}},__vite__mapDeps([0,1,2,3,4,5])),E=S("receipt"),F=S("kitchen");let k={success:!1,mode:"error",error:""};if(E.length>0){for(const $ of E)for(let b=0;b<j;b++)b>0&&await new Promise(P=>setTimeout(P,1200)),k=await N(w,$);k.success=!0}else{k=await c(w,"",f.paperWidth);for(let $=1;$<j&&k.success;$++)await new Promise(b=>setTimeout(b,1200)),k=await c(w,"",f.paperWidth)}if(k.success||E.length>0){if(f.autoKitchenCopy||F.length>0){const $=await l({orderNumber:e.orderNumber,tableNumber:e.tableNumber,orderType:g,cashierName:e.employeeName||"—",items:e.items.map(b=>({name:b.coffeeItem.nameAr,nameEn:b.coffeeItem.nameEn||"",qty:b.quantity,addons:[...I(b)?[`الحجم: ${I(b)}`]:[],...T(b).map(P=>P.nameAr)]})),notes:[d,e.notes].filter(Boolean).join(" | ")||void 0,paperWidth:f.paperWidth});if(await new Promise(b=>setTimeout(b,1200)),F.length>0)for(const b of F)for(let P=0;P<x;P++)P>0&&await new Promise(ee=>setTimeout(ee,1200)),await N($,b);else if(f.autoKitchenCopy)for(let b=0;b<x;b++)b>0&&await new Promise(P=>setTimeout(P,1400)),await c($,"",f.paperWidth)}return}const L=k.error||"فشلت الطباعة الحرارية";console.error("[PrintTaxInvoice] Hardware print failed — mode:",f.mode,"— error:",L),typeof window<"u"&&window.__qiroxPrintError!==void 0?window.__qiroxPrintError(L):window.dispatchEvent(new CustomEvent("qirox:print-error",{detail:{error:L,mode:f.mode}}));return}}catch(t){console.warn("[PrintTaxInvoice] Thermal print error:",t)}const r=W(e.orderNumber);let n=null;o||(n=window.open("","_blank","width=820,height=860,scrollbars=yes,resizable=yes"));const a=await Q(e),s=Y(e),p=t=>X(t,"80mm",!0);if(o){const{loadPrinterSettings:t}=await z(async()=>{const{loadPrinterSettings:m}=await import("./thermal-printer-B-zBwe4a.js");return{loadPrinterSettings:m}},__vite__mapDeps([0,1,2,3,4,5])),l=t(),c=Math.max(1,Math.min(5,l.customerCopies||1)),f=l.autoKitchenCopy?Math.max(1,Math.min(5,l.kitchenCopies||1)):0;for(let m=0;m<c;m++)m>0&&await new Promise(g=>setTimeout(g,150)),await p(a);for(let m=0;m<f;m++)await new Promise(g=>setTimeout(g,150)),await p(s)}else{const t=n;t&&(t.document.open(),t.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>فواتير الطلب - ${r}</title>
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
      <iframe id="fr-cust" width="320" height="700" srcdoc="${a.replace(/"/g,"&quot;").replace(/'/g,"&#39;")}"></iframe>
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
</body></html>`),t.document.close());return}}async function ke(e){const i=String(e.orderNumber).replace(/\D/g,"")||String(e.orderNumber),o=`${window.location.origin}/track/${i}`;let r="";try{r=(await O.toString(o,{type:"svg",width:100,margin:1,errorCorrectionLevel:"M"})).replace(/<\?xml[^?]*\?>/g,"").replace(/width="\d+"/,'width="100"').replace(/height="\d+"/,'height="100"')}catch(t){console.error("Error generating order tracking QR:",t)}const{date:n,time:a}=U(e.date),s=e.deliveryTypeAr||(e.deliveryType==="dine-in"?"في الكافيه":e.deliveryType==="delivery"?"توصيل":"استلام"),p=`
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
      <div class="order-type">${s}</div>
    </div>

    <div class="section">
      <div class="info-row">
        <span>العميل:</span>
        <span style="font-weight: 600;">${e.customerName}</span>
      </div>
      <div class="info-row">
        <span>التاريخ:</span>
        <span>${n} - ${a}</span>
      </div>
      ${e.tableNumber?`
      <div class="info-row">
        <span>الطاولة:</span>
        <span style="font-weight: 700; font-size: 18px;">${e.tableNumber}</span>
      </div>
      `:""}
    </div>

    <div class="items-section">
      ${e.items.map(t=>{const l=T(t).map(c=>c.nameAr).join("، ");return`
        <div class="item-row" style="align-items:flex-start;">
          <div class="item-name" style="flex:1;">
            ${V(t.coffeeItem.nameAr,t.coffeeItem.nameEn)}
            ${l?`<div style="font-size:11px;color:#92400e;margin-top:2px;">+ ${l}</div>`:""}
          </div>
          <span class="item-qty">x${t.quantity}</span>
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
  `;B(p,`إيصال استلام - ${e.orderNumber}`,{paperWidth:"80mm",autoPrint:!0,showPrintButton:!0})}async function Te(e){const{date:i,time:o}=U(e.date),r=e.deliveryTypeAr||(e.deliveryType==="dine-in"?"في الكافيه":e.deliveryType==="delivery"?"توصيل":"استلام"),n=y(e.total),a=`
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
      <div class="order-type">${r}</div>
    </div>

    <div class="section">
      <div class="info-row"><span>التاريخ:</span><span>${i}</span></div>
      <div class="info-row"><span>الوقت:</span><span>${o}</span></div>
      <div class="info-row"><span>الكاشير:</span><span>${e.employeeName}</span></div>
      <div class="info-row"><span>العميل:</span><span>${e.customerName}</span></div>
      <div class="info-row"><span>الجوال:</span><span>${e.customerPhone}</span></div>
      ${e.tableNumber?`<div class="info-row"><span>الطاولة:</span><span>${e.tableNumber}</span></div>`:""}
    </div>

    <div class="items">
      ${e.items.map(s=>{const p=y(s.coffeeItem.price),t=T(s).map(l=>l.nameAr).join("، ");return`
        <div class="item-row" style="align-items:flex-start;">
          <div style="flex:1;">
            ${V(s.coffeeItem.nameAr,s.coffeeItem.nameEn)}<span style="font-size:11px;color:#555;"> x${s.quantity}</span>
            ${t?`<div style="font-size:10px;color:#777;margin-top:2px;">+ ${t}</div>`:""}
          </div>
          <span style="flex-shrink:0;">${(p*s.quantity).toFixed(2)}</span>
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
      <p>تم الحفظ في ${o} - ${i}</p>
    </div>
  </div>
</body>
</html>
  `;B(a,`نسخة الكاشير - ${e.orderNumber}`,{paperWidth:"80mm",autoPrint:!0,showPrintButton:!0})}async function Ne(e){try{const{loadPrinterSettings:i,buildEscPosReceipt:o,buildEscPosKitchenTicketBitmap:r,thermalPrint:n}=await z(async()=>{const{loadPrinterSettings:s,buildEscPosReceipt:p,buildEscPosKitchenTicketBitmap:t,thermalPrint:l}=await import("./thermal-printer-B-zBwe4a.js");return{loadPrinterSettings:s,buildEscPosReceipt:p,buildEscPosKitchenTicketBitmap:t,thermalPrint:l}},__vite__mapDeps([0,1,2,3,4,5])),a=i();if(a.enabled&&a.autoPrint){const{date:s,time:p}=U(e.date),t=`${s} ${p}`,l=y(e.total),c=l/(1+H),f=l-c,m=e.orderTypeName||(e.orderType==="dine_in"?"محلي":e.orderType==="takeaway"?"سفري":e.orderType==="delivery"?"توصيل":e.deliveryTypeAr||""),g=o({shopName:A,vatNumber:e.vatNumber||q,branchName:e.branchName,address:e.branchAddress,orderNumber:e.orderNumber,date:t,cashierName:e.employeeName,customerName:e.customerName!=="عميل نقدي"?e.customerName:void 0,tableNumber:e.tableNumber,orderType:m||void 0,items:e.items.map(h=>({name:h.coffeeItem.nameAr,qty:h.quantity,price:y(h.coffeeItem.price),addons:T(h).map(v=>v.nameAr)})),subtotal:c,vat:f,total:l,discount:e.invoiceDiscount?y(e.invoiceDiscount):void 0,paymentMethod:e.paymentMethod,paperWidth:a.paperWidth,feedLines:a.feedLines}),u=await n(g,"",a.paperWidth);if(console.log("[PrintAllReceipts] Result:",u.mode,u.success),u.mode==="webusb"||u.mode==="network"){if(u.mode==="webusb"&&a.autoKitchenCopy){await new Promise(d=>setTimeout(d,1200));const h=await r({orderNumber:e.orderNumber,tableNumber:e.tableNumber,orderType:m||void 0,cashierName:e.employeeName,items:e.items.map(d=>({name:d.coffeeItem.nameAr,qty:d.quantity,addons:T(d).map(w=>w.nameAr)})),notes:e.notes||void 0,paperWidth:a.paperWidth}),{thermalPrint:v}=await z(async()=>{const{thermalPrint:d}=await import("./thermal-printer-B-zBwe4a.js");return{thermalPrint:d}},__vite__mapDeps([0,1,2,3,4,5]));await v(h,"",a.paperWidth)}return}}}catch(i){console.error("[PrintAllReceipts] Thermal printer error, falling back:",i)}await se(e)}async function Pe(e){const i=e.items.map(r=>{const a=y(r.coffeeItem.price)*r.quantity,s=T(r).map(p=>p.nameAr).join("، ");return`
      <tr style="border-bottom: 1px solid #e5e5e5;">
        <td style="padding: 8px 4px;">
          ${V(r.coffeeItem.nameAr,r.coffeeItem.nameEn)}
          ${s?`<div style="font-size:11px;color:#666;margin-top:2px;">+ ${s}</div>`:""}
        </td>
        <td style="padding: 8px 4px; text-align: center;">${r.quantity}</td>
        <td style="padding: 8px 4px; text-align: left;">${a.toFixed(2)}</td>
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
      <p class="company-name-en">${re}</p>
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
          ${i}
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
  `;B(o,`إيصال - ${e.orderNumber}`,{paperWidth:"80mm",autoPrint:!0,showPrintButton:!0})}export{Y as buildEmployeeReceiptPreviewHtml,Q as buildReceiptPreviewHtml,W as fmtOrderNum,we as openReceiptPreviewWindow,ge as prewarmZatcaQr,Ne as printAllReceipts,$e as printBulkEmployeeInvoices,Te as printCashierReceipt,ke as printCustomerPickupReceipt,ye as printEmployeeCard,be as printHtmlInPage,ve as printKitchenOrder,pe as printReceiptSection,xe as printRefundThermal,he as printShiftThermal,Pe as printSimpleReceipt,de as printTaxInvoice,se as printUnifiedReceipt};
