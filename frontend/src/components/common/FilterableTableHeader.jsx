import { useState, useRef, useEffect } from "react";
import { Filter, X, Check } from "lucide-react";

export default function FilterableTableHeader({
  title,
  options = [], // Array of { value, label } or array of strings
  selectedValue = "all",
  onChange,
  align = "right",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizedOptions = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  const isActive = selectedValue && selectedValue !== "all";

  return (
    <div className={`relative inline-flex items-center gap-1.5 cursor-pointer select-none`} ref={dropdownRef}>
      <span className="font-bold">{title}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`p-1 rounded-md transition-colors ${
          isActive
            ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-300"
            : "hover:bg-amber-100 text-amber-800"
        }`}
        title={`فلترة حسب ${title}`}
      >
        <Filter className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-amber-200 z-50 p-2 text-xs font-normal text-right text-gray-800 animate-in fade-in zoom-in-95 duration-100 ${
            align === "left" ? "left-0" : "right-0"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-gray-100 font-bold text-amber-900">
            <span>تصفية: {title}</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5">
            <button
              type="button"
              onClick={() => {
                onChange("all");
                setIsOpen(false);
              }}
              className={`w-full text-right px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs font-bold transition-colors ${
                selectedValue === "all" ? "bg-amber-100 text-amber-900" : "hover:bg-amber-50 text-gray-700"
              }`}
            >
              <span>الكل (عرض الجميع)</span>
              {selectedValue === "all" && <Check className="w-3.5 h-3.5 text-amber-700" />}
            </button>

            {normalizedOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-right px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs transition-colors ${
                  selectedValue === opt.value
                    ? "bg-amber-100 text-amber-900 font-bold"
                    : "hover:bg-amber-50 text-gray-700"
                }`}
              >
                <span>{opt.label}</span>
                {selectedValue === opt.value && <Check className="w-3.5 h-3.5 text-amber-700" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
