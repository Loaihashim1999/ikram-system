import { useState } from 'react';
import api from '../../api/axios';

export default function SmartExcelImport({ entity, onComplete }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sheetName, setSheetName] = useState('');
  const [mapping, setMapping] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const selectedSheet = preview?.sheets?.find((sheet) => sheet.name === sheetName) || preview?.sheets?.[0];

  const loadPreview = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile); setBusy(true); setError(''); setResult(null);
    try {
      const data = new FormData(); data.append('file', selectedFile);
      const payload = (await api.post(`/smart-import/${entity}/preview`, data)).data;
      setPreview(payload); setSheetName(payload.sheets[0].name); setMapping(payload.sheets[0].suggested_mapping || {});
    } catch (err) { setPreview(null); setError(err.response?.data?.message || 'تعذر قراءة الملف.'); }
    finally { setBusy(false); }
  };
  const changeSheet = (name) => { const sheet = preview.sheets.find((item) => item.name === name); setSheetName(name); setMapping(sheet?.suggested_mapping || {}); };
  const importRows = async () => {
    const used = Object.values(mapping).filter(Boolean);
    if (new Set(used).size !== used.length) return setError('لا يمكن ربط أكثر من عمود بالحقل نفسه.');
    setBusy(true); setError('');
    try {
      const data = new FormData(); data.append('file', file); data.append('sheet', sheetName); data.append('mapping', JSON.stringify(mapping));
      const payload = (await api.post(`/smart-import/${entity}`, data)).data;
      setResult(payload); onComplete?.(payload);
    } catch (err) { setError(err.response?.data?.message || 'تعذر استيراد البيانات.'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5" dir="rtl">
    <label className="block border-2 border-dashed border-amber-300 rounded-2xl p-7 text-center bg-amber-50/50 cursor-pointer">
      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => loadPreview(e.target.files?.[0])} />
      <div className="text-3xl mb-2">📊</div><div className="font-bold text-gray-800">{file?.name || 'اختر ملف Excel أو CSV بأي ترتيب أعمدة'}</div>
      <div className="text-xs text-gray-500 mt-1">اكتشاف تلقائي للعناوين وأوراق العمل — حتى 10MB</div>
    </label>
    {busy && <div className="text-center text-amber-700 font-bold">جاري المعالجة…</div>}
    {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</div>}
    {preview && selectedSheet && <>
      {preview.sheets.length > 1 && <label className="block text-sm font-bold">ورقة العمل<select value={sheetName} onChange={(e) => changeSheet(e.target.value)} className="mt-1 w-full border rounded-lg p-2 bg-white">{preview.sheets.map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name} ({sheet.row_count} سجل)</option>)}</select></label>}
      <div className="rounded-xl border overflow-hidden"><div className="bg-gray-50 p-3 font-bold text-sm">مطابقة الأعمدة ({selectedSheet.row_count} سجل)</div><div className="grid md:grid-cols-2 gap-3 p-3">
        {selectedSheet.headers.map((header) => <label key={header} className="text-xs font-bold text-gray-700">{header}<select value={mapping[header] || ''} onChange={(e) => setMapping({ ...mapping, [header]: e.target.value || null })} className="mt-1 w-full border rounded-lg p-2 bg-white"><option value="">تجاهل هذا العمود</option>{Object.entries(preview.fields).map(([field, info]) => <option key={field} value={field}>{info.label}{info.required ? ' *' : ''}</option>)}</select></label>)}
      </div></div>
      <div className="overflow-auto border rounded-xl max-h-64"><table className="min-w-full text-xs"><thead className="bg-gray-100"><tr>{selectedSheet.headers.map((h) => <th key={h} className="p-2 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{selectedSheet.preview_rows.map((row, index) => <tr key={index} className="border-t">{selectedSheet.headers.map((h) => <td key={h} className="p-2 whitespace-nowrap">{String(row[h] ?? '')}</td>)}</tr>)}</tbody></table></div>
      <button type="button" disabled={busy} onClick={importRows} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl">استيراد جميع سجلات الورقة</button>
    </>}
    {result && <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm"><div className="font-bold text-green-800">{result.message}</div><div className="mt-1">نجح: {result.created} · مكرر: {result.skipped} · أخفق: {result.failed}</div>{result.errors?.length > 0 && <ul className="mt-2 list-disc list-inside text-red-700 max-h-36 overflow-auto">{result.errors.map((item, i) => <li key={i}>{item}</li>)}</ul>}</div>}
  </div>;
}
