import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSubscription } from '../lib/useSubscription';
import { auth } from '../lib/firebase';
import { Loader2 } from 'lucide-react';

interface AccessGuardProps {
  children: React.ReactNode;
  requireMaster?: boolean;
}

export function AccessGuard({ children, requireMaster = false }: AccessGuardProps) {
  const { isMaster, loading } = useSubscription();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[hsl(var(--background))]">
        <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  // Se não tem usuário logado, redireciona pra home (landing page)
  const isBypassed = localStorage.getItem('master_bypass') === 'true';
  const isDemoMode = localStorage.getItem('isDemoMode') === 'true';
  if (!auth.currentUser && !isBypassed && !isDemoMode) {
    return <Navigate to="/" replace />;
  }

  if (requireMaster) {
    const isEsdras = auth.currentUser?.email === "esdrasgomes547@gmail.com";
    const isBypass = localStorage.getItem('master_bypass') === 'true';
    if (isMaster || isEsdras || isBypass) return <>{children}</>;
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[hsl(var(--background))] p-4">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Acesso Restrito</h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">Apenas masters podem acessar esta página.</p>
        <button onClick={() => window.history.back()} className="mt-6 px-4 py-2 border rounded-md">Voltar</button>
      </div>
    );
  }

  // Se está logado, permite acesso total baseado no papel
  return <>{children}</>;
}
