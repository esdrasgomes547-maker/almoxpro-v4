import React, { createContext, useContext, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, ChevronRight, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isDemo } from "../lib/demo";

interface DemoModalContextType {
  isDemoActive: boolean;
  showDemoModal: () => void;
  hideDemoModal: () => void;
  checkDemoAction: (onAllowed?: () => void) => boolean;
}

const DemoModalContext = createContext<DemoModalContextType | undefined>(undefined);

export function useDemoModal() {
  const context = useContext(DemoModalContext);
  if (!context) {
    throw new Error("useDemoModal must be used within a DemoModalProvider");
  }
  return context;
}

export function DemoModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const isDemoActive = isDemo();

  const showDemoModal = () => setIsOpen(true);
  const hideDemoModal = () => setIsOpen(false);

  // Return true if action was blocked, false if it is allowed
  const checkDemoAction = (onAllowed?: () => void): boolean => {
    if (isDemoActive) {
      showDemoModal();
      return true;
    }
    if (onAllowed) {
      onAllowed();
    }
    return false;
  };

  const handleSubscribeRedirect = () => {
    localStorage.removeItem("isDemoMode");
    setIsOpen(false);
    navigate("/login?register=true");
  };

  return (
    <DemoModalContext.Provider value={{ isDemoActive, showDemoModal, hideDemoModal, checkDemoAction }}>
      {children}
      
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={hideDemoModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 shadow-2xl z-10 mx-auto"
            >
              {/* Background Glow */}
              <div className="absolute top-0 right-0 -mr-12 -mt-12 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 -ml-12 -mb-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={hideDemoModal}
                className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:scale-90"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Badge Icon */}
              <div className="flex justify-center mb-5">
                <motion.div
                  animate={{ 
                    scale: [1, 1.05, 1],
                    rotate: [0, 5, -5, 0] 
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 3,
                    ease: "easeInOut" 
                  }}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-primary text-white shadow-xl shadow-primary/20"
                >
                  <Sparkles className="h-7 w-7" />
                </motion.div>
              </div>

              {/* Title & Headline */}
              <div className="text-center mb-8">
                <h3 className="text-xl font-bold font-display tracking-tight text-foreground sm:text-2xl leading-snug">
                  Opa, esse recurso é apenas para clientes cadastrados. ✨
                </h3>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                  Fique à vontade para continuar navegando e explorando todas as abas e painéis! Ao criar sua conta gratuita, você libera o cadastro de itens, vendas, histórico de frotas e muito mais.
                </p>
              </div>

              {/* Call to Actions */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-stretch">
                <button
                  type="button"
                  onClick={hideDemoModal}
                  className="w-full sm:w-1/3 h-11 inline-flex items-center justify-center rounded-xl border border-border bg-transparent text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 cursor-pointer select-none active:scale-[0.98]"
                >
                  Continuar Lendo
                </button>
                <button
                  type="button"
                  onClick={handleSubscribeRedirect}
                  className="w-full sm:w-2/3 h-11 inline-flex items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-lg shadow-[hsl(var(--primary))]/20 hover:brightness-110 active:scale-[0.98] transition-all duration-150 cursor-pointer select-none relative overflow-hidden group"
                >
                  <span className="relative z-10 flex items-center gap-1">
                    Cadastrar Grátis
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent" />
                </button>
              </div>

              <div className="text-center mt-4">
                <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                  <KeyRound className="h-3 w-3 text-primary/60" /> Crie sua conta gratuita em poucos segundos e tenha controle operacional total!
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DemoModalContext.Provider>
  );
}
