import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { hasModuleAction } from "../../utils/modulePermissions";
import { displayLabel } from '../../utils/displayVocabulary';
import { useParams, Link, useSearchParams } from "react-router-dom";
import { getApiBaseUrl } from "../../utils/documentUrl";
import PolicyReviewLinks from "../../components/beneficiaries/PolicyReviewLinks";
import api from "../../api/axios";
import beneficiaryApi from "../../api/beneficiaries";
import MainLayout from "../../components/layout/MainLayout";
import PageShell from "../../components/ui/PageShell";
import SectionCard from "../../components/ui/SectionCard";
import Tabs from "../../components/ui/Tabs";
import { PrimaryButton, SecondaryButton } from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import ErrorState from "../../components/ui/ErrorState";
import KpiCard from "../../components/ui/KpiCard";
import DataTable from "../../components/ui/DataTable";
import { Edit } from "lucide-react";
import ReceiptHistoryTimeline from "../../components/common/ReceiptHistoryTimeline";

export default function BeneficiaryDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canEditBeneficiary = hasModuleAction(user, 'beneficiaries', 'edit');
  const [b, setB] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const canArchive = hasModuleAction(user, "beneficiaries", "delete");
  const canSupport = user?.role === "admin" || (user?.permissions?.support?.view === true && user?.permissions?.support?.create === true);
  const [supportHistory, setSupportHistory] = useState([]);
  useEffect(() => {
    if (!(user?.role === "admin" || user?.permissions?.support?.view === true)) return;
    let active = true;
    api.get(`/beneficiaries/${id}/support-history`).then(({ data }) => { if (active) setSupportHistory(data.data || []); }).catch(() => { if (active) setActionError("تعذر تحميل سجل الدعم."); });
    return () => { active = false; };
  }, [id, user]);
  const archive = async () => {
    if (!window.confirm(b.archived_at ? "استعادة المستفيد؟" : "أرشفة المستفيد مع الاحتفاظ بالوثائق والسجل؟")) return;
    setActionBusy(true); setActionError("");
    try { const r = b.archived_at ? await beneficiaryApi.restore(id) : await beneficiaryApi.remove(id); setB(r.data.data); }
    catch (e) { setActionError(e.response?.data?.message || "تعذر تحديث حالة الأرشفة."); }
    finally { setActionBusy(false); }
  };
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") === "documents" ? "documents" : "basic");

  useEffect(() => {
    setLoading(true);
    beneficiaryApi.get(id)
      .then((res) => {
        const raw = res.data?.data ?? res.data;
        setB(raw);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <MainLayout>
        <LoadingState message="جاري تحميل بيانات المستفيد..." />
      </MainLayout>
    );
  }

  if (!b) {
    return (
      <MainLayout>
        <ErrorState title="لم يتم العثور على المستفيد" description="تعذر عرض هذا السجل. قد يكون غير موجود أو لم يعد متاحاً." />
      </MainLayout>
    );
  }

  const cleanDate = (d) => (d ? String(d).substring(0, 10) : "—");

  const getDocUrl = (url) => {
    if (!url) return "";
    const apiBase = getApiBaseUrl();
    const target = new URL(url, `${apiBase}/`);
    if (!/^\/api\/beneficiaries\/[^/]+\/documents\/[a-z_]+$/.test(target.pathname)) return "";
    return `${apiBase}${target.pathname}${target.search}`;
  };

  const fullName = b.full_name || b.name || "مستفيد غير معنون";
  const nationalId = b.national_id || "—";
  const phone = b.phone || "—";
  const dateOfBirth = cleanDate(b.date_of_birth || b.birth_date);
  const placeOfBirth = b.place_of_birth || b.birth_place || "—";
  const isCitizen = (b.beneficiary_type || b.type) === "citizen";
  const nationality = String(b.nationality || "").trim();
  const identityLabel = nationality === "سعودي"
    ? "مواطن"
    : nationality
      ? `مقيم (${nationality})`
      : isCitizen
        ? "مواطن — الجنسية غير مسجلة"
        : (b.beneficiary_type || b.type) === "resident"
          ? "مقيم — الجنسية غير مسجلة"
          : "الجنسية غير مسجلة";
  const canEvaluatePolicy = !b.archived_at && (user?.role === "admin" || user?.permissions?.beneficiary_policy?.evaluate === true);
  const documentsList = [
    { label: "صورة الهوية الوطنية / الإقامة", url: b.national_id_image_url || b.residence_id_image_url },
    { label: "إثبات حساب المواطن / الراتب", url: b.citizen_account_image_url || b.salary_certificate_url },
    { label: "مشهد الضمان الاجتماعي", url: b.social_security_image_url },
    { label: "صورة راتب التقاعد", url: b.pension_certificate_image_url },
    { label: "عقد الإيجار / فاتورة الكهرباء", url: b.rental_contract_image_url || b.electricity_bill_image_url },
    { label: "إثبات العنوان الوطني", url: b.national_address_image_url },
  ].filter((doc) => !!doc.url);
  const incomeRows = [
    ["salary", "monthly_salary", "الراتب الشهري"],
    ["social_security", "social_security_amount", "الضمان الاجتماعي"],
    ["citizen_account", "citizen_account_amount", "حساب المواطن"],
    ["retirement", "retirement_pension", "المعاش التقاعدي"],
    ["family_support", "family_support", "دعم الأسرة والأقارب"],
  ].filter(([source]) => (b.income_sources || []).includes(source));

  return (
    <MainLayout>
      <div dir="rtl">
        <PageShell
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "إدارة المستفيدين", href: "/beneficiaries" },
            { label: fullName },
          ]}
          title={fullName}
          description={`${identityLabel} | رقم الهوية: ${nationalId}`}
          primaryAction={canEditBeneficiary ? <PrimaryButton as={Link} to={`/beneficiaries/${b.id}/edit`} icon={Edit}>تعديل البيانات</PrimaryButton> : null}
          secondaryActions={(
            <>
              {canEvaluatePolicy && <SecondaryButton type="button" onClick={() => setActiveTab("policy")}>تقييم السياسة</SecondaryButton>}
              {canSupport && !b.archived_at && <SecondaryButton as={Link} to={`/beneficiaries/${id}/support`}>تقديم دعم</SecondaryButton>}
              {canArchive && <SecondaryButton type="button" disabled={actionBusy} onClick={archive}>{b.archived_at ? "استعادة المستفيد" : "أرشفة المستفيد"}</SecondaryButton>}
            </>
          )}
        >
          {actionError && <ErrorState title="تعذر تحديث حالة الأرشفة" description={actionError} />}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={b.archived_at ? "archived" : (b.status || "active")} label={b.archived_at ? "مؤرشف" : displayLabel("status", b.status || "active")} />
            <StatusBadge tone="neutral" label={isCitizen ? "مواطن" : "مقيم"} />
            <StatusBadge tone="info" label={displayLabel("priority", b.priority)} />
          </div>
          {b.archived_at && <p className="text-sm text-[var(--color-text-secondary)]">هذا المستفيد مؤرشف، وسجلاته ووثائقه محفوظة.</p>}
          <Tabs
            tabs={[
              { id: "basic", label: "بيانات المستفيد", testId: "workspace-tab-basic" },
              { id: "family", label: "الأسرة والتابعون", testId: "workspace-tab-family" },
              { id: "financial", label: "البيانات المالية والدخل", testId: "workspace-tab-financial" },
              { id: "documents", label: "الوثائق والمرفقات", testId: "workspace-tab-documents" },
              { id: "policy", label: "السياسة والاستحقاق", testId: "workspace-tab-policy" },
              { id: "support", label: "الدعم", testId: "workspace-tab-support" },
              { id: "receipts", label: "سجل الاستلام", testId: "workspace-tab-receipts" },
              { id: "history", label: "السجل التاريخي", testId: "workspace-tab-history" },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          {activeTab === "basic" && (
            <SectionCard title="بيانات المستفيد">
              <dl className="grid gap-3 md:grid-cols-2">
                <Fact label="الاسم الكامل" value={fullName} />
                <Fact label="رقم الهوية الوطنية / الإقامة" value={nationalId} />
                <Fact label="رقم الهاتف" value={phone} />
                <Fact label="تاريخ الميلاد" value={dateOfBirth} />
                <Fact label="مكان الميلاد" value={placeOfBirth} />
                <Fact label="نوع المستفيد" value={isCitizen ? "مواطن" : "مقيم"} />
                <Fact label="الجنسية / الإقامة" value={identityLabel} />
                {!isCitizen && <Fact label="المهنة الحالية" value={b.profession} />}
                <Fact label="المدينة" value={b.city} />
                <Fact label="اسم الحي السكني" value={b.district} />
                <Fact label="الشارع / المعلم" value={b.street} />
              </dl>
            </SectionCard>
          )}

          {activeTab === "family" && (
            <SectionCard title="الأسرة والتابعون">
              <dl className="grid gap-3 md:grid-cols-2">
                <Fact label="الحالة الاجتماعية" value={displayLabel("family", b.family_status)} />
                <Fact label="إجمالي أفراد الأسرة" value={b.family_members_count} />
                <Fact label="عدد العاملين بالأسرة" value={b.working_members_count || b.working_count} />
                <Fact label="عدد الأبناء غير العاملين" value={b.non_working_children_count || b.non_working_children} />
                <Fact label="ذوو الاحتياجات الخاصة" value={b.has_special_needs ? "نعم" : "لا"} />
                <Fact label="نوع السكن الحالي" value={displayLabel("housing", b.housing_type)} />
                {b.housing_type === "rent" && <Fact label="مبلغ الإيجار السنوي" value={b.annual_rent_amount ? `${b.annual_rent_amount} ريال` : "—"} />}
              </dl>
              <div className="mt-4">
                {(!b.dependents || b.dependents.length === 0) ? (
                  <EmptyState title="لا يوجد تابعون" description="لا يوجد معالون مضافون بهذا الحساب." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-[var(--color-bg-soft)]">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">اسم التابع</th>
                          <th className="p-3">صلة القرابة</th>
                          <th className="p-3">تاريخ الميلاد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.dependents.map((dep, idx) => (
                          <tr key={dep.id || idx}>
                            <td className="p-3 text-[var(--color-text-muted)]">{idx + 1}</td>
                            <td className="p-3 font-bold text-[var(--color-text-primary)]">{dep.name}</td>
                            <td className="p-3">{dep.relationship || "—"}</td>
                            <td className="p-3 font-mono">{cleanDate(dep.date_of_birth)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {activeTab === "financial" && (
            <SectionCard title="البيانات المالية والدخل">
              {incomeRows.length === 0 ? <EmptyState title="لا توجد مصادر دخل" description="لم تُسجل مصادر دخل لهذا المستفيد." /> : (
                <dl className="grid gap-3 md:grid-cols-2">
                  {incomeRows.map(([source, field, label]) => <Fact key={source} label={label} value={`${parseFloat(b[field] || 0).toLocaleString()} ريال`} />)}
                </dl>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard title="إجمالي الدخل الشهري قبل الإيجار" value={`${parseFloat(b.total_income || 0).toLocaleString()} ريال`} />
                <KpiCard title="الإيجار السنوي" value={`${parseFloat(b.annual_rent_amount || 0).toLocaleString()} ريال`} />
                <KpiCard title="الإيجار الشهري" value={`${parseFloat(b.monthly_rent || 0).toLocaleString()} ريال`} />
                <KpiCard title="صافي الدخل الشهري بعد الإيجار" value={`${parseFloat(b.net_income || 0).toLocaleString()} ريال`} />
              </div>
              <div className="mt-4"><StatusBadge tone="info" label={displayLabel("priority", b.priority)} /></div>
            </SectionCard>
          )}

          {activeTab === "documents" && (
            <SectionCard title="الوثائق والمرفقات">
              {documentsList.length === 0 ? <EmptyState title="لا توجد وثائق" description="لا توجد وثائق مرفقة مسجلة لهذا المستفيد حالياً." /> : (
                <div className="grid gap-4 md:grid-cols-2">
                  {documentsList.map((doc) => (
                    <div key={doc.label} className="space-y-3">
                      <p className="text-sm font-bold text-[var(--color-text-primary)]">{doc.label}</p>
                      <SecondaryButton as="a" href={getDocUrl(doc.url)} target="_blank" rel="noreferrer">فتح المستند</SecondaryButton>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {activeTab === "policy" && (
            <SectionCard title="السياسة والاستحقاق">
              <PolicyReviewLinks beneficiaryId={id} archived={Boolean(b.archived_at)} />
            </SectionCard>
          )}

          {activeTab === "support" && (
            <SectionCard title="الدعم">
              <DataTable
                columns={[
                  { key: 'reference', header: 'مرجع الدعم', render: (row) => <Link to={`/support-delivery?task=${row.id}`}>{row.support_date?.slice?.(0, 10) || row.created_at?.slice?.(0, 10) || 'طلب دعم'}</Link> },
                  { key: 'type', header: 'نوع الدعم', render: (row) => `${(row.items || []).length} صنف` },
                  { key: 'quantity', header: 'الكمية', render: (row) => (row.items || []).reduce((sum, item) => sum + Number(item.requested_quantity || 0), 0) },
                  { key: 'status', header: 'الحالة', render: (row) => displayLabel('status', row.status) },
                  { key: 'method', header: 'طريقة التنفيذ', render: (row) => displayLabel('fulfillment', row.fulfillment_method) },
                  { key: 'created', header: 'تاريخ الطلب', render: (row) => row.created_at?.slice?.(0, 10) || '—' },
                  { key: 'completed', header: 'تاريخ الإكمال', render: (row) => row.completed_at?.slice?.(0, 10) || '—' },
                ]}
                data={supportHistory}
                emptyMessage="لا توجد طلبات دعم"
                emptySubMessage="لا توجد طلبات دعم مسجلة لهذا المستفيد."
              />
            </SectionCard>
          )}

          {activeTab === "receipts" && (
            <SectionCard title="سجل الاستلام">
              {(b.distributions || []).length === 0 ? <EmptyState title="لا توجد استلامات" description="لا يوجد سجل استلام محفوظ لهذا المستفيد." /> : (
                <ReceiptHistoryTimeline records={b.distributions || []} beneficiaryId={b.id} recipientName={fullName} recipientType="beneficiary" title={`سجل استلامات المستفيد: ${fullName}`} />
              )}
            </SectionCard>
          )}

          {activeTab === "history" && (
            <SectionCard title="السجل التاريخي">
              <EmptyState title="لا يوجد سجل تاريخي في هذا العرض" description="تفاصيل الأرشفة والتقييم تبقى محفوظة في سجل النظام، ولا تُعرض هنا كبيانات جديدة." />
            </SectionCard>
          )}
        </PageShell>
      </div>
    </MainLayout>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-sm font-bold text-[var(--color-text-primary)]">{value !== null && value !== undefined && value !== "" ? value : "—"}</dd>
    </div>
  );
}
