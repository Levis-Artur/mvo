'use client';

export function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded border border-green-700/20 bg-white p-3 text-sm text-[var(--success)] shadow-lg">
      <span>{message}</span>
      <button className="btn btn-ghost !min-h-0 !w-auto !p-0" type="button" onClick={onClose}>Закрити</button>
    </div>
  );
}
