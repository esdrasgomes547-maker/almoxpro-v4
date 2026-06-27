import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Shield, Sparkles } from "lucide-react";

interface HeroSuccessPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export function HeroSuccessPopup({ isOpen, onClose, title = "Salvo com sucesso!", subtitle = "As alterações foram sincronizadas e gravadas com segurança." }: HeroSuccessPopupProps) {
  
  // Auto close trigger
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
          />

          {/* Central Card with neon glows and scale entry */}
          <motion.div
            initial={{ scale: 0.85, y: 20, opacity: 0 }}
            animate={{ 
              scale: 1, 
              y: 0, 
              opacity: 1,
              transition: { type: "spring", stiffness: 260, damping: 20 }
            }}
            exit={{ scale: 0.9, y: 15, opacity: 0 }}
            className="relative w-full max-w-md bg-stone-900 border border-primary/35 rounded-2xl p-6 shadow-[0_0_50px_rgba(37,99,235,0.25)] text-center overflow-hidden z-10 select-none animation-smooth"
          >
            {/* Ambient Background Radial Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />

            {/* Glowing Accent Lines */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

            {/* Micro Floating Particles / Sparkles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <motion.div
                animate={{ 
                  y: [-20, -100], 
                  x: [0, 15], 
                  opacity: [0, 0.8, 0] 
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
                className="absolute text-blue-400 size-3 bottom-10 left-12"
              >
                <Sparkles className="h-3 w-3" />
              </motion.div>
              <motion.div
                animate={{ 
                  y: [-10, -80], 
                  x: [0, -10], 
                  opacity: [0, 0.6, 0] 
                }}
                transition={{ duration: 2.5, delay: 0.8, repeat: Infinity, ease: "easeOut" }}
                className="absolute text-blue-400 size-4 bottom-16 right-16"
              >
                <Sparkles className="h-4 w-4 text-blue-400/80" />
              </motion.div>
            </div>

            {/* Big Animated Success Checkmark Ring */}
            <div className="relative mx-auto w-20 h-20 rounded-full bg-blue-950/60 border-2 border-primary/45 flex items-center justify-center mb-5 shadow-[0_0_25px_rgba(37,99,235,0.35)]">
              {/* Outer pulsing ring */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{ scale: 1.3, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-0 rounded-full border-2 border-primary/35"
              />

              {/* Inner scale bounce icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 15 }}
                className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.55)]"
              >
                <Check className="h-8 w-8 text-white stroke-[3.5px]" />
              </motion.div>
            </div>

            {/* Text & Explanatory Elements */}
            <motion.h4
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
              className="text-xl font-black text-white font-sans tracking-tight mb-2"
            >
              {title}
            </motion.h4>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
              className="text-xs text-stone-300 font-medium leading-relaxed max-w-sm mx-auto mb-6"
            >
              {subtitle}
            </motion.p>

            {/* Badge Security Verification indicator representing "Excellent react, hero" */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.4 } }}
              className="inline-flex items-center gap-1.5 bg-blue-950/50 border border-primary/30 px-3 py-1 rounded-full text-[10px] text-blue-400 font-mono mb-6"
            >
              <Shield className="h-3 w-3" />
              Sincronização Ativa & Segura
            </motion.div>

            {/* Confirm action button */}
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.45 } }}
            >
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-primary hover:bg-primary/90 active:scale-[0.98] text-white text-xs font-bold rounded-xl transition-all shadow-[0_4px_14px_rgba(37,99,235,0.45)] cursor-pointer"
              >
                Ótimo, obrigado!
              </button>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
