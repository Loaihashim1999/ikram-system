import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import staffApi from "../../api/staffApi";
import MainLayout from "../../components/layout/MainLayout";

export default function StaffImportPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setResult(null);

    if (selectedFile.name.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        const lines = text.split("\n").filter((l) => l.trim().length > 0);
        if (lines.length > 0) {
          const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ''));
          const rows = lines.slice(1, 11).map((line) => {
            const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ''));
            const rowObj = {};
            headers.forEach((h, idx) => {
              rowObj[h] = values[idx] || "";
            });
            return rowObj;
          });
          setPreviewRows(rows);
        }
      };
      reader.readAsText(selectedFile);
    } else {
      setPreviewRows([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    if (previewRows && previewRows.length > 0) {
      formData.append("rows_json", JSON.stringify(previewRows));
    }

    try {
      const res = await staffApi.importExcel(formData);
      setResult(res.data);
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.message || "حدث خطأ أثناء رفع الملف. يرجى التثبت من صيغة الملف.",
        errors: err.response?.data?.errors ? Object.values(err.response.data.errors).flat() : [],
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      "\uFEFF" +
      "اسم الموظف,رقم الهوية,رقم الهاتف,المسمى الوظيفي,القسم,تاريخ التعيين,الراتب,البريد الإلكتروني,العنوان الوطني,عدد أفراد الأسرة\n" +
      "عبد الله محمد علي,1012345678,0501234567,محاسب مالية,المالية,2024-01-15,6500,abdullah@example.com,الرياض - حي الصفا,4\n" +
      "سارة أحمد عمر,1023456789,0507654321,مدير مشاريع,المشاريع,2023-05-10,9000,sara@example.com,جدة - حي النعيم,3\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "نموذج_استيراد_الموظفين_إكرام.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <MainLayout>
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📊 استيراد أسماء الموظفين من ملف Excel / CSV</h1>
        <Link to="/staff" className="text-amber-700 hover:underline text-sm font-medium">
          ← عودة لقائمة الموظفين
        </Link>
      </div>

      {/* Guide box */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 text-amber-900 text-sm shadow-xs">
        <div className="flex flex-wrap justify-between items-center mb-2">
          <h3 className="font-bold text-amber-900 text-base flex items-center gap-2">
            <span>💡</span>
            <span>تعليمات رفع ملف الموظفين:</span>
          </h3>
          <button
            type="button"
            onClick={downloadSampleTemplate}
            className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <span>📥</span>
            <span>تحميل نموذج تجريبي جاهز (CSV/Excel)</span>
          </button>
        </div>

        <ul className="list-disc list-inside space-y-1 text-xs text-amber-800 mt-2">
          <li>تأكد من أن صيغة الملف هي <strong>.xlsx</strong> أو <strong>.xls</strong> أو <strong>.csv</strong>.</li>
          <li>يتم فحص أرقام الهواتف والهويات وتفادي تكرار الموظفين المسجلين سابقاً.</li>
        </ul>
      </div>

      {/* Upload Box */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
        <div className="border-2 border-dashed border-amber-300 bg-amber-50/40 rounded-2xl p-8 text-center hover:bg-amber-50 transition-colors cursor-pointer mb-6">
          <input
            type="file"
            id="staff-file-input"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="staff-file-input" className="cursor-pointer block">
            <div className="text-4xl mb-2">📁</div>
            <div className="font-bold text-gray-700 text-base">
              {file ? file.name : "اضغط هنا لاختيار ملف Excel أو CSV الخاص بالموظفين"}
            </div>
            <div className="text-xs text-gray-500 mt-1">يدعم ملفات .xlsx, .xls, .csv بحجم حتى 10 ميجابايت</div>
          </label>
        </div>

        {/* CSV Preview */}
        {previewRows.length > 0 && (
          <div className="mb-6">
            <h4 className="font-bold text-gray-700 text-sm mb-2">معاينة أول 10 أسطر من الملف:</h4>
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-xs text-right">
                <thead className="bg-gray-100">
                  <tr>
                    {Object.keys(previewRows[0]).map((key, i) => (
                      <th key={i} className="p-2 border-b font-bold">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      {Object.values(row).map((val, i) => (
                        <td key={i} className="p-2">{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Submit button */}
        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={!file || uploading}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-8 py-2.5 rounded-xl disabled:opacity-50 transition-all shadow"
          >
            {uploading ? "⏳ جاري المعالجة والاستيراد..." : "🚀 بدء استيراد الموظفين"}
          </button>
        </div>
      </form>

      {/* Result notification */}
      {result && (
        <div className={`mt-6 p-6 rounded-2xl border ${result.success !== false ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{result.success !== false ? "🎉" : "⚠️"}</span>
            <h3 className={`font-bold text-lg ${result.success !== false ? "text-green-800" : "text-red-800"}`}>
              {result.message}
            </h3>
          </div>

          {result.created > 0 && (
            <p className="text-green-700 text-sm mb-2">تم إضافة {result.created} موظف بنجاح إلى قاعدة البيانات.</p>
          )}

          {result.errors && result.errors.length > 0 && (
            <div className="mt-3">
              <h4 className="font-bold text-red-700 text-sm mb-1">ملاحظات / أخطاء في بعض الأسطر:</h4>
              <ul className="list-disc list-inside text-xs text-red-600 space-y-1 max-h-40 overflow-y-auto bg-white p-3 rounded-lg border border-red-100">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => navigate("/staff")}
              className="bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-amber-700"
            >
              الانتقال لقائمة الموظفين
            </button>
          </div>
        </div>
      )}
    </div>
    </MainLayout>
  );
}
