function _receiptRow(label: string, value: string, bold = false) {
  const w = bold ? 'font-weight:bold;' : '';
  return `<div style="display:flex;justify-content:space-between;padding:2px 0;${w}"><span>${label}</span><span>${value}</span></div>`;
}

function _receiptProducts(productsByCategory: any[]): string {
  if (!productsByCategory || productsByCategory.length === 0) return '';
  let html = `<div style="border-top:1px dashed #aaa;margin:5px 0;padding-top:5px;">
    <div style="font-weight:bold;color:#2D9B6E;margin-bottom:4px;font-size:12px;">المنتجات المستهلكة</div>`;
  for (const cat of productsByCategory) {
    html += `<div style="font-size:11px;font-weight:bold;color:#2D9B6E;margin-top:3px;">${cat.categoryNameAr || 'أخرى'}</div>`;
    for (const item of (cat.items || [])) {
      html += `<div style="display:flex;justify-content:space-between;padding:1px 8px;font-size:11px;">
        <span>${item.nameAr}</span><span>× ${item.quantity}  <span style="color:#888;">${(item.totalAmount||0).toFixed(1)} ر.س</span></span></div>`;
    }
  }
  html += '</div>';
  return html;
}

export function buildShiftPrintFragment(p: any, bizName = 'مكان الشيف البخاري'): string {
  const fmtT = (iso: string) => new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const fmtD = (iso: string) => new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  return `<div style="font-family:Tahoma,Arial,sans-serif;font-size:12px;padding:5px 3px;direction:rtl;color:#000;background:#fff;">
  <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:6px;">
    <div style="font-size:15px;font-weight:bold;">${bizName}</div>
    <div style="font-size:11px;color:#555;">تقرير وردية ${p.isOngoing ? 'جارية' : 'مكتملة'}</div>
    <div style="font-size:11px;color:#555;">${fmtD(p.windowStart)}</div>
  </div>
  ${_receiptRow('الفترة:', p.periodLabel)}
  ${_receiptRow('من:', fmtT(p.windowStart))}
  ${_receiptRow('إلى:', p.isOngoing ? 'جارية...' : fmtT(p.windowEnd))}
  <div style="border-top:1px dashed #aaa;margin:5px 0;padding-top:5px;">
    <div style="font-weight:bold;color:#2D9B6E;margin-bottom:4px;font-size:12px;">ملخص المبيعات</div>
    ${_receiptRow('عدد الطلبات:', String(p.totalOrders || 0))}
    ${_receiptRow('الإجمالي:', `${(p.totalSales||0).toFixed(2)} ر.س`, true)}
  </div>
  <div style="border-top:1px dashed #aaa;margin:5px 0;padding-top:5px;">
    <div style="font-weight:bold;color:#2D9B6E;margin-bottom:4px;font-size:12px;">طرق الدفع</div>
    ${_receiptRow('نقدي:', `${(p.totalCash||0).toFixed(2)} ر.س`)}
    ${_receiptRow('شبكة/إلكتروني:', `${(p.totalCard||0).toFixed(2)} ر.س`)}
  </div>
  ${_receiptProducts(p.productsByCategory || [])}
  <div style="text-align:center;margin-top:8px;border-top:1px dashed #aaa;padding-top:6px;font-size:10px;color:#666;">
    QIROX Systems — ${new Date().toLocaleString('ar-SA')}
  </div>
</div>`;
}

export function buildMergedPrintFragment(periods: any[], dateLabel: string, bizName = 'مكان الشيف البخاري'): string {
  if (periods.length === 0) return '';
  const totalOrders = periods.reduce((s, p) => s + (p.totalOrders || 0), 0);
  const totalSales  = periods.reduce((s, p) => s + (p.totalSales  || 0), 0);
  const totalCash   = periods.reduce((s, p) => s + (p.totalCash   || 0), 0);
  const totalCard   = periods.reduce((s, p) => s + (p.totalCard   || 0), 0);

  const catMap = new Map<string, Map<string, { quantity: number; totalAmount: number }>>();
  for (const p of periods) {
    for (const cat of (p.productsByCategory || [])) {
      if (!catMap.has(cat.categoryNameAr)) catMap.set(cat.categoryNameAr, new Map());
      const itemMap = catMap.get(cat.categoryNameAr)!;
      for (const item of (cat.items || [])) {
        const ex = itemMap.get(item.nameAr) || { quantity: 0, totalAmount: 0 };
        itemMap.set(item.nameAr, { quantity: ex.quantity + item.quantity, totalAmount: ex.totalAmount + item.totalAmount });
      }
    }
  }
  const mergedProducts = Array.from(catMap.entries()).map(([categoryNameAr, itemMap]) => ({
    categoryNameAr,
    items: Array.from(itemMap.entries()).map(([nameAr, d]) => ({ nameAr, ...d })),
  }));

  const periodLabels = periods.map(p => p.periodLabel).join(' | ');
  const fmtT = (iso: string) => new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const timeRange = periods.length > 0
    ? `${fmtT(periods[0].windowStart)} — ${fmtT(periods[periods.length - 1].windowEnd)}`
    : '';

  return `<div style="font-family:Tahoma,Arial,sans-serif;font-size:12px;padding:5px 3px;direction:rtl;color:#000;background:#fff;">
  <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:6px;">
    <div style="font-size:15px;font-weight:bold;">${bizName}</div>
    <div style="font-size:11px;color:#555;">تقرير مدمج — ${periods.length} ورديات</div>
    <div style="font-size:11px;color:#555;">${dateLabel}</div>
  </div>
  ${_receiptRow('الورديات:', periodLabels)}
  ${_receiptRow('الفترة:', timeRange)}
  <div style="border-top:1px dashed #aaa;margin:5px 0;padding-top:5px;">
    <div style="font-weight:bold;color:#2D9B6E;margin-bottom:4px;font-size:12px;">ملخص المبيعات</div>
    ${_receiptRow('عدد الطلبات:', String(totalOrders))}
    ${_receiptRow('الإجمالي:', `${totalSales.toFixed(2)} ر.س`, true)}
  </div>
  <div style="border-top:1px dashed #aaa;margin:5px 0;padding-top:5px;">
    <div style="font-weight:bold;color:#2D9B6E;margin-bottom:4px;font-size:12px;">طرق الدفع</div>
    ${_receiptRow('نقدي:', `${totalCash.toFixed(2)} ر.س`)}
    ${_receiptRow('شبكة/إلكتروني:', `${totalCard.toFixed(2)} ر.س`)}
  </div>
  ${_receiptProducts(mergedProducts)}
  <div style="text-align:center;margin-top:8px;border-top:1px dashed #aaa;padding-top:6px;font-size:10px;color:#666;">
    QIROX Systems — ${new Date().toLocaleString('ar-SA')}
  </div>
</div>`;
}
