export function DevBanner() {
  if (import.meta.env.VITE_APP_ENV !== 'development') return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-black text-center text-xs font-bold py-1 tracking-widest select-none">
      ⚠ AMBIENTE DE DESENVOLVIMENTO — banco de dados separado, dados de teste
    </div>
  );
}
