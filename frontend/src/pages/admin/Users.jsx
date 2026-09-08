import { useEffect, useState } from "react";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import Dialog from "../../components/overlays/Dialog";
import ConfirmDialog from "../../components/overlays/ConfirmDialog";
import Toast from "../../components/ui/Toast";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  Shield, UserPlus, Key, CheckCircle, XCircle, Info, Lock,
  Trash2, Edit3, Check, X, ShieldAlert, Truck, UserCheck,
  Briefcase, User, Globe, RefreshCw, Copy, Eye, EyeOff, AlertTriangle
} from "lucide-react";

const LOCKED_ACCOUNTS_KEY = 'ikram_locked_accounts';
const FAILED_ATTEMPTS_KEY = 'ikram_failed_login_attempts';

// System Modules Definition for Permissions Matrix
export const SYSTEM_MODULES = [
  { key: "beneficiaries", name: "المستفيدون (مواطنون ومقيمون)", desc: "عرض وإضافة وتعديل وحذف ملفات المستفيدين" },
  { key: "daily_beneficiaries", name: "المستفيدون اليوميون والمستودع اليومي", desc: "إدارة المستفيدين اليوميين وسندات الاستلام ومستودع اليوميين" },
  { key: "warehouse", name: "المستودع والمخزون والتنبيهات", desc: "متابعة أرصدة السلال والمواد وتنبيهات انتهاء الصلاحية" },
  { key: "staff", name: "موظفو الجمعية", desc: "إدارة بيانات الموظفين والتابعين وسجل المستندات" },
  { key: "representatives", name: "الجهات المستفيدة", desc: "إدارة الجهات المستفيدة والمؤسسات وتخصيص الدعم" },
  { key: "delivery", name: "إدارة وتوصيل المنازل", desc: "توجيه التوصيل وتعيين السائقين وتوثيق الشحنات" },
  { key: "receiver", name: "صفحة الاستلام والمسح (QR)", desc: "مسح وتأكيد كود الـ QR ذو الاستخدام الواحد" },
  { key: "governance", name: "الحوكمة والمؤشرات والتقارير", desc: "الاطلاع على إحصائيات النظام ومؤشرات الأداء وتصدير التقارير" },
  { key: "audit", name: "سجل التدقيق والنشاطات", desc: "تتبع حركة العمليات وحسابات النظام والسجلات الرسمية" },
  { key: "settings", name: "إدارة النظام والحسابات", desc: "إنشاء الحسابات وتحديد الصلاحيات وضوابط الدخل المالي" },
];

const DEFAULT_FULL_PERMISSIONS = SYSTEM_MODULES.reduce((acc, m) => {
  acc[m.key] = { view: true, create: true, edit: true, delete: true, notifications: true };
  return acc;
}, {});

const DEFAULT_READONLY_PERMISSIONS = SYSTEM_MODULES.reduce((acc, m) => {
  acc[m.key] = { view: true, create: false, edit: false, delete: false, notifications: false };
  return acc;
}, {});

