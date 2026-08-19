import { useEffect, useState } from "react";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import Dialog from "../../components/overlays/Dialog";
import ConfirmDialog from "../../components/overlays/ConfirmDialog";
import Toast from "../../components/ui/Toast";
import { Shield, UserPlus, Key, CheckCircle, XCircle, Info, Lock, Trash2, Edit3, Check, X, ShieldAlert, Truck, UserCheck, Briefcase, User, Globe } from "lucide-react";

// System Modules Definition for Permissions Matrix
export const SYSTEM_MODULES = [
  { key: "beneficiaries", name: "المستفيدون (مواطنون ومقيمون)", desc: "عرض وإضافة وتعديل وحذف ملفات المستفيدين" },
  { key: "warehouse", name: "المستودع والمخزون", desc: "متابعة أرصدة السلال والمواد وإجراء التعديلات" },
  { key: "staff", name: "موظفو الجمعية", desc: "إدارة بيانات الموظفين والتابعين وسجل المستندات" },
  { key: "representatives", name: "مناديب الأحياء", desc: "إدارة مناديب الأحياء والوثائق وتخصيص الدعم" },
  { key: "delivery", name: "إدارة وتوصيل المنازل", desc: "توجيه التوصيل لكبار السن وتعيين السائقين" },
  { key: "receiver", name: "صفحة الاستلام والمسح (QR)", desc: "مسح وتأكيد كود الـ QR عند التسليم الميداني" },
  { key: "governance", name: "الحوكمة والمؤشرات", desc: "الاطلاع على إحصائيات النظام ومؤشرات الأداء" },
  { key: "audit", name: "سجل التدقيق والوثائق", desc: "تتبع حركة العمليات والسجلات الرسمية بالنظام" },
  { key: "settings", name: "إدارة النظام والحسابات", desc: "إنشاء الحسابات وتحديد الصلاحيات وضوابط الدخل" },
];

const DEFAULT_FULL_PERMISSIONS = SYSTEM_MODULES.reduce((acc, m) => {
  acc[m.key] = { view: true, create: true, edit: true, delete: true };
  return acc;
}, {});

