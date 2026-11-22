import React, { useState, useEffect } from 'react';
import { Laptop, Tablet, Monitor } from 'lucide-react';

interface ScreenSizeGuardProps {
  children: React.ReactNode;
}

export const ScreenSizeGuard: React.FC<ScreenSizeGuardProps> = ({ children }) => {
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Small screen sizes such as smartphones (< 640px)
  const isSmartphone = windowWidth < 640;

  return (
    <>
      {isSmartphone ? (
        <div className="fixed inset-0 z-[999999] bg-[#FBFBFE] text-[#120E24] flex flex-col items-center justify-center p-6 text-center overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif] select-none">
          {/* Ambient Purple Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#7C2CF5]/15 blur-[90px] rounded-full pointer-events-none"></div>

          <div className="max-w-md w-full bg-white border border-[#E7E0FB] rounded-3xl p-7 shadow-2xl shadow-[#7C2CF5]/10 relative z-10 space-y-5">
            {/* Logo */}
            <div className="flex items-center justify-center gap-2">
              <div className="p-2.5 rounded-2xl bg-[#F6F3FF] border border-[#E7E0FB] shadow-inner">
                <img
                  src="/logo-icon.png"
                  alt="CodRix Official Logo"
                  className="w-10 h-10 object-contain"
                />
              </div>
              <div className="text-left">
                <div className="font-extrabold text-[#120E24] text-lg leading-tight flex items-center gap-1.5">
                  <span>CodRix</span>
                  <span className="w-2 h-2 rounded-full bg-[#7C2CF5]"></span>
                </div>
                <div className="text-[10px] text-[#585172] font-semibold uppercase tracking-wider">
                  Enterprise OS
                </div>
              </div>
            </div>

            {/* Device Icons Display */}
            <div className="py-2 flex items-center justify-center gap-3">
              <div className="p-3 bg-[#F0ECFC] text-[#7C2CF5] rounded-2xl border border-[#DDD0FE] shadow-xs flex flex-col items-center gap-1">
                <Laptop className="w-6 h-6" />
                <span className="text-[9px] font-bold">Laptop</span>
              </div>
              <div className="p-3 bg-[#F0ECFC] text-[#7C2CF5] rounded-2xl border border-[#DDD0FE] shadow-xs flex flex-col items-center gap-1">
                <Tablet className="w-6 h-6" />
                <span className="text-[9px] font-bold">Tablet</span>
              </div>
              <div className="p-3 bg-[#F0ECFC] text-[#7C2CF5] rounded-2xl border border-[#DDD0FE] shadow-xs flex flex-col items-center gap-1">
                <Monitor className="w-6 h-6" />
                <span className="text-[9px] font-bold">PC / Mac</span>
              </div>
            </div>

            {/* Main Message */}
            <div className="space-y-2.5">
              <h2 className="text-xl font-extrabold text-[#120E24] tracking-tight">
                Built for Laptops, Tablets, MacBooks & PCs Only
              </h2>
              <p className="text-xs text-[#585172] leading-relaxed">
                This software is built for devices like <strong>Laptops, Tablets, MacBooks, and PCs</strong> only. This website is <strong>not built for small screen sizes such as smartphones</strong>.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Allowed screens: Tablets, Laptops, MacBooks, PCs (>= 640px) */
        <div className="w-full h-full">{children}</div>
      )}
    </>
  );
};

export default ScreenSizeGuard;
