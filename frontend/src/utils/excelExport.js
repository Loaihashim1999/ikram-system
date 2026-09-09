import * as XLSX from "xlsx";
import api from "../api/axios";

/**
 * Reusable Excel Export Utility for IKRAM System
 * Handles RTL Arabic worksheets, column width calculation, null safety,
 * date/number formatting, and fetching complete datasets matching filters.
 */

/**
 * Auto-fit column widths based on cell content length
 */
function fitToColumn(data, headers) {
  const colWidths = {};

  // Headers width
  headers.forEach((h, idx) => {
    colWidths[idx] = Math.max(colWidths[idx] || 10, String(h).length * 1.5 + 4);
  });

  // Data rows width
  data.forEach((row) => {
    Object.values(row).forEach((val, idx) => {
      const len = val !== null && val !== undefined ? String(val).length * 1.2 + 2 : 4;
      colWidths[idx] = Math.max(colWidths[idx] || 10, Math.min(len, 45));
    });
  });

  return Object.keys(colWidths).map((key) => ({ wch: Math.ceil(colWidths[key]) }));
}

/**
 * Direct export of a data array to an Excel file with Arabic RTL support
 * @param {Object} options
 * @param {string} options.filename - Name of exported file (without .xlsx)
 * @param {string} options.sheetName - Name of worksheet
 * @param {Array<Object>} options.data - Array of row objects with Arabic keys
 */
export function exportArrayToExcel({ filename = "ikram-export", sheetName = "البيانات", data = [] }) {
  if (!data || data.length === 0) {
    throw new Error("لا توجد بيانات متاحة للتصدير");
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Set worksheet view to Right-To-Left (RTL) for Arabic
  if (!ws["!views"]) ws["!views"] = [];
  ws["!views"].push({ RTL: true });

  // Calculate column widths
  const headers = Object.keys(data[0] || {});
  ws["!cols"] = fitToColumn(data, headers);

  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanFilename = `${filename}-${dateStr}.xlsx`;
  XLSX.writeFile(wb, cleanFilename);
}

/**
 * Export full dataset directly from an API endpoint, bypassing pagination
 * to export ALL records that match the current filters.
 * @param {Object} options
 * @param {string} options.endpoint - API URL (e.g. '/daily-beneficiaries')
 * @param {Object} options.params - Current query filter params
 * @param {string} options.filename - File base name
 * @param {string} options.sheetName - Sheet title
 * @param {Function} options.transform - Function to map raw item to Arabic-keyed object
 */
export async function exportApiDataToExcel({
  endpoint,
  params = {},
  filename = "ikram-export",
  sheetName = "البيانات",
  transform,
}) {
  // Pass export flag or per_page: -1 to instruct backend to return all matching records
  const exportParams = {
    ...params,
    per_page: -1,
    all: true,
    page: 1,
  };

  const response = await api.get(endpoint, { params: exportParams });
  
  let records = [];
  const resData = response.data;

  if (Array.isArray(resData)) {
    records = resData;
  } else if (Array.isArray(resData?.data)) {
    records = resData.data;
  } else if (Array.isArray(resData?.data?.data)) {
    records = resData.data.data;
  } else if (Array.isArray(resData?.records)) {
    records = resData.records;
  } else if (Array.isArray(resData?.beneficiaries?.data)) {
    records = resData.beneficiaries.data;
  } else if (Array.isArray(resData?.beneficiaries)) {
    records = resData.beneficiaries;
  }

  if (!records || records.length === 0) {
    throw new Error("لا توجد سجلات تطابق خيارات البحث والتصفية المحددة للتصدير.");
  }

  const transformedData = transform ? records.map(transform) : records;
  exportArrayToExcel({ filename, sheetName, data: transformedData });
  return records.length;
}
