import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import MainLayout from "../../components/layout/MainLayout";
import PageHeader from "../../components/ui/PageHeader";
import KpiCard from "../../components/ui/KpiCard";
import Button from "../../components/ui/Button";
import Dialog from "../../components/overlays/Dialog";
import Toast from "../../components/ui/Toast";
import {
  getDailyBeneficiaries,
  getDailyInventory,
  getDailyReceivingTransactions,
  createDailyReceivingTransaction,
} from "../../api/dailyBeneficiaries";
import {
  Package,
  Search,
  CheckCircle2,
  Calendar,
  Printer,
  History,
  Users,
  ChevronRight,
  ChevronLeft,
  Filter,
  PlusCircle,
  FileText,
  UserCheck,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
import { exportApiDataToExcel } from "../../utils/excelExport";
import { getDocumentPdfUrl } from "../../utils/documentUrl";

export default function DailyBeneficiaryReceivingPage({ embedded = false, initialSubTab = "beneficiaries" }) {
  // Active Tab: 'beneficiaries' (Queue for receiving) | 'transactions' (Executed Vouchers History)
  const [activeTab, setActiveTab] = useState(initialSubTab);

  // Beneficiaries queue state
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(true);
  const [districts, setDistricts] = useState([]);
  const [searchBeneficiary, setSearchBeneficiary] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [paginationBeneficiaries, setPaginationBeneficiaries] = useState({ current_page: 1, last_page: 1, total: 0 });

  // Executed Transactions state
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [searchTx, setSearchTx] = useState("");
  const [txDateFrom, setTxDateFrom] = useState("");
  const [txDateTo, setTxDateTo] = useState("");
  const [paginationTx, setPaginationTx] = useState({ current_page: 1, last_page: 1, total: 0 });

  // Inventory items
  const [inventoryItems, setInventoryItems] = useState([]);

  // Receiving Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdVoucher, setCreatedVoucher] = useState(null);

  // Quick stats
  const [stats, setStats] = useState({ today_transactions: 0, today_baskets: 0, today_beneficiaries: 0 });

  // Toast
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // Load inventory items
  const loadInventory = async () => {
    try {
      const res = await getDailyInventory({ status: "available" });
      if (res.data?.success) {
        setInventoryItems(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load beneficiaries for receiving
  const loadBeneficiaries = async (page = 1) => {
    setLoadingBeneficiaries(true);
    try {
      const res = await getDailyBeneficiaries({
        page,
        per_page: 15,
        search: searchBeneficiary.trim() || undefined,
        district: selectedDistrict !== "all" ? selectedDistrict : undefined,
        status: "active", // Only active daily beneficiaries can receive
      });
      if (res.data?.success) {
        setBeneficiaries(res.data.data.data || []);
        setPaginationBeneficiaries({
          current_page: res.data.data.current_page,
          last_page: res.data.data.last_page,
          total: res.data.data.total,
        });
        if (res.data.districts) setDistricts(res.data.districts);
      }
    } catch (err) {
      setToast({ show: true, message: "فشل في تحميل قائمة المستفيدين", type: "error" });
    } finally {
      setLoadingBeneficiaries(false);
    }
  };

  // Load executed transactions history
  const loadTransactions = async (page = 1) => {
    setLoadingTransactions(true);
    try {
      const res = await getDailyReceivingTransactions({
        page,
        per_page: 15,
        search: searchTx.trim() || undefined,
        date_from: txDateFrom || undefined,
        date_to: txDateTo || undefined,
      });
      if (res.data?.success) {
        setTransactions(res.data.data.data || []);
        setPaginationTx({
          current_page: res.data.data.current_page,
          last_page: res.data.data.last_page,
          total: res.data.data.total,
        });
        if (res.data.stats) setStats(res.data.stats);
      }
    } catch (err) {
      setToast({ show: true, message: "فشل في تحميل سجل العمليات", type: "error" });
    } finally {
      setLoadingTransactions(false);
    }
  };

  useEffect(() => {
    loadInventory();
    loadBeneficiaries(1);
    loadTransactions(1);
  }, []);

  useEffect(() => {
    if (activeTab === "beneficiaries") {
      loadBeneficiaries(1);
    } else {
      loadTransactions(1);
    }
  }, [activeTab, selectedDistrict]);

  // Open modal for a specific beneficiary
  const openReceivingModalFor = (ben) => {
    setSelectedBeneficiary(ben);
    setCreatedVoucher(null);
    setQuantity(1);
    setNotes("");
    if (inventoryItems.length > 0 && !selectedItemId) {
      setSelectedItemId(inventoryItems[0].id);
    }
    setShowModal(true);
  };

  // Confirm and submit transaction
  const handleExecuteReceiving = async () => {
    if (!selectedBeneficiary) {
      setToast({ show: true, message: "يرجى تحديد المستفيد", type: "warning" });
      return;
    }
    if (!selectedItemId) {
      setToast({ show: true, message: "يرجى اختيار صنف أو سلة من المستودع", type: "warning" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await createDailyReceivingTransaction({
        daily_beneficiary_id: selectedBeneficiary.id,
        daily_inventory_item_id: selectedItemId,
        quantity: parseInt(quantity, 10) || 1,
        notes,
      });

      if (res.data?.success) {
        setCreatedVoucher(res.data.data);
        setToast({ show: true, message: res.data.message, type: "success" });
        loadInventory();
        loadBeneficiaries(paginationBeneficiaries.current_page);
        loadTransactions(1);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "فشل في تنفيذ عملية الاستلام";
      setToast({ show: true, message: msg, type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedInventoryItemObj = useMemo(() => {
    return inventoryItems.find((i) => i.id === selectedItemId);
  }, [inventoryItems, selectedItemId]);

  // Export ALL matching transactions to Excel
  const handleExportTransactionsExcel = async () => {
    try {
      setToast({ show: true, message: "جاري تجهيز وتصدير جميع سندات الاستلام المطابقة...", type: "info" });
      const params = {
        search: searchTx.trim() || undefined,
        date_from: txDateFrom || undefined,
        date_to: txDateTo || undefined,
      };

      const count = await exportApiDataToExcel({
        endpoint: "/daily-beneficiaries/receiving-history",
        params,
        filename: "ikram-daily-receiving-vouchers",
        sheetName: "سندات الاستلام اليومية",
        transform: (tx, idx) => ({
          "#": idx + 1,
          "رقم السند": tx.document_number,
          "اسم المستفيد": tx.beneficiary?.full_name || "—",
          "رقم الهوية / الإقامة": tx.beneficiary?.national_id || "—",
          "رقم الجوال": tx.beneficiary?.phone || "—",
          "الحي": tx.beneficiary?.district || "—",
          "المادة المستلمة": tx.inventory_item?.name || tx.basket_type_name || "سلة غذائية",
          "الكمية": tx.quantity,
          "تاريخ ووقت الاستلام": tx.receiving_date ? tx.receiving_date.slice(0, 16).replace("T", " ") : "—",
          "الموظف المعتمد": tx.authorized_user?.full_name || "مدير النظام",
          "ملاحظات": tx.notes || "",
        }),
      });

      setToast({ show: true, message: `تم تصدير ${count} سند استلام بنجاح إلى ملف إكسل.`, type: "success" });
    } catch (err) {
      setToast({ show: true, message: err.message || "فشل تصدير ملف الإكسل", type: "error" });
    }
  };

  const mainContent = (
    <div className="space-y-6" dir="rtl">
      {/* Page Header (only if standalone) */}
      {!embedded && (
        <PageHeader
          title="تسليم ومساعدات المستفيدين اليوميين"
          subtitle="صرف فوري للمواد مع التوثيق الذري وإصدار سندات الاستلام الرسمية المعتمدة"
          badge="صرف فوري"
          breadcrumbs={[
            { label: "المستفيدون اليوميون", to: "/daily-beneficiaries" },
            { label: "تسليم واستلام المساعدات" },
          ]}
        />
      )}

        {/* Top KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            title="إجمالي السلال المسلمة اليوم"
            value={stats.today_baskets}
            subtitle="صرف مباشر من المستودع"
            icon={Package}
            iconColor="green"
          />
          <KpiCard
            title="المستفيدون المخدومون اليوم"
            value={stats.today_beneficiaries}
            subtitle="مستفيد يومي نشط"
            icon={UserCheck}
            iconColor="gold"
          />
          <KpiCard
            title="سندات الاستلام الصادرة اليوم"
            value={stats.today_transactions}
            subtitle="سند معتمد وموثق"
            icon={History}
            iconColor="blue"
          />
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border border-[#E5E2D9] rounded-xl p-1.5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("beneficiaries")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === "beneficiaries"
                  ? "bg-[#3F6B3A] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Users className="w-4 h-4" />
              قائمة المستفيدين المؤهلين للتسليم
            </button>

            <button
              onClick={() => setActiveTab("transactions")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === "transactions"
                  ? "bg-[#3F6B3A] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <History className="w-4 h-4" />
              سجل سندات وعمليات الاستلام المنفذة
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 pl-3 text-xs text-slate-500">
            <span>المستودع اليومي:</span>
            <strong className="text-slate-800">{inventoryItems.length} أصناف متاحة</strong>
          </div>
        </div>

        {/* TAB 1: Beneficiaries Queue */}
        {activeTab === "beneficiaries" && (
          <div className="space-y-4">
            {/* Search & District Filter */}
            <div className="bg-[#FAF8F5] border border-[#E5E2D9] rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchBeneficiary}
                  onChange={(e) => setSearchBeneficiary(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadBeneficiaries(1)}
                  placeholder="ابحث باسم المستفيد، رقم الهوية، أو الجوال..."
                  className="w-full pl-3 pr-10 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                >
                  <option value="all">جميع الأحياء</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <button
                  onClick={() => loadBeneficiaries(1)}
                  className="px-4 py-2 bg-[#3F6B3A] text-white text-xs font-semibold rounded-lg hover:bg-[#345830] transition-colors"
                >
                  بحث
                </button>
              </div>
            </div>

            {/* Beneficiaries Table */}
            <div className="bg-white border border-[#E5E2D9] rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF8F5] text-slate-700 font-bold border-b border-[#E5E2D9]">
                      <th className="py-3 px-4">اسم المستفيد</th>
                      <th className="py-3 px-4">الهوية / الإقامة</th>
                      <th className="py-3 px-4">رقم الجوال</th>
                      <th className="py-3 px-4">الحي</th>
                      <th className="py-3 px-4 text-center">إجمالي الاستلامات</th>
                      <th className="py-3 px-4 text-center">تاريخ آخر استلام</th>
                      <th className="py-3 px-4 text-center">إجراء الاستلام</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingBeneficiaries ? (
                      <tr>
                        <td colSpan="7" className="py-10 text-center text-slate-400">
                          جاري تحميل قائمة المستفيدين...
                        </td>
                      </tr>
                    ) : beneficiaries.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-10 text-center text-slate-400">
                          لا يوجد مستفيدون نشطون يطابقون شروط البحث.
                        </td>
                      </tr>
                    ) : (
                      beneficiaries.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-800">
                            <Link to={`/daily-beneficiaries/${b.id}`} className="hover:text-[#3F6B3A] hover:underline">
                              {b.full_name}
                            </Link>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">{b.national_id}</td>
                          <td className="py-3 px-4 font-mono text-slate-600" dir="ltr">{b.phone}</td>
                          <td className="py-3 px-4 text-slate-600">{b.district || "غير محدد"}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-800">
                            <span className="px-2 py-0.5 bg-[#EBF4EA] rounded-full">
                              {b.total_received_count || 0} مرات
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500">
                            {b.last_delivery_date
                              ? new Date(b.last_delivery_date).toLocaleDateString("ar-SA")
                              : "لم يستلم بعد"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => openReceivingModalFor(b)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#3F6B3A] hover:bg-[#345830] text-white rounded-lg font-bold shadow-xs transition-colors"
                            >
                              <Package className="w-3.5 h-3.5" />
                              تسجيل استلام
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {paginationBeneficiaries.last_page > 1 && (
                <div className="p-3 border-t border-[#E5E2D9] flex items-center justify-between text-xs">
                  <span>
                    الصفحة {paginationBeneficiaries.current_page} من {paginationBeneficiaries.last_page} (إجمالي {paginationBeneficiaries.total})
                  </span>
                  <div className="flex gap-1">
                    <button
                      disabled={paginationBeneficiaries.current_page <= 1}
                      onClick={() => loadBeneficiaries(paginationBeneficiaries.current_page - 1)}
                      className="p-1.5 border rounded disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      disabled={paginationBeneficiaries.current_page >= paginationBeneficiaries.last_page}
                      onClick={() => loadBeneficiaries(paginationBeneficiaries.current_page + 1)}
                      className="p-1.5 border rounded disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Executed Transactions History */}
        {activeTab === "transactions" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-[#FAF8F5] border border-[#E5E2D9] rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTx}
                  onChange={(e) => setSearchTx(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadTransactions(1)}
                  placeholder="ابحث برقم السند، اسم المستفيد، أو رقم الهوية..."
                  className="w-full pl-3 pr-10 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type="date"
                  value={txDateFrom}
                  onChange={(e) => setTxDateFrom(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-[#E5E2D9] rounded-lg text-xs"
                />
                <button
                  onClick={() => loadTransactions(1)}
                  className="px-4 py-2 bg-[#3F6B3A] text-white text-xs font-semibold rounded-lg hover:bg-[#345830] transition-colors cursor-pointer"
                >
                  تصفية
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={FileSpreadsheet}
                  onClick={handleExportTransactionsExcel}
                >
                  تصدير إكسل
                </Button>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white border border-[#E5E2D9] rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF8F5] text-slate-700 font-bold border-b border-[#E5E2D9]">
                      <th className="py-3 px-4">رقم السند</th>
                      <th className="py-3 px-4">اسم المستفيد</th>
                      <th className="py-3 px-4">الهوية / الإقامة</th>
                      <th className="py-3 px-4">السلة / المادة</th>
                      <th className="py-3 px-4 text-center">الكمية</th>
                      <th className="py-3 px-4">تاريخ الاستلام</th>
                      <th className="py-3 px-4">الموظف المعتمد</th>
                      <th className="py-3 px-4 text-center">طباعة السند</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingTransactions ? (
                      <tr>
                        <td colSpan="8" className="py-10 text-center text-slate-400">
                          جاري تحميل سجل سندات الاستلام...
                        </td>
                      </tr>
                    ) : transactions.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="py-10 text-center text-slate-400">
                          لا توجد عمليات استلام مسجلة خلال الفترة المحددة.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#8C6C26]">{tx.document_number}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {tx.beneficiary?.full_name || "غير محدد"}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">{tx.beneficiary?.national_id || "-"}</td>
                          <td className="py-3 px-4 text-slate-800 font-semibold">{tx.basket_type_name}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-800">
                            <span className="px-2 py-0.5 bg-[#EBF4EA] rounded">
                              {tx.quantity} {tx.inventory_item?.unit || "سلة"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(tx.receiving_date).toLocaleString("ar-SA")}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {tx.authorized_user?.full_name || "مدير النظام"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <a
                              href={getDocumentPdfUrl(`/documents/daily-receiving/${tx.id}/pdf`)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#F5EDDA] hover:bg-[#ECE0C4] text-[#8C6C26] rounded-lg text-xs font-bold transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              سند PDF
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {paginationTx.last_page > 1 && (
                <div className="p-3 border-t border-[#E5E2D9] flex items-center justify-between text-xs">
                  <span>
                    الصفحة {paginationTx.current_page} من {paginationTx.last_page} (إجمالي {paginationTx.total})
                  </span>
                  <div className="flex gap-1">
                    <button
                      disabled={paginationTx.current_page <= 1}
                      onClick={() => loadTransactions(paginationTx.current_page - 1)}
                      className="p-1.5 border rounded disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      disabled={paginationTx.current_page >= paginationTx.last_page}
                      onClick={() => loadTransactions(paginationTx.current_page + 1)}
                      className="p-1.5 border rounded disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Register Receiving Transaction */}
        <Dialog
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="تسجيل استلام مساعدة للمستفيد اليومي"
          maxWidth="max-w-xl"
        >
          {selectedBeneficiary && (
            <div className="space-y-4">
              {createdVoucher ? (
                <div className="p-5 bg-[#EBF4EA] border border-[#3F6B3A]/30 rounded-xl space-y-3 text-center">
                  <CheckCircle2 className="w-12 h-12 text-[#3F6B3A] mx-auto" />
                  <h3 className="font-bold text-slate-800 text-base">تم تسجيل الاستلام وصرف السلة بنجاح!</h3>
                  <p className="text-xs text-slate-600">
                    رقم سند الاستلام الرسمي:{" "}
                    <strong className="text-[#8C6C26] font-mono text-sm block mt-1">
                      {createdVoucher.document_number}
                    </strong>
                  </p>
                  <div className="pt-3 flex justify-center gap-3">
                    <a
                      href={getDocumentPdfUrl(`/documents/daily-receiving/${createdVoucher.id}/pdf`)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#C9A24A] hover:bg-[#B8923D] text-white rounded-lg text-xs font-bold transition-colors shadow"
                    >
                      <Printer className="w-4 h-4" />
                      طباعة سند الاستلام (PDF)
                    </a>
                    <button
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Beneficiary Card Summary */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <strong className="text-slate-800 text-sm">{selectedBeneficiary.full_name}</strong>
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        مستفيد نشط
                      </span>
                    </div>
                    <div className="text-slate-500">
                      الهوية: <span className="font-mono text-slate-700">{selectedBeneficiary.national_id}</span> | الجوال: <span className="font-mono text-slate-700" dir="ltr">{selectedBeneficiary.phone}</span> | الحي: <span className="text-slate-700">{selectedBeneficiary.district}</span>
                    </div>
                    <div className="text-slate-500 pt-1">
                      إجمالي مرات الاستلام السابقة: <strong className="text-slate-800">{selectedBeneficiary.total_received_count || 0} مرات</strong>
                    </div>
                  </div>

                  {/* Basket / Item Selection from dedicated Daily Inventory */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      حدد سلة الدعم أو الصنف المطلوب صرفه *
                    </label>
                    <select
                      value={selectedItemId}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                    >
                      {inventoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} — المتوفر بالمستودع: ({item.current_quantity} {item.unit})
                        </option>
                      ))}
                    </select>

                    {selectedInventoryItemObj && (
                      <div className="mt-2 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded text-[11px] flex items-center justify-between">
                        <span>الرصيد المتاح حالياً في مستودع اليوميين:</span>
                        <strong className="text-emerald-800 font-bold">
                          {selectedInventoryItemObj.current_quantity} {selectedInventoryItemObj.unit}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">الكمية المصروفة *</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedInventoryItemObj?.current_quantity || 1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A]"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات على الاستلام (اختياري)</label>
                    <textarea
                      rows="2"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="تم التسليم بمقر الجمعية بحالة سليمة..."
                      className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      disabled={submitting || !selectedItemId || (selectedInventoryItemObj && selectedInventoryItemObj.current_quantity < quantity)}
                      onClick={handleExecuteReceiving}
                      className="px-5 py-2.5 bg-[#3F6B3A] hover:bg-[#345830] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {submitting ? "جاري التأكيد والخصم..." : "تأكيد الاستلام وخصم المخزون"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </Dialog>

        {/* Toast Notification */}
        <Toast
          show={toast.show}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      </div>
    );

    if (embedded) {
      return mainContent;
    }

    return <MainLayout>{mainContent}</MainLayout>;
  }