const ROLE_PERMISSIONS_PRESETS = {
  admin: {
    title: "المدير العام (Supervisor)",
    badge: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
    desc: "صلاحيات كاملة وغير محدودة لإدارة جميع الصفحات والعمليات وتحديد تصاريح بقية الحسابات.",
  },
  assistant_admin: {
    title: "مساعد / نائب المدير (Assistant Supervisor)",
    badge: "bg-green-100 text-green-900 border-green-300 font-bold",
    desc: "إدارة تشغيلية يومية، مراجعة المستفيدين والمستودع وتعيين السائقين وفق الصلاحيات الممنوحة.",
  },
  delivery_driver: {
    title: "سائق / مندوب التوصيل (Driver)",
    badge: "bg-blue-100 text-blue-900 border-blue-300 font-bold",
    desc: "عرض قوائم التوصيل المسندة إليه فقط وتأكيد الاستلام ومسح كود الـ QR (ممنوع من تعديل البيانات أو كشف الوثائق).",
  },
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lockedList, setLockedList] = useState([]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [reactivatingUser, setReactivatingUser] = useState(null);
  const [tempPasswordGenerated, setTempPasswordGenerated] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Toast feedback state
  const [toast, setToast] = useState({ isOpen: false, type: "success", message: "" });

  // Form State
  const [form, setForm] = useState({
    username: "",
    password: "",
    full_name: "",
    phone: "",
    role: "assistant_admin",
    is_active: true,
    must_change_password: true,
    permissions: JSON.parse(JSON.stringify(DEFAULT_FULL_PERMISSIONS)),
  });

  const triggerToast = (message, type = "success") => {
    setToast({ isOpen: true, message, type });
  };

  const loadLockedAccounts = () => {
    try {
      const locked = JSON.parse(localStorage.getItem(LOCKED_ACCOUNTS_KEY) || '[]');
      setLockedList(locked);
    } catch {
      setLockedList([]);
    }
  };

  const loadUsers = () => {
    setLoading(true);
    api.get("/users")
      .then((res) => {
        const raw = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setUsers(Array.isArray(raw) ? raw : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
    loadLockedAccounts();
  }, []);

  const generateDefaultPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = 'Ikram@' + Math.floor(1000 + Math.random() * 9000) + '!';
    setForm((f) => ({ ...f, password: pwd }));
    triggerToast("تم توليد كلمة مرور افتراضية قوية. تأكد من إبلاغ المستخدم بها.", "info");
  };

  const openAddUserModal = () => {
    setEditingUser(null);
    setForm({
      username: "",
      password: "Ikram@" + Math.floor(1000 + Math.random() * 9000) + "!",
      full_name: "",
      phone: "",
      role: "assistant_admin",
      is_active: true,
      must_change_password: true,
      permissions: JSON.parse(JSON.stringify(DEFAULT_FULL_PERMISSIONS)),
    });
    setShowPassword(false);
    setShowAddModal(true);
  };

  const openEditUserModal = (u) => {
    setEditingUser(u);
    const existingPerms = u.permissions && typeof u.permissions === "object" ? u.permissions : {};

    const mergedPerms = {};
    SYSTEM_MODULES.forEach((m) => {
      mergedPerms[m.key] = {
        view: existingPerms[m.key]?.view ?? true,
        create: existingPerms[m.key]?.create ?? true,
        edit: existingPerms[m.key]?.edit ?? true,
        delete: existingPerms[m.key]?.delete ?? false,
        notifications: existingPerms[m.key]?.notifications ?? true,
      };
    });

    setForm({
      username: u.username,
      password: "",
      full_name: u.full_name || u.name || "",
      phone: u.phone || "",
      role: u.role || "assistant_admin",
      is_active: u.is_active !== false,
      must_change_password: u.must_change_password ?? false,
      permissions: mergedPerms,
    });
    setShowPassword(false);
    setShowAddModal(true);
  };

  const handlePermissionToggle = (moduleKey, action) => {
    setForm((prev) => {
      const currentModule = prev.permissions[moduleKey] || { view: true, create: false, edit: false, delete: false, notifications: false };
      const updatedModule = { ...currentModule, [action]: !currentModule[action] };

      if (action === "view" && !updatedModule.view) {
        updatedModule.create = false;
        updatedModule.edit = false;
        updatedModule.delete = false;
        updatedModule.notifications = false;
      }

      if ((action === "create" || action === "edit" || action === "delete") && updatedModule[action]) {
        updatedModule.view = true;
      }

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [moduleKey]: updatedModule,
        },
      };
    });
  };

  const setAllPermissionsPreset = (presetType) => {
    if (presetType === "full") {
      setForm((prev) => ({
        ...prev,
        permissions: JSON.parse(JSON.stringify(DEFAULT_FULL_PERMISSIONS)),
      }));
    } else if (presetType === "readonly") {
      setForm((prev) => ({
        ...prev,
        permissions: JSON.parse(JSON.stringify(DEFAULT_READONLY_PERMISSIONS)),
      }));
    } else if (presetType === "clear") {
      const cleared = {};
      SYSTEM_MODULES.forEach((m) => {
        cleared[m.key] = { view: false, create: false, edit: false, delete: false, notifications: false };
      });
      setForm((prev) => ({ ...prev, permissions: cleared }));
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (!payload.password && editingUser) {
        delete payload.password;
      }

      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload);
        triggerToast("تم تحديث بيانات الحساب والصلاحيات بنجاح!");
      } else {
        await api.post("/users", payload);
        triggerToast("تم إنشاء الحساب الجديد بنجاح!");
      }
      setShowAddModal(false);
      loadUsers();
    } catch (err) {
      console.error(err);
      triggerToast(err.response?.data?.message || "حدث خطأ أثناء حفظ الحساب", "error");
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/users/${userToDelete.id}`);
      triggerToast(`تم حذف حساب (${userToDelete.name}) بنجاح.`);
      setUserToDelete(null);
      loadUsers();
    } catch (err) {
      console.error(err);
      triggerToast(err.response?.data?.message || "تعذر حذف الحساب.", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Reactivate locked account & issue temporary 1-day password
  const handleReactivateAccount = (userObj) => {
    const tempPass = 'Temp@' + Math.floor(1000 + Math.random() * 9000) + '!';
    setTempPasswordGenerated(tempPass);
    setReactivatingUser(userObj);
  };

  const confirmReactivation = async () => {
    if (!reactivatingUser) return;
    const clean = reactivatingUser.username.trim().toLowerCase();

    // Remove from locked accounts list
    const updatedLocked = lockedList.filter((u) => u !== clean);
    localStorage.setItem(LOCKED_ACCOUNTS_KEY, JSON.stringify(updatedLocked));
    setLockedList(updatedLocked);

    // Reset failed attempts
    try {
      const attempts = JSON.parse(localStorage.getItem(FAILED_ATTEMPTS_KEY) || '{}');
      delete attempts[clean];
      localStorage.setItem(FAILED_ATTEMPTS_KEY, JSON.stringify(attempts));
    } catch {}

    // Send API update if available
    try {
      await api.put(`/users/${reactivatingUser.id}`, {
        is_active: true,
        password: tempPasswordGenerated,
        must_change_password: true,
      });
    } catch (e) {
      console.warn("API reactivate fallback", e);
    }

    triggerToast(`تم تفعيل حساب ${reactivatingUser.username} وإصدار كلمة المرور المؤقتة بنجاح.`);
    setReactivatingUser(null);
    loadUsers();
  };

  return (
    <MainLayout>
      <div className="p-4 lg:p-6 max-w-7xl mx-auto" dir="rtl">
        {/* Top Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-[#111827] flex items-center gap-2">
              <Shield className="w-7 h-7 text-[#C9A24A]" />
              <span>إدارة الحسابات ومصفوفة الصلاحيات (RBAC & Security)</span>
            </h1>
            <p className="text-xs text-[#6B7280] mt-1">
              إدارة مستخدمي النظام وتعيين الصلاحيات الدقيقة وإعادة تفعيل الحسابات المقفلة
            </p>
          </div>

          <button
            onClick={openAddUserModal}
            className="flex items-center gap-2 bg-[#D97706] hover:bg-[#B45309] text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إنشاء حساب مستخدم جديد</span>
          </button>
        </div>

        {/* Roles Guide Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Object.entries(ROLE_PERMISSIONS_PRESETS).map(([key, info]) => (
            <div key={key} className="bg-white p-4 rounded-2xl border border-[#E5E2D9] shadow-xs">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${info.badge}`}>
                {info.title}
              </span>
              <p className="text-xs text-[#4B5563] mt-2 leading-relaxed">{info.desc}</p>
            </div>
          ))}
        </div>

        {/* Registered Users Table */}
        <div className="bg-white rounded-2xl border border-[#E5E2D9] p-5 shadow-xs">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#E5E2D9]">
            <h2 className="text-sm font-extrabold text-[#111827]">👥 قائمة مستخدمي النظام ومصفوفة الصلاحيات المخصصة</h2>
            <span className="text-xs bg-[#FAF8F5] text-[#C9A24A] px-3 py-1 rounded-full font-bold border border-[#E5E2D9]">
              إجمالي الحسابات: {users.length}
            </span>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-xs text-right">
              <thead className="bg-[#FAF8F5] text-[#111827] font-extrabold border-b border-[#E5E2D9]">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">اسم المستخدم</th>
                  <th className="p-3">الاسم الكامل</th>
                  <th className="p-3">نوع الحساب</th>
                  <th className="p-3">رقم الجوال</th>
                  <th className="p-3">حالة الحساب</th>
                  <th className="p-3 text-center">الصفحات المصرحة</th>
                  <th className="p-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2D9]">
                {loading && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">جاري تحميل قائمة الحسابات...</td>
                  </tr>
                )}
                {!loading && users.map((u, idx) => {
                  const isLocked = lockedList.includes(u.username?.trim().toLowerCase());
                  const userPerms = u.permissions || {};
                  const allowedPagesCount = Object.values(userPerms).filter((p) => p && p.view).length;

                  return (
                    <tr key={u.id || idx} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-[#C9A24A] font-mono">{u.username}</td>
                      <td className="p-3 font-bold text-[#111827]">{u.full_name || u.name}</td>
                      <td className="p-3">
                        {u.role === "admin" && (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1">
                            <Shield size={13} />
                            <span>المدير العام</span>
                          </span>
                        )}
                        {u.role === "assistant_admin" && (
                          <span className="bg-green-100 text-green-900 border border-green-300 px-2 py-0.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1">
                            <UserCheck size={13} />
                            <span>مساعد المدير</span>
                          </span>
                        )}
                        {u.role === "delivery_driver" && (
                          <span className="bg-blue-100 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1">
                            <Truck size={13} />
                            <span>سائق ميداني</span>
                          </span>
                        )}
                        {!["admin", "assistant_admin", "delivery_driver"].includes(u.role) && (
                          <span className="bg-gray-100 text-gray-800 border border-gray-300 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-gray-600">{u.phone || "—"}</td>
                      <td className="p-3">
                        {isLocked ? (
                          <StatusBadge status="locked" label="مقفل (3 محاولات)" />
                        ) : u.is_active !== false ? (
                          <StatusBadge status="active" label="نشط" />
                        ) : (
                          <StatusBadge status="suspended" label="موقوف" />
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className="bg-[#FAF8F5] text-[#111827] border border-[#E5E2D9] px-2.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1">
                          <Globe size={13} className="text-[#C9A24A]" />
                          <span>{allowedPagesCount > 0 ? `${allowedPagesCount} صفحات مصرحة` : "جميع الصفحات"}</span>
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isLocked && (
                            <button
                              onClick={() => handleReactivateAccount(u)}
                              className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-800 rounded-xl border border-green-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              title="إعادة تفعيل الحساب المقفل وإصدار كلمة مرور مؤقتة"
                            >
                              <RefreshCw size={12} />
                              <span>إعادة تفعيل</span>
                            </button>
                          )}

                          <button
                            onClick={() => openEditUserModal(u)}
                            className="p-1.5 bg-[#FAF8F5] hover:bg-gray-100 text-[#C9A24A] rounded-xl border border-[#E5E2D9] cursor-pointer transition-colors"
                            title="تعديل الحساب وتخصيص الصلاحيات"
                          >
                            <Key size={14} />
                          </button>

                          {u.username !== 'admin' && (
                            <button
                              onClick={() => setUserToDelete({ id: u.id, name: u.full_name || u.username })}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-[#C24B3F] rounded-xl border border-red-200 cursor-pointer transition-colors"
                              title="حذف الحساب نهائياً"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── ADD / EDIT USER MODAL ─── */}
        <Dialog
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title={editingUser ? `تعديل صلاحيات (${editingUser.full_name || editingUser.username})` : "إنشاء حساب مستخدم جديد"}
          subtitle="تحديد الدور ومصفوفة الصلاحيات الخاصة بالصفحات والإجراءات وإدارة كلمة المرور"
          icon={Shield}
          maxWidth="max-w-3xl"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                className="px-5 py-2 bg-[#D97706] hover:bg-[#B45309] text-white font-extrabold rounded-xl text-xs shadow-xs"
              >
                {editingUser ? "حفظ التعديلات والتصاريح" : "إنشاء الحساب وتفعيل الصلاحيات"}
              </button>
            </div>
          }
        >
          <form className="space-y-4" dir="rtl">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#111827] mb-1">اسم المستخدم (Username) *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  disabled={!!editingUser}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E2D9] text-xs font-mono disabled:bg-gray-100"
                  placeholder="مثال: assistant_omar"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111827] mb-1">الاسم الكامل للموظف *</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E2D9] text-xs"
                  placeholder="مثال: عمر بن خالد السلمي"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111827] mb-1">رقم الجوال *</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E2D9] text-xs font-mono"
                  placeholder="05XXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111827] mb-1">الدور الأساسي (System Role) *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E2D9] text-xs font-bold"
                >
                  <option value="assistant_admin">مساعد / نائب المدير (Assistant Supervisor)</option>
                  <option value="delivery_driver">سائق ميداني (Delivery Driver)</option>
                  <option value="admin">المدير العام (Supervisor)</option>
                </select>
              </div>
            </div>

            {/* Password section with generator & warning */}
            <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#E5E2D9] space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#111827]">
                  {editingUser ? "تغيير كلمة المرور (اتركه فارغاً للإبقاء على الحالية)" : "كلمة المرور الافتراضية *"}
                </label>
                <button
                  type="button"
                  onClick={generateDefaultPassword}
                  className="text-xs text-[#D97706] hover:underline font-bold flex items-center gap-1"
                >
                  <RefreshCw size={13} />
                  <span>توليد كلمة مرور قوية</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editingUser}
                  className="w-full pr-3.5 pl-20 py-2.5 rounded-xl border border-[#E5E2D9] text-xs font-mono bg-white"
                  placeholder="••••••••"
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  {form.password && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(form.password);
                        triggerToast("تم نسخ كلمة المرور إلى الحافظة", "info");
                      }}
                      className="p-1 text-[#C9A24A] hover:text-[#B45309]"
                      title="نسخ كلمة المرور"
                    >
                      <Copy size={15} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="must_change_password"
                  checked={form.must_change_password}
                  onChange={(e) => setForm({ ...form, must_change_password: e.target.checked })}
                  className="w-4 h-4 accent-[#D97706] rounded"
                />
                <label htmlFor="must_change_password" className="text-xs text-[#111827] font-bold cursor-pointer">
                  إلزام المستخدم بتغيير كلمة المرور فور تسجيل دخوله الأول للنظام (موصى به أمنياً)
                </label>
              </div>

              <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
                <AlertTriangle size={14} className="flex-shrink-0 text-amber-700" />
                <span>تحذير أمني: لا تشارك كلمات المرور عبر قنوات غير مشفرة. كلمة المرور الافتراضية مخفية تلقائياً.</span>
              </div>
            </div>

            {/* Permissions Matrix */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-extrabold text-xs text-[#111827]">مصفوفة الصلاحيات المخصصة للمستخدم:</h4>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAllPermissionsPreset("full")}
                    className="px-2 py-0.5 bg-green-50 text-green-800 border border-green-200 rounded-lg text-[11px] font-bold"
                  >
                    تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllPermissionsPreset("readonly")}
                    className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-[11px] font-bold"
                  >
                    عرض فقط
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllPermissionsPreset("clear")}
                    className="px-2 py-0.5 bg-red-50 text-red-800 border border-red-200 rounded-lg text-[11px] font-bold"
                  >
                    إلغاء الكل
                  </button>
                </div>
              </div>

              <div className="border border-[#E5E2D9] rounded-xl overflow-hidden">
                <table className="w-full text-xs text-right">
                  <thead className="bg-[#FAF8F5] font-bold border-b border-[#E5E2D9]">
                    <tr>
                      <th className="p-2.5">القسم</th>
                      <th className="p-2.5 text-center">عرض</th>
                      <th className="p-2.5 text-center">إضافة</th>
                      <th className="p-2.5 text-center">تعديل</th>
                      <th className="p-2.5 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E2D9]">
                    {SYSTEM_MODULES.map((mod) => {
                      const mPerms = form.permissions[mod.key] || { view: false, create: false, edit: false, delete: false };
                      return (
                        <tr key={mod.key} className="hover:bg-[#FAF8F5]">
                          <td className="p-2.5 font-bold text-[#111827]">{mod.name}</td>
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={!!mPerms.view}
                              onChange={() => handlePermissionToggle(mod.key, "view")}
                              className="accent-[#3F6B3A]"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={!!mPerms.create}
                              onChange={() => handlePermissionToggle(mod.key, "create")}
                              className="accent-[#D97706]"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={!!mPerms.edit}
                              onChange={() => handlePermissionToggle(mod.key, "edit")}
                              className="accent-[#C9A24A]"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={!!mPerms.delete}
                              onChange={() => handlePermissionToggle(mod.key, "delete")}
                              className="accent-[#C24B3F]"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </form>
        </Dialog>

        {/* ─── REACTIVATE MODAL (1-Day Temporary Password) ─── */}
        {reactivatingUser && (
          <Dialog
            isOpen={!!reactivatingUser}
            onClose={() => setReactivatingUser(null)}
            title={`إعادة تفعيل حساب (${reactivatingUser.username})`}
            subtitle="إلغاء قفل الحساب وإصدار كلمة مرور مؤقتة صالحة لمدة يوم واحد"
            icon={RefreshCw}
            maxWidth="max-w-md"
            footer={
              <div className="flex items-center justify-end gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setReactivatingUser(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmReactivation}
                  className="px-5 py-2 bg-[#3F6B3A] hover:bg-[#31542D] text-white font-extrabold rounded-xl text-xs shadow-xs"
                >
                  تأكيد تفعيل الحساب
                </button>
              </div>
            }
          >
            <div className="space-y-4 text-xs text-right" dir="rtl">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                <p className="font-bold">
                  سيتم رفع حظر تسجيل الدخول عن هذا الحساب، وإصدار كلمة المرور المؤقتة التالية الصالحة لمدة 24 ساعة:
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border-2 border-[#C9A24A] flex items-center justify-between font-mono text-sm">
                <span className="font-bold text-[#111827]">{tempPasswordGenerated}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPasswordGenerated);
                    triggerToast("تم نسخ كلمة المرور المؤقتة", "info");
                  }}
                  className="p-1.5 bg-[#FAF8F5] rounded-lg text-[#C9A24A] hover:text-[#B45309]"
                  title="نسخ كلمة المرور"
                >
                  <Copy size={16} />
                </button>
              </div>

              <p className="text-[11px] text-[#6B7280]">
                ⚠️ سيلزم النظام المستخدم بتغيير هذه الكلمة المؤقتة إلى كلمة مرور شخصية جديدة فور دخوله الناجح.
              </p>
            </div>
          </Dialog>
        )}

        {/* ─── CONFIRM DELETE DIALOG ─── */}
        <ConfirmDialog
          isOpen={!!userToDelete}
          onClose={() => setUserToDelete(null)}
          onConfirm={handleConfirmDeleteUser}
          title={`حذف حساب (${userToDelete?.name})`}
          message={`هل أنت متأكد من رغبتك في حذف حساب (${userToDelete?.name}) نهائياً من النظام؟`}
          confirmLabel="حذف نهائياً"
          cancelLabel="إلغاء"
          loading={deleteLoading}
        />

        {/* ─── TOAST FEEDBACK ─── */}
        <Toast
          isOpen={toast.isOpen}
          onClose={() => setToast({ ...toast, isOpen: false })}
          type={toast.type}
          message={toast.message}
        />
      </div>
    </MainLayout>
  );
}
