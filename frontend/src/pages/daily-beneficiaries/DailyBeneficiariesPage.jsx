import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import MainLayout from "../../components/layout/MainLayout";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import DailyBeneficiariesList from "./DailyBeneficiariesList";
import DailyBeneficiaryReceivingPage from "./DailyBeneficiaryReceivingPage";
import DailyInventoryPage from "./DailyInventoryPage";
import {
  LayoutDashboard,
  Users,
  History,
  PackageCheck,
  Boxes,
  UserPlus,
  FileSpreadsheet,
  TrendingUp,
  Package,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { getDailyBeneficiaries, getDailyInventory, getDailyReceivingTransactions } from "../../api/dailyBeneficiaries";
import { exportApiDataToExcel } from "../../utils/excelExport";

export default function DailyBeneficiariesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active Tab: 'overview' | 'today' | 'history' | 'deliveries' | 'inventory'
  const activeTab = searchParams.get("tab") || "overview";

  const setTab = (tabKey) => {
    setSearchParams({ tab: tabKey });
  };

  // Quick stats state for Overview Tab
  const [stats, setStats] = useState({
    totalBeneficiaries: 0,
    totalReceived: 0,
    todayTransactions: 0,
    todayBaskets: 0,
    inventoryItems: 0,
    lowStockCount: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  useEffect(() => {
    if (activeTab === "overview") {
      fetchSummaryStats();
    }
  }, [activeTab]);

  const fetchSummaryStats = async () => {
    try {
      setLoadingStats(true);
      const [benRes, txRes, invRes] = await Promise.all([
        getDailyBeneficiaries({ per_page: 5 }),
        getDailyReceivingTransactions({ per_page: 6 }),
        getDailyInventory(),
      ]);

      const benData = benRes.data?.data;
      const txData = txRes.data;
      const invData = invRes.data;

      setStats({
        totalBeneficiaries: benData?.total || 0,
        todayTransactions: txData?.stats?.today_transactions || 0,
        todayBaskets: txData?.stats?.today_baskets || 0,
        inventoryItems: invData?.stats?.total_items || 0,
        lowStockCount: invData?.stats?.low_stock_count || 0,
      });

      setRecentTransactions(txData?.data?.data?.slice(0, 5) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleGlobalExportExcel = async () => {
    try {
      setToast({ show: true, message: "جاري تجهيز وتصدير كافة سجلات المستفيدين اليوميين...", type: "info" });
      const count = await exportApiDataToExcel({
        endpoint: "/daily-beneficiaries",
        filename: "ikram-daily-beneficiaries-all",
        sheetName: "المستفيدون اليوميون",
        transform: (b, idx) => ({
          "#": idx + 1,
          "اسم المستفيد": b.full_name,
          "رقم الهوية / الإقامة": b.national_id,
          "رقم الجوال": b.phone,
          "الحي": b.district || "غير محدد",
          "الفئة": b.category_name || b.category?.name || "أسر متعففة",
          "مرات الاستلام": b.total_received_count || 0,
          "تاريخ آخر استلام": b.last_delivery_date ? b.last_delivery_date.slice(0, 10) : "لم يستلم بعد",
          "تاريخ التسجيل": b.created_at ? b.created_at.slice(0, 10) : "—",
          "الحالة": b.status === "active" ? "نشط" : "غير نشط",
          "ملاحظات": b.notes || "",
        }),
      });
      setToast({ show: true, message: `تم تصدير ${count} سجل بنجاح.`, type: "success" });
    } catch (e) {
      setToast({ show: true, message: e.message || "فشل التصدير", type: "error" });
    }
  };

  const tabsConfig = [
    { key: "overview", label: "لوحة المؤشرات والملخص", icon: LayoutDashboard },
    { key: "today", label: "مستفيدو اليوم والمسجلون", icon: Users },
    { key: "history", label: "سجل الاستلامات التاريخي", icon: History },
    { key: "deliveries", label: "تسليم وصرف المساعدات", icon: PackageCheck },
    { key: "inventory", label: "مستودع المساعدات اليومية", icon: Boxes },
  ];

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Module Header */}
        <PageHeader
          title="منظومة المستفيدين اليوميين الموحدة"
          subtitle="إدارة متكاملة لسجلات المستفيدين اليوميين، صرف المساعدات العينية، سندات الاستلام والمستودع"
          badge="الخدمات اليومية والمساعدات"
          breadcrumbs={[{ label: "المستفيدون اليوميون" }]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={FileSpreadsheet}
                onClick={handleGlobalExportExcel}
              >
                تصدير السجلات إكسل
              </Button>

              <Link to="/daily-beneficiaries/add">
                <Button variant="primary" size="sm" icon={UserPlus}>
                  إضافة مستفيد يومي
                </Button>
              </Link>
            </div>
          }
        />

        {/* Unified Tab Navigation Bar */}
        <div className="bg-white border border-[#E5E2D9] rounded-2xl p-2 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[#F0ECE1] pb-2">
            {tabsConfig.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#3F6B3A] text-white shadow-sm"
                      : "text-slate-600 hover:bg-[#FAF8F5] hover:text-[#111827]"
                  }`}
                >
                  <Icon size={16} className={isActive ? "text-white" : "text-[#C9A24A]"} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1: Dashboard / Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 shadow-xs flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#C9A24A]">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">إجمالي المسجلين اليوميين</p>
                  <h3 className="text-xl font-bold text-gray-900 mt-0.5">{stats.totalBeneficiaries} مستفيد</h3>
                  <span className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded font-bold">ملفات معتمدة</span>
                </div>
              </div>

              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 shadow-xs flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center text-[#3F6B3A]">
                  <PackageCheck size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">عمليات استلام اليوم</p>
                  <h3 className="text-xl font-bold text-gray-900 mt-0.5">{stats.todayTransactions} عملية</h3>
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold">نشاط اليوم</span>
                </div>
              </div>

              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 shadow-xs flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Package size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">سلال / مواد موزعة اليوم</p>
                  <h3 className="text-xl font-bold text-gray-900 mt-0.5">{stats.todayBaskets} سلة/طرد</h3>
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold">صرف عيني</span>
                </div>
              </div>

              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 shadow-xs flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
                  <Boxes size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">أصناف المستودع اليومي</p>
                  <h3 className="text-xl font-bold text-gray-900 mt-0.5">{stats.inventoryItems} صنف</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    stats.lowStockCount > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                  }`}>
                    {stats.lowStockCount > 0 ? `${stats.lowStockCount} بحاجة لتوريد` : "المخزون متوفر"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions and Highlights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Shortcuts */}
              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                  <ShieldCheck size={18} className="text-[#3F6B3A]" />
                  <span>الوصول السريع للعمليات التشغيلية</span>
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setTab("today")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-[#E5E2D9] hover:bg-[#FAF8F5] transition-colors text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-50 text-[#C9A24A]">
                        <Users size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">مستفيدو اليوم والمسجلون</div>
                        <div className="text-[11px] text-gray-500">البحث في السجلات وتعديل البيانات</div>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-gray-400 rotate-180" />
                  </button>

                  <button
                    onClick={() => setTab("deliveries")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-[#E5E2D9] hover:bg-[#FAF8F5] transition-colors text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-50 text-[#3F6B3A]">
                        <PackageCheck size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">تسليم وصرف المساعدات</div>
                        <div className="text-[11px] text-gray-500">صرف فوري وإصدار سند استلام رسمي</div>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-gray-400 rotate-180" />
                  </button>

                  <button
                    onClick={() => setTab("history")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-[#E5E2D9] hover:bg-[#FAF8F5] transition-colors text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                        <History size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">سجل الاستلامات التاريخي</div>
                        <div className="text-[11px] text-gray-500">مراجعة السندات وطباعة سندات الاستلام</div>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-gray-400 rotate-180" />
                  </button>

                  <button
                    onClick={() => setTab("inventory")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-[#E5E2D9] hover:bg-[#FAF8F5] transition-colors text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                        <Boxes size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">مستودع المساعدات اليومية</div>
                        <div className="text-[11px] text-gray-500">متابعة الأرصدة وتسجيل حركات التوريد والصرف</div>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-gray-400 rotate-180" />
                  </button>
                </div>
              </div>

              {/* Recent Transactions Stream */}
              <div className="lg:col-span-2 bg-white border border-[#E5E2D9] rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                    <Clock size={18} className="text-[#C9A24A]" />
                    <span>آخر سندات الاستلام المصروفة مؤخراً</span>
                  </h3>
                  <button
                    onClick={() => setTab("history")}
                    className="text-xs text-[#3F6B3A] font-bold hover:underline"
                  >
                    عرض السجل الكامل
                  </button>
                </div>

                {loadingStats ? (
                  <div className="p-8 text-center text-gray-400 text-xs">جاري تحميل أحدث العمليات...</div>
                ) : recentTransactions.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-xs border border-dashed border-[#E5E2D9] rounded-xl">
                    لا توجد عمليات استلام مسجلة اليوم حتى الآن.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-[#E5E2D9] text-gray-500 font-bold bg-[#FAF8F5]">
                          <th className="p-2.5">رقم السند</th>
                          <th className="p-2.5">المستفيد</th>
                          <th className="p-2.5">المادة المصروفة</th>
                          <th className="p-2.5">الكمية</th>
                          <th className="p-2.5">الوقت والتاريخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E2D9]">
                        {recentTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-[#FAF8F5] transition-colors">
                            <td className="p-2.5 font-bold font-mono text-[#C9A24A]">{tx.document_number}</td>
                            <td className="p-2.5 font-bold text-gray-900">{tx.beneficiary?.full_name || "—"}</td>
                            <td className="p-2.5">{tx.inventory_item?.name || tx.basket_type_name || "سلة غذائية"}</td>
                            <td className="p-2.5 font-bold">{tx.quantity}</td>
                            <td className="p-2.5 text-gray-500 font-mono">
                              {tx.receiving_date ? tx.receiving_date.slice(0, 16).replace("T", " ") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Today's Beneficiaries & Directory */}
        {activeTab === "today" && (
          <div className="space-y-4">
            <DailyBeneficiariesList embedded={true} />
          </div>
        )}

        {/* Tab 3: History */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <DailyBeneficiaryReceivingPage embedded={true} initialSubTab="transactions" />
          </div>
        )}

        {/* Tab 4: Deliveries & Assistance */}
        {activeTab === "deliveries" && (
          <div className="space-y-4">
            <DailyBeneficiaryReceivingPage embedded={true} initialSubTab="beneficiaries" />
          </div>
        )}

        {/* Tab 5: Inventory */}
        {activeTab === "inventory" && (
          <div className="space-y-4">
            <DailyInventoryPage embedded={true} />
          </div>
        )}

        {toast.show && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast({ show: false, message: "", type: "success" })}
          />
        )}
      </div>
    </MainLayout>
  );
}
