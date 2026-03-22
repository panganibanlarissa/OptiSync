import { Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50">
      {/* Clinic branding colored spinner */}
      <Loader2 className="w-12 h-12 text-[#0B3C8A] animate-spin mb-4" />
      <p className="text-slate-500 font-medium text-sm animate-pulse">
        Loading clinic data...
      </p>
    </div>
  );
}