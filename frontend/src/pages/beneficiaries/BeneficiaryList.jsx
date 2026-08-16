import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import beneficiaryApi from "../../api/beneficiaries";
import MainLayout from "../../components/layout/MainLayout";

export default function BeneficiariesListPage() {
  const navigate      = useNavigate();
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  useEffect(() => {
    beneficiaryApi.list({ per_page: 200 })
      .then((res) => {
        const raw = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setItems(Array.isArray(raw) ? raw : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (b.full_name || b.name || "").toLowerCase().includes(q) ||
      (b.national_id || "").includes(q) ||
      (b.phone || "").includes(q);
    const matchType = !typeFilter || (b.beneficiary_type || b.type) === typeFilter;
    const matchPriority = !priorityFilter || b.priority === priorityFilter;
    return matchSearch && matchType && matchPriority;
  });

  const handleDelete = async (id, name) => {
    if (!confirm(`هل تريد حذف "${name}"؟`)) return;
    try {
      await beneficiaryApi.remove(id);
      setItems((prev) => prev.filter((b) => b.id !== id));
    } catch {
      alert("حدث خطأ أثناء الحذف.");
    }
  };

  return (
    <MainLayout>
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">👥 قائمة المستفيدين</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            to="/beneficiaries/add-citizen"
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            + إضافة مواطن
          </Link>
          <Link
            to="/beneficiaries/add-resident"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            + إضافة مقيم
          </Link>
          <Link
            to="/beneficiaries/import"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            ↑ استيراد Excel
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو رقم الهوية أو الهاتف..."
          className="flex-1 min-w-48 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-right"
        >
          <option value="">جميع الأنواع</option>
          <option value="citizen">مواطن</option>
          <option value="resident">مقيم</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-right"
        >
          <option value="">جميع التصنيفات</option>
          <option value="first_class">درجة أولى</option>
          <option value="second_class">درجة ثانية</option>
          <option value="special_needs">ذوو احتياجات خاصة</option>
          <option value="elderly">كبار السن</option>
        </select>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-4 text-sm text-gray-500">
        <span>إجمالي: <strong>{items.length}</strong></span>
        <span>مواطنون: <strong>{items.filter((b) => (b.beneficiary_type || b.type) === "citizen").length}</strong></span>
        <span>مقيمون: <strong>{items.filter((b) => (b.beneficiary_type || b.type) === "resident").length}</strong></span>
        {search || typeFilter ? (
          <span className="text-amber-700">المعروض: <strong>{filtered.length}</strong></span>
        ) : null}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-amber-50 text-amber-800">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">الاسم</th>
              <th className="p-3">رقم الهوية</th>
              <th className="p-3">الهاتف</th>
              <th className="p-3">المدينة</th>
              <th className="p-3">النوع</th>
              <th className="p-3">التصنيف</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-400">
                  <div className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </td>
              </tr>
            )}
            {!loading && filtered.map((b, idx) => (
              <tr key={b.id} className="border-t hover:bg-gray-50 transition-colors">
                <td className="p-3 text-gray-400">{idx + 1}</td>
                <td className="p-3 font-medium">{b.full_name || b.name}</td>
                <td className="p-3">{b.national_id}</td>
                <td className="p-3">{b.phone}</td>
                <td className="p-3">{b.city || "—"}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      (b.beneficiary_type || b.type) === "citizen"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {(b.beneficiary_type || b.type) === "citizen" ? "مواطن" : "مقيم"}
                  </span>
                </td>
                <td className="p-3">
                  {b.priority ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${
                      b.priority === "first_class"   ? "bg-green-100 text-green-700" :
                      b.priority === "second_class"  ? "bg-amber-100 text-amber-700" :
                      b.priority === "special_needs" ? "bg-purple-100 text-purple-700" :
                      b.priority === "elderly"       ? "bg-blue-100 text-blue-700" :
                                                       "bg-gray-100 text-gray-500"
                    }`}>
                      {b.priority === "first_class"   ? "درجة أولى" :
                       b.priority === "second_class"  ? "درجة ثانية" :
                       b.priority === "special_needs" ? "ذوو احتياجات" :
                       b.priority === "elderly"       ? "كبار السن" : b.priority}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      b.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {b.status === "active" ? "نشط" : b.status === "suspended" ? "موقوف" : b.status}
                  </span>
                </td>
                <td className="p-3 flex gap-2 flex-wrap">
                  <Link
                    to={`/beneficiaries/${b.id}`}
                    className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded hover:bg-amber-200 font-semibold"
                  >
                    عرض
                  </Link>
                  <Link
                    to={`/beneficiaries/${b.id}/edit`}
                    className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 font-semibold"
                  >
                    تعديل
                  </Link>
                  <button
                    onClick={() => handleDelete(b.id, b.full_name || b.name)}
                    className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100 font-semibold"
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-400">
                  {search || typeFilter ? "لا توجد نتائج مطابقة" : "لا يوجد مستفيدون بعد"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </MainLayout>
  );
}
