const CATEGORY_STYLES = {
  'درجة أولى': 'bg-[#E6F4EC] text-[#3B8A5E] border-[#3B8A5E]/30',
  'درجة ثانية': 'bg-[#FEF3D6] text-[#8A6B24] border-[#D89A2E]/30',
  'ذوي الاحتياجات الخاصة': 'bg-[#E3F0FB] text-[#2F6FA8] border-[#4A90C9]/30',
  'عامل بالجمعية': 'bg-[#F0F0EB] text-[#546027] border-[#7C8D42]/30',
};

export default function CategoryBadge({ name }) {
  if (!name) {
    return <span className="text-xs text-[#6B6B66]">—</span>;
  }

  const style = CATEGORY_STYLES[name] ?? 'bg-[#F7F5F0] text-[#6B6B66] border-[#E5E2D9]';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap ${style}`}>
      {name}
    </span>
  );
}
