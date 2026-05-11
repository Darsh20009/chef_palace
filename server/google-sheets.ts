// This file is now deprecated as we have switched to TurboSMTP for all notifications.
// Functions are kept as stubs to prevent breaking imports.

export async function appendOrderToSheet(order: any, type: string = 'ORDER_NOTIFICATION') {
  console.log(`ℹ️ [TURBOSMTP] Notification received for order ${order.orderNumber}. Google Sheets integration is disabled.`);
  return Promise.resolve();
}