const DEFAULT_READONLY_PERMISSIONS = SYSTEM_MODULES.reduce((acc, m) => {
  acc[m.key] = { view: true, create: false, edit: false, delete: false };
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
    desc: "إدارة تشغيلية يومية، مراجعة المستفيدين وتعيين السائقين وتوجيه التوصيل مع إمكانية التحكّم بالصلاحيات.",
  },
  delivery_driver: {
    title: "سائق / مندوب التوصيل (Driver)",
    badge: "bg-blue-100 text-blue-900 border-blue-300 font-bold",
    desc: "عرض قوائم التوصيل المسندة إليه فقط وتأكيد الاستلام ومسح كود الـ QR.",
  },
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // User currently being edited
  const [userToDelete, setUserToDelete] = useState(null); // User to confirm deletion
  const [deleteLoading, setDeleteLoading] = useState(false);

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
    permissions: JSON.parse(JSON.stringify(DEFAULT_FULL_PERMISSIONS)),
  });

  const triggerToast = (message, type = "success") => {
    setToast({ isOpen: true, message, type });
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
  }, []);

  const openAddUserModal = () => {
    setEditingUser(null);
    setForm({
      username: "",
      password: "",
      full_name: "",
      phone: "",
      role: "assistant_admin",
      is_active: true,
      permissions: JSON.parse(JSON.stringify(DEFAULT_FULL_PERMISSIONS)),
    });
    setShowAddModal(true);
  };

  const openEditUserModal = (u) => {
    setEditingUser(u);
    const existingPerms = u.permissions && typeof u.permissions === "object" ? u.permissions : {};
    
    // Merge existing perms with default list
    const mergedPerms = {};
    SYSTEM_MODULES.forEach((m) => {
      mergedPerms[m.key] = {
        view: existingPerms[m.key]?.view ?? true,
        create: existingPerms[m.key]?.create ?? true,
        edit: existingPerms[m.key]?.edit ?? true,
        delete: existingPerms[m.key]?.delete ?? false,
      };
    });

    setForm({
      username: u.username,
      password: "",
      full_name: u.full_name || u.name || "",
      phone: u.phone || "",
      role: u.role || "assistant_admin",
      is_active: u.is_active !== false,
      permissions: mergedPerms,
    });
    setShowAddModal(true);
  };

  const handlePermissionToggle = (moduleKey, action) => {
    setForm((prev) => {
      const currentModule = prev.permissions[moduleKey] || { view: true, create: false, edit: false, delete: false };
      const updatedModule = { ...currentModule, [action]: !currentModule[action] };

      if (action === "view" && !updatedModule.view) {
        updatedModule.create = false;
        updatedModule.edit = false;
        updatedModule.delete = false;
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
      setForm((prev) => ({ ...prev, permissions: JSON.parse(JSON.stringify(DEFAULT_FULL_PERMISSIONS)) }));
    } else if (presetType === "readonly") {
      setForm((prev) => ({ ...prev, permissions: JSON.parse(JSON.stringify(DEFAULT_READONLY_PERMISSIONS)) }));
    } else if (presetType === "clear") {
      const cleared = {};
      SYSTEM_MODULES.forEach((m) => {
        cleared[m.key] = { view: false, create: false, edit: false, delete: false };
      });
      setForm((prev) => ({ ...prev, permissions: cleared }));
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Edit User
        const payload = {
          full_name: form.full_name,
          phone: form.phone,
          role: form.role,
          is_active: form.is_active,
          permissions: form.permissions,
        };
        if (form.password) payload.password = form.password;

        await api.put(`/users/${editingUser.id}`, payload);
        triggerToast(`تم تحديث بيانات وصلاحيات الحساب (${form.full_name}) بنجاح!`, "success");
      } else {
        // Create New User
        await api.post("/users", form);
        triggerToast(`تم إنشاء الحساب وتحديد الصلاحيات لـ (${form.full_name}) بنجاح!`, "success");
      }

      setShowAddModal(false);
      loadUsers();
    } catch (err) {
      triggerToast(err.response?.data?.message || "حدث خطأ أثناء حفظ بيانات الحساب وصلاحياته.", "error");
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/users/${userToDelete.id}`);
      triggerToast(`تم حذف حساب (${userToDelete.name}) بنجاح.`, "success");
      setUserToDelete(null);
      loadUsers();
    } catch (err) {
      triggerToast(err.response?.data?.message || "تعذر حذف الحساب.", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Shield className="w-7 h-7 text-amber-600" />
              <span>إدارة الحسابات والصلاحيات والأدوار</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              التحكم الشامل بصلاحيات الدخول، الإضافة، التعديل، والحذف لكل صفحة وحساب بالنظام
            </p>
          </div>

          <button
            onClick={openAddUserModal}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ إنشاء حساب جديد وتحديد الصلاحيات</span>
          </button>
        </div>

        {/* Roles Guide Cards */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Info className="w-5 h-5 text-amber-600" />
            <span>تصنيف الحسابات والدليل المعتمد للصلاحيات:</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(ROLE_PERMISSIONS_PRESETS).map(([key, info]) => (
              <div key={key} className="bg-white p-4 rounded-2xl shadow-xs border border-gray-200">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${info.badge}`}>
                  {info.title}
                </span>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">{info.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Registered Users Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-gray-800">👥 قائمة مستخدمي النظام ومصفوفة الصلاحيات المخصصة</h2>
            <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">
              إجمالي الحسابات: {users.length}
            </span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-2xl">
            <table className="w-full text-xs text-right">
              <thead className="bg-amber-50/80 text-amber-950 font-bold border-b">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3 font-bold">اسم المستخدم</th>
                  <th className="p-3 font-bold">الاسم الكامل</th>
                  <th className="p-3 font-bold">نوع الحساب</th>
                  <th className="p-3 font-bold">رقم الجوال</th>
                  <th className="p-3 font-bold">حالة الحساب</th>
                  <th className="p-3 font-bold text-center">الصفحات المصرحة</th>
                  <th className="p-3 font-bold text-center">إجراءات الصلاحيات</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">جاري تحميل قائمة الحسابات...</td>
                  </tr>
                )}
                {!loading && users.map((u, idx) => {
                  const userPerms = u.permissions || {};
                  const allowedPagesCount = Object.values(userPerms).filter((p) => p && p.view).length;

                  return (
                    <tr key={u.id || idx} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-amber-900 font-mono">{u.username}</td>
                      <td className="p-3 font-bold text-gray-800">{u.full_name || u.name}</td>
                      <td className="p-3">
                        {u.role === "admin" && (
                          <span className="bg-amber-100/90 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5" title="المدير العام">
                            <Shield className="w-3.5 h-3.5 text-amber-700" />
                            <span>المدير العام</span>
                          </span>
                        )}
                        {u.role === "assistant_admin" && (
                          <span className="bg-emerald-100/90 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5" title="مساعد المدير">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                            <span>مساعد المدير</span>
                          </span>
                        )}
                        {u.role === "delivery_driver" && (
                          <span className="bg-blue-100/90 text-blue-900 border border-blue-300 px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5" title="سائق التوصيل">
                            <Truck className="w-3.5 h-3.5 text-blue-700" />
                            <span>سائق توصيل</span>
                          </span>
                        )}
                        {!["admin", "assistant_admin", "delivery_driver"].includes(u.role) && (
                          <span className="bg-gray-100 text-gray-800 border border-gray-300 px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-gray-600" />
                            <span>{u.role}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-gray-600">{u.phone || "—"}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 ${
                          u.is_active !== false ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-red-100 text-red-800 border border-red-300"
                        }`}>
                          {u.is_active !== false ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-red-600" />}
                          <span>{u.is_active !== false ? "نشط" : "معطل"}</span>
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="bg-amber-50 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 mx-auto" title="عدد الصفحات المتاحة للحساب">
                          <Globe className="w-3.5 h-3.5 text-amber-700" />
                          <span>{allowedPagesCount > 0 ? `${allowedPagesCount} صفحات مصرحة` : "جميع الصفحات (افتراضي)"}</span>
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditUserModal(u)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl border border-amber-200 cursor-pointer transition-all"
                            title="تعديل الحساب وتخصيص الصلاحيات"
                          >
                            <Key className="w-4 h-4" />
                          </button>

                          {u.username !== 'admin' && (
                            <button
                              onClick={() => setUserToDelete({ id: u.id, name: u.full_name || u.username })}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 cursor-pointer transition-all"
                              title="حذف الحساب نهائياً"
                            >
                              <Trash2 className="w-4 h-4" />
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

        {/* ─── ADD / EDIT USER & PERMISSIONS MATRIX DIALOG ─── */}
        <Dialog
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title={editingUser ? `✏️ تعديل بيانات وتصاريح حساب (${form.full_name})` : "➕ إنشاء حساب جديد وتخصيص الصلاحيات"}
          subtitle="تحديد بيانات الحساب ومصفوفة الصلاحيات المتاحة بكل صفحة بالنظام"
          icon={ShieldAlert}
          maxWidth="max-w-4xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                className="px-7 py-2.5 rounded-xl bg-amber-600 text-white font-extrabold hover:bg-amber-700 shadow-md cursor-pointer text-xs"
              >
                💾 حفظ وتطبيق الصلاحيات للحساب
              </button>
            </>
          }
        >
          <form onSubmit={handleSaveUser} className="space-y-6 text-xs">
            {/* Basic User Information */}
            <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">اسم المستخدم للدخول *</label>
                <input
                  required
                  disabled={!!editingUser}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="مثال: assistant1"
                  className="w-full rounded-xl border border-gray-300 p-2.5 font-mono text-right disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {editingUser ? "كلمة المرور الجديدة (أتركها فارغة للإبقاء على الحالية)" : "كلمة المرور *"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-gray-300 p-2.5 font-mono text-right"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">الاسم الكامل لمالك الحساب *</label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="الاسم الثلاثي"
                  className="w-full rounded-xl border border-gray-300 p-2.5 font-bold text-right"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">رقم الهاتف</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="05XXXXXXXX"
                  className="w-full rounded-xl border border-gray-300 p-2.5 font-mono text-right"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">نوع الدور العام *</label>
                <select
                  required
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 bg-white text-right font-bold"
                >
                  <option value="assistant_admin">مساعد / نائب المدير (Assistant Supervisor)</option>
                  <option value="delivery_driver">سائق / مندوب التوصيل (Driver)</option>
                  <option value="admin">مدير النظام (Supervisor)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">حالة الحساب</label>
                <select
                  value={form.is_active ? "active" : "inactive"}
                  onChange={(e) => setForm({ ...form, is_active: e.target.value === "active" })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 bg-white text-right font-bold"
                >
                  <option value="active">نشط (مسموح بالدخول)</option>
                  <option value="inactive">معطل (موقوف)</option>
                </select>
              </div>
            </div>

            {/* PERMISSIONS MATRIX TABLE */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div>
                  <h4 className="font-extrabold text-amber-900 text-sm flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-amber-600" />
                    <span>مصفوفة صلاحيات الصفحات والعمليات (View / Add / Edit / Delete)</span>
                  </h4>
                  <p className="text-gray-500 text-[11px] mt-0.5">حدد الصفحات المتاحة للعرض، والإجراءات المسموح بها للمستخدم بالتفصيل:</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAllPermissionsPreset("full")}
                    className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-xl text-[11px] font-bold cursor-pointer hover:bg-emerald-200"
                  >
                    ✓ تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllPermissionsPreset("readonly")}
                    className="bg-blue-100 text-blue-800 border border-blue-300 px-3 py-1 rounded-xl text-[11px] font-bold cursor-pointer hover:bg-blue-200"
                  >
                    👁️ عرض فقط
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllPermissionsPreset("clear")}
                    className="bg-red-100 text-red-800 border border-red-300 px-3 py-1 rounded-xl text-[11px] font-bold cursor-pointer hover:bg-red-200"
                  >
                    ✕ إلغاء الكل
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                <table className="w-full text-xs text-right">
                  <thead className="bg-amber-100/70 text-amber-950 font-bold border-b">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3 font-bold">اسم الصفحة / القسم</th>
                      <th className="p-3 font-bold text-center">الاطلاع (View)</th>
                      <th className="p-3 font-bold text-center">الإضافة (Create)</th>
                      <th className="p-3 font-bold text-center">التعديل (Edit)</th>
                      <th className="p-3 font-bold text-center">الحذف (Delete)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SYSTEM_MODULES.map((mod, idx) => {
                      const mPerms = form.permissions[mod.key] || { view: false, create: false, edit: false, delete: false };

                      return (
                        <tr key={mod.key} className="border-b hover:bg-amber-50/30 transition-colors">
                          <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-extrabold text-gray-900">{mod.name}</div>
                            <div className="text-[10px] text-gray-500">{mod.desc}</div>
                          </td>

                          <td className="p-3 text-center">
                            <label className="inline-flex items-center justify-center p-2 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer hover:bg-amber-50">
                              <input
                                type="checkbox"
                                checked={!!mPerms.view}
                                onChange={() => handlePermissionToggle(mod.key, "view")}
                                className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                              />
                            </label>
                          </td>

                          <td className="p-3 text-center">
                            <label className="inline-flex items-center justify-center p-2 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer hover:bg-amber-50">
                              <input
                                type="checkbox"
                                checked={!!mPerms.create}
                                onChange={() => handlePermissionToggle(mod.key, "create")}
                                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                              />
                            </label>
                          </td>

                          <td className="p-3 text-center">
                            <label className="inline-flex items-center justify-center p-2 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer hover:bg-amber-50">
                              <input
                                type="checkbox"
                                checked={!!mPerms.edit}
                                onChange={() => handlePermissionToggle(mod.key, "edit")}
                                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                              />
                            </label>
                          </td>

                          <td className="p-3 text-center">
                            <label className="inline-flex items-center justify-center p-2 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer hover:bg-amber-50">
                              <input
                                type="checkbox"
                                checked={!!mPerms.delete}
                                onChange={() => handlePermissionToggle(mod.key, "delete")}
                                className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                              />
                            </label>
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

        {/* ─── CONFIRM DESTRUCTIVE DELETE DIALOG ─── */}
        <ConfirmDialog
          isOpen={!!userToDelete}
          onClose={() => setUserToDelete(null)}
          onConfirm={handleConfirmDeleteUser}
          title={`حذف حساب (${userToDelete?.name})`}
          message={`هل أنت متأكد من رغبتك في حذف حساب (${userToDelete?.name}) نهائياً من النظام؟ لا يمكن التراجع عن هذا الإجراء.`}
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
