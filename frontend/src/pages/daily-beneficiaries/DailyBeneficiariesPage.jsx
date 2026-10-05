import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import MainLayout from "../../components/layout/MainLayout";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import SummaryCard from "../../components/ui/SummaryCard";
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
  Package,
  Clock,
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
        <div className="ikram-panel p-2">
          <div className="flex items-center gap-1.5 overflow-x-auto" role="tablist" aria-label="أقسام المستفيدين اليوميين">
            {tabsConfig.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setTab(t.key)}
                  className={`flex min-h-10 items-center gap-2 whitespace-nowrap rounded-[10px] px-4 py-2.5 text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-[var(--color-brand-green)] text-white shadow-sm"
                      : "text-slate-600 hover:bg-[var(--color-bg-soft)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Icon size={16} className={isActive ? "text-white" : "text-[var(--color-brand-gold)]"} />
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
              <SummaryCard label="إجمالي المسجلين اليوميين" value={`${stats.totalBeneficiaries} مستفيد`} hint="ملفات المستفيدين اليومية المعتمدة" icon={Users} tone="gold" />
              <SummaryCard label="عمليات استلام اليوم" value={`${stats.todayTransactions} عملية`} hint="النشاط التشغيلي المسجل اليوم" icon={PackageCheck} tone="green" />
              <SummaryCard label="السلال والمواد الموزعة" value={`${stats.todayBaskets} سلة/طرد`} hint="إجمالي الصرف العيني اليوم" icon={Package} tone="blue" />
              <SummaryCard label="أصناف المستودع اليومي" value={`${stats.inventoryItems} صنف`} hint={stats.lowStockCount > 0 ? `${stats.lowStockCount} بحاجة إلى توريد` : "المخزون متوفر"} icon={Boxes} tone={stats.lowStockCount > 0 ? "red" : "green"} />
            </div>

            {/* Quick Actions and Highlights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Shortcuts */}
              <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  <ShieldCheck size={18} className="text-[var(--color-brand-green)]" />
                  <span>الوصول السريع للعمليات التشغيلية</span>
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setTab("today")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-bg-soft)] transition-colors text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[var(--color-bg-soft)] text-[var(--color-brand-gold)]">
                        <Users size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--color-text-primary)]">مستفيدو اليوم والمسجلون</div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">البحث في السجلات وتعديل البيانات</div>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-[var(--color-text-muted)] rotate-180" />
                  </button>

                  <button
                    onClick={() => setTab("deliveries")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-bg-soft)] transition-colors text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-50 text-[var(--color-brand-green)]">
                        <PackageCheck size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--color-text-primary)]">تسليم وصرف المساعدات</div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">صرف فوري وإصدار سند استلام رسمي</div>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-[var(--color-text-muted)] rotate-180" />
                  </button>

                  <button
                    onClick={() => setTab("history")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-bg-soft)] transition-colors text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                        <History size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--color-text-primary)]">سجل الاستلامات التاريخي</div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">مراجعة السندات وطباعة سندات الاستلام</div>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-[var(--color-text-muted)] rotate-180" />
                  </button>

                  <button
                    onClick={() => setTab("inventory")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-bg-soft)] transition-colors text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                        <Boxes size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--color-text-primary)]">مستودع المساعدات اليومية</div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">متابعة الأرصدة وتسجيل حركات التوريد والصرف</div>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-[var(--color-text-muted)] rotate-180" />
                  </button>
                </div>
              </div>

              {/* Recent Transactions Stream */}
              <div className="lg:col-span-2 bg-white border border-[var(--color-border)] rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                    <Clock size={18} className="text-[var(--color-brand-gold)]" />
                    <span>آخر سندات الاستلام المصروفة مؤخراً</span>
                  </h3>
                  <button
                    onClick={() => setTab("history")}
                    className="text-xs text-[var(--color-brand-green)] font-bold hover:underline"
                  >
                    عرض السجل الكامل
                  </button>
                </div>

                {loadingStats ? (
                  <div className="p-8 text-center text-[var(--color-text-muted)] text-xs">جاري تحميل أحدث العمليات...</div>
                ) : recentTransactions.length === 0 ? (
                  <div className="p-8 text-center text-[var(--color-text-muted)] text-xs border border-dashed border-[var(--color-border)] rounded-xl">
                    لا توجد عمليات استلام مسجلة اليوم حتى الآن.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-bold bg-[var(--color-bg-soft)]">
                          <th className="p-2.5">رقم السند</th>
                          <th className="p-2.5">المستفيد</th>
                          <th className="p-2.5">المادة المصروفة</th>
                          <th className="p-2.5">الكمية</th>
                          <th className="p-2.5">الوقت والتاريخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {recentTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-[var(--color-bg-soft)] transition-colors">
                            <td className="p-2.5 font-bold font-mono text-[var(--color-brand-gold)]">{tx.document_number}</td>
                            <td className="p-2.5 font-bold text-[var(--color-text-primary)]">{tx.beneficiary?.full_name || "—"}</td>
                            <td className="p-2.5">{tx.inventory_item?.name || tx.basket_type_name || "سلة غذائية"}</td>
                            <td className="p-2.5 font-bold">{tx.quantity}</td>
                            <td className="p-2.5 text-[var(--color-text-muted)] font-mono">
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
