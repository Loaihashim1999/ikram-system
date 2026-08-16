import { Users } from 'lucide-react';

const parentStatus = (status) => (status === 'deceased' ? 'متوفى' : 'حي');

export default function FamilySummary({ beneficiary, compact = false }) {
  const members = beneficiary.family_members_count ?? 0;
  const workers = beneficiary.working_members_count ?? 0;
  const children = beneficiary.non_working_children_count ?? 0;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-[#6B6B66]">
        <Users size={14} className="shrink-0 text-[#7C8D42]" />
        <span>{members} أفراد</span>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-sm text-[#6B6B66]">
      <div className="flex items-center gap-1.5 font-medium text-[#111111]">
        <Users size={14} className="text-[#7C8D42]" />
        <span>{members} أفراد الأسرة</span>
      </div>
      <p>{workers} عاملين · {children} أبناء غير عاملين</p>
      <p>الأب: {parentStatus(beneficiary.father_status)} · الأم: {parentStatus(beneficiary.mother_status)}</p>
    </div>
  );
}
