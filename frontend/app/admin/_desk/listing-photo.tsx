import { Smartphone } from 'lucide-react';

export function ListingPhoto({ url }: { url: string | null }) {
  return (
    <div className="w-11 h-11 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <Smartphone className="w-4 h-4 text-slate-400" aria-hidden="true" />
      )}
    </div>
  );
}
