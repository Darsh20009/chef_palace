/**
 * Export utility functions for CSV and PDF exports
 */
import { brand } from "./brand";

/**
 * Sanitize data for export by removing MongoDB internal fields
 */
export function sanitizeForExport(data: any[]): any[] {
  return data.map((item) => {
    const sanitized: any = {};
    Object.keys(item).forEach((key) => {
      // Skip MongoDB internal fields and private fields
      if (!key.startsWith("_") && key !== "__v" && key !== "password" && key !== "token") {
        sanitized[key] = item[key];
      }
    });
    return sanitized;
  });
}

export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    console.error("No data to export");
    return;
  }

  const cleanData = sanitizeForExport(data);
  const headers = Object.keys(cleanData[0]);
  const csvContent = [
    headers.join(","),
    ...cleanData.map((row) => headers.map((header) => `"${row[header] || ""}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToPDF(
  data: {
    title: string;
    date: string;
    branch: string;
    topItems?: any[];
    worstItems?: any[];
  },
  filename: string
) {
  // Create a simple HTML PDF content
  const htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          h2 { color: #666; margin-top: 20px; border-bottom: 2px solid #007bff; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #007bff; color: white; padding: 10px; text-align: left; }
          td { border: 1px solid #ddd; padding: 8px; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .positive { color: green; font-weight: bold; }
          .negative { color: red; font-weight: bold; }
          .info { color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>${data.title}</h1>
        <p><strong>Period:</strong> ${data.date}</p>
        <p><strong>Branch:</strong> ${data.branch}</p>

        ${
          data.topItems && data.topItems.length > 0
            ? `
          <h2>Top Profitable Items</h2>
          <table>
            <tr>
              <th>Item</th>
              <th>Sold</th>
              <th>Revenue</th>
              <th>COGS</th>
              <th>Profit</th>
              <th>Margin %</th>
            </tr>
            ${data.topItems
              .slice(0, 10)
              .map(
                (item) => `
              <tr>
                <td>${item.nameAr || item.itemId}</td>
                <td>${item.quantitySold}</td>
                <td>${item.totalRevenue?.toFixed(2) || "0.00"} SAR</td>
                <td>${item.totalCOGS?.toFixed(2) || "0.00"} SAR</td>
                <td class="positive">${item.totalProfit?.toFixed(2) || "0.00"} SAR</td>
                <td>${item.profitMargin?.toFixed(1) || "0"}%</td>
              </tr>
            `
              )
              .join("")}
          </table>
        `
            : ""
        }

        ${
          data.worstItems && data.worstItems.length > 0
            ? `
          <h2>Worst Performing Items</h2>
          <table>
            <tr>
              <th>Item</th>
              <th>Sold</th>
              <th>Revenue</th>
              <th>COGS</th>
              <th>Profit</th>
              <th>Reason</th>
            </tr>
            ${data.worstItems
              .slice(0, 10)
              .map(
                (item) => `
              <tr>
                <td>${item.nameAr || item.itemId}</td>
                <td>${item.quantitySold}</td>
                <td>${item.totalRevenue?.toFixed(2) || "0.00"} SAR</td>
                <td>${item.totalCOGS?.toFixed(2) || "0.00"} SAR</td>
                <td class="negative">${item.totalProfit?.toFixed(2) || "0.00"} SAR</td>
                <td>${item.reason || "Low margin"}</td>
              </tr>
            `
              )
              .join("")}
          </table>
        `
            : ""
        }

        <div class="info">
          <p>Generated on ${new Date().toLocaleString()}</p>
          <p>${brand.platformNameEn} - Automated Report</p>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open("", "", "height=400,width=800");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();

    // Save as PDF by opening print dialog
    setTimeout(() => {
      printWindow.close();
    }, 250);
  }
}

export function exportOrdersToCSV(orders: any[], filename: string = "orders.csv") {
  const data = orders.map((order) => ({
    "Order ID": order.id,
    "Customer": order.customerName || "N/A",
    "Items": order.items?.length || 0,
    "Total": order.total?.toFixed(2) || "0",
    "Status": order.status,
    "Date": new Date(order.createdAt).toLocaleDateString(),
  }));
  exportToCSV(data, filename);
}

export function exportInventoryToCSV(items: any[], filename: string = "inventory.csv") {
  const data = items.map((item) => ({
    "Item ID": item.rawItemId || item.id,
    "Name": item.nameAr || item.nameEn || "N/A",
    "Current Stock": item.currentQuantity,
    "Unit": item.unit,
    "Min Threshold": item.minThreshold,
    "Status": item.status,
    "Last Updated": new Date(item.updatedAt).toLocaleDateString(),
  }));
  exportToCSV(data, filename);
}
