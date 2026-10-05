import { X, FileText, ExternalLink } from 'lucide-react';

function isPdf(url) {
  return url?.toLowerCase().includes('.pdf');
}

export default function BeneficiaryMediaModal({ beneficiary, mode, onClose }) {
  if (!beneficiary) return null;

  const title = mode === 'photo' ? 'صورة المستفيد' : 'وثائق المستفيد';
  const documents = beneficiary.document_urls ?? [];
  const photoUrl = beneficiary.photo_url;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[92vh] sm:max-w-3xl overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        dir="rtl"
      >
        <div className="flex items-center justify-between border-b border-[#E5E2D9] px-4 py-3 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-[#546027]">{title}</h2>
            <p className="text-sm text-[#6B6B66]">{beneficiary.full_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#6B6B66] hover:bg-[#F7F5F0]"
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(92vh-4rem)] overflow-y-auto p-4 sm:p-6">
          {mode === 'photo' && (
            <div>
              {photoUrl ? (
                isPdf(photoUrl) ? (
                  <div className="flex flex-col items-center gap-4 rounded-xl border border-[#E5E2D9] bg-[#F7F5F0] p-8">
                    <FileText size={48} className="text-[#C9A24A]" />
                    <p className="text-[#6B6B66]">الصورة محفوظة كملف PDF</p>
                    <a
                      href={photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-[#C9A24A] px-4 py-2 text-white hover:bg-[#8A6B24]"
                    >
                      <ExternalLink size={16} />
                      فتح الملف
                    </a>
                  </div>
                ) : (
                  <img
                    src={photoUrl}
                    alt={beneficiary.full_name}
                    className="mx-auto max-h-[70vh] w-full rounded-xl border border-[#E5E2D9] object-contain bg-[#F7F5F0]"
                  />
                )
              ) : (
                <div className="rounded-xl border border-dashed border-[#E5E2D9] bg-[#F7F5F0] p-10 text-center text-[#6B6B66]">
                  لا توجد صورة هوية أو إقامة مرفوعة
                </div>
              )}
            </div>
          )}

          {mode === 'documents' && (
            <div>
              {documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E5E2D9] bg-[#F7F5F0] p-10 text-center text-[#6B6B66]">
                  لا توجد وثائق مرفوعة لهذا المستفيد
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {documents.map((document) => (
                    <div
                      key={document.field}
                      className="overflow-hidden rounded-xl border border-[#E5E2D9] bg-[#F7F5F0]"
                    >
                      <div className="border-b border-[#E5E2D9] bg-white px-3 py-2 text-sm font-bold text-[#546027]">
                        {document.label}
                      </div>
                      <div className="p-3">
                        {isPdf(document.url) ? (
                          <div className="flex flex-col items-center gap-3 py-6">
                            <FileText size={40} className="text-[#C9A24A]" />
                            <a
                              href={document.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-[#C9A24A] hover:underline"
                            >
                              <ExternalLink size={14} />
                              عرض PDF
                            </a>
                          </div>
                        ) : (
                          <a href={document.url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={document.url}
                              alt={document.label}
                              className="h-40 w-full rounded-lg object-cover sm:h-48"
                            />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
