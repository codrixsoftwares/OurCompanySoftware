import React from 'react';

interface ViewLoadingProps {
  label?: string;
}

export const ViewLoadingFallback: React.FC<ViewLoadingProps> = ({ label = 'Loading workspace...' }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in fade-in duration-200">
      <div className="relative flex items-center justify-center mb-4">
        {/* Pulsing ambient halo */}
        <div className="absolute w-16 h-16 rounded-full bg-[#7C2CF5]/15 blur-lg animate-pulse" />
        {/* Spinning ring */}
        <div className="w-10 h-10 border-3 border-[#E7E0FB] border-t-[#7C2CF5] rounded-full animate-spin" />
        <img
          src="/logo-icon.png"
          alt="CodRix"
          className="absolute w-5 h-5 object-contain"
        />
      </div>
      <span className="text-xs font-bold text-[#120E24] tracking-wide">{label}</span>
      <span className="text-[11px] text-[#585172] mt-1 font-medium">Preparing enterprise data & reactive views</span>
    </div>
  );
};
