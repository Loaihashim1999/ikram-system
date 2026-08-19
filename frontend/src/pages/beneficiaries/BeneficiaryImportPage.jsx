import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import * as XLSX from "xlsx";
import beneficiaryApi from "../../api/beneficiaries";
import MainLayout from "../../components/layout/MainLayout";
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, ArrowRight, Eye } from "lucide-react";

export default function BeneficiaryImportPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (jsonRows.length === 0) {
          setErrorMsg("⚠️ الملف المرفوع لا يحتوي على بيانات أو أن السطر الأول فارغ.");
          setParsedRows([]);
          setPreviewRows([]);
        } else {
          setParsedRows(jsonRows);
          setPreviewRows(jsonRows.slice(0, 10));
        }
      } catch (err) {
        console.error("SheetJS parse error:", err);
        setErrorMsg("⚠️ تعذر قراءة محتوى الملف. يرجى التأكد من أن الملف صيغة Excel (.xlsx, .xls) أو CSV سليم.");
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    // If pre-parsed in browser, pass JSON stringified rows for 100% fallback accuracy
    if (parsedRows.length > 0) {
      formData.append("rows_json", JSON.stringify(parsedRows));
    }

    try {
      const res = await beneficiaryApi.importExcel(formData);
      setResult(res.data);
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.message || "حدث خطأ أثناء معالجة واستيراد الملف.",
        errors: err.response?.data?.errors ? Object.values(err.response.data.errors).flat() : [],
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <MainLayout>
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-amber-600" />
            <span>📊 استيراد أسماء المستفيدين من ملف Excel / CSV</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">رفع وتصنيف واستيراد قوائم المستفيدين دفعة واحدة بالنظام</p>
        </div>
        <Link to="/beneficiaries" className="text-amber-700 hover:underline text-xs font-bold flex items-center gap-1">
          <ArrowRight className="w-4 h-4" />
          <span>العودة لقائمة المستفيدين</span>
        </Link>
      </div>

      {/* Instructions Card */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-3xl p-5 mb-6 text-amber-950 text-xs leading-relaxed shadow-sm">
        <h3 className="font-bold text-amber-900 text-sm mb-2 flex items-center gap-1.5">
          <span>💡 تعليمات إعداد ورفع ملف المستفيدين:</span>
        </h3>
        <ul className="list-disc list-inside space-y-1.5 font-semibold">
          <li>يدعم الملفات بتنسيقات Excel الحديثة والقديمة: <strong>.xlsx, .xls, .csv</strong></li>
          <li>تأكد أن السطر الأول يتضمن مسميات الأعمدة بالعربية أو الإنجليزية:
            <code className="bg-white px-2 py-0.5 rounded border border-amber-200 mx-1 text-amber-900 font-mono">الاسم / full_name</code>،
            <code className="bg-white px-2 py-0.5 rounded border border-amber-200 mx-1 text-amber-900 font-mono">رقم الهوية / national_id</code>،
            <code className="bg-white px-2 py-0.5 rounded border border-amber-200 mx-1 text-amber-900 font-mono">الجوال / phone</code>،
            <code className="bg-white px-2 py-0.5 rounded border border-amber-200 mx-1 text-amber-900 font-mono">المدينة / city</code>،
            <code className="bg-white px-2 py-0.5 rounded border border-amber-200 mx-1 text-amber-900 font-mono">الحي / district</code>.
          </li>
          <li>سيتم قراءة وحساب إجمالي الدخل وتصنيف الفئة آلياً، واستبعاد أرقام الهوايا المكررة تلقائياً.</li>
        </ul>
      </div>

      {/* Upload Box */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm p-6 border border-gray-100 mb-6">
        <div className="border-2 border-dashed border-amber-300 bg-amber-50/30 rounded-3xl p-8 text-center hover:bg-amber-50/60 transition-all cursor-pointer mb-6">
          <input
            type="file"
            id="excel-file-input"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="excel-file-input" className="cursor-pointer block">
            <div className="w-16 h-16 bg-amber-100 text-amber-900 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-amber-200 shadow-sm">
              <Upload className="w-8 h-8" />
            </div>
            <div className="font-bold text-gray-800 text-base">
              {file ? file.name : "اضغط هنا لاختيار ملف Excel أو CSV"}
            </div>
            <div className="text-xs text-gray-400 mt-1 font-mono">
              {parsedRows.length > 0
                ? `✓ تم التعرف على ${parsedRows.length} سطر جاهز للاستيراد`
                : "يدعم .xlsx, .xls, .csv بحجم يصل حتى 10MB"}
            </div>
          </label>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs font-bold mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Live Table Preview */}
        {previewRows.length > 0 && (
          <div className="mb-6 bg-gray-50/50 p-4 rounded-2xl border border-gray-200">
            <h4 className="font-bold text-amber-950 text-xs mb-3 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-amber-600" />
              <span>معاينة حية لأول 10 أسطر من الملف (إجمالي {parsedRows.length} سطر):</span>
            </h4>
            <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white shadow-sm">
              <table className="w-full text-xs text-right">
                <thead className="bg-amber-50 text-amber-900 border-b">
                  <tr>
                    <th className="p-2.5">#</th>
                    {Object.keys(previewRows[0]).map((key, i) => (
                      <th key={i} className="p-2.5 font-bold border-l border-amber-100">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-amber-50/20">
                      <td className="p-2.5 text-gray-400 font-mono">{idx + 1}</td>
                      {Object.values(row).map((val, i) => (
                        <td key={i} className="p-2.5 border-l border-gray-100">{String(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Submit action */}
        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-gray-400">
            {parsedRows.length > 0 ? `إجمالي الأسطر: ${parsedRows.length}` : ""}
          </span>

          <button
            type="submit"
            disabled={!file || uploading || parsedRows.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-2.5 rounded-xl disabled:opacity-40 transition-all shadow-md text-xs flex items-center gap-2"
          >
            {uploading ? (
              <span>⏳ جاري استيراد وتصنيف المستفيدين...</span>
            ) : (
              <span>🚀 إرسال وبدء الاستيراد ({parsedRows.length} مستفيد)</span>
            )}
          </button>
        </div>
      </form>

      {/* Result Notification Banner */}
      {result && (
        <div className={`p-6 rounded-3xl border shadow-sm ${result.success !== false ? "bg-green-50/90 border-green-200 text-green-950" : "bg-red-50 border-red-200 text-red-950"}`}>
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className={`w-7 h-7 ${result.success !== false ? "text-green-600" : "text-red-600"}`} />
            <h3 className="font-bold text-base">
              {result.message}
            </h3>
          </div>

          {result.created > 0 && (
            <p className="text-green-800 text-xs font-bold mb-3 mr-10">
              ✓ تم إضافة وتسجيل <strong>{result.created}</strong> مستفيد جديد وتصنيفهم آلياً بنجاح!
            </p>
          )}

          {result.errors && result.errors.length > 0 && (
            <div className="mt-3 mr-10">
              <h4 className="font-bold text-red-800 text-xs mb-1">ملاحظات والتنبيهات الملاحظة أثناء المعالجة:</h4>
              <ul className="list-disc list-inside text-xs text-red-700 space-y-1 max-h-40 overflow-y-auto bg-white p-3 rounded-xl border border-red-200">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex gap-3 mr-10">
            <button
              onClick={() => navigate("/beneficiaries")}
              className="bg-amber-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-amber-700 shadow-sm"
            >
              الانتقال لقائمة المستفيدين
            </button>
          </div>
        </div>
      )}
    </div>
    </MainLayout>
  );
}
