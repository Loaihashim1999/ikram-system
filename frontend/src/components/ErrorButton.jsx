
// Sentry test error button to verify error tracking, logging, and metrics
export default function ErrorButton() {
  return (
    <button
      type="button"
      id="sentry-test-error-btn"
      className="fixed bottom-4 left-4 z-50 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer opacity-90 hover:opacity-100"
      onClick={() => {
        throw new Error('This is your first error!');
      }}
    >
      <span>💥</span>
      <span>Break the world</span>
    </button>
  );
}
