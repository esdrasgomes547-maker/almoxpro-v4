import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from "motion/react";
import { Button } from '@/components/ui/button';
import { AlmoxProLogo } from '../components/AlmoxProLogo';
import { loginWithEmail, createUserWithEmail, auth, db, ensureAuth, signInWithGoogle } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    login: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  // States for linking Google user to existing Email/Password user
  const [pendingLinkingUser, setPendingLinkingUser] = useState<{
    uid: string;
    email: string;
    existingUid: string;
  } | null>(null);
  const [linkPassword, setLinkPassword] = useState('');
  const [linkError, setLinkError] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (location.state?.register === true || searchParams.get('register') === 'true') {
      setIsRegistering(true);
    }
  }, [location]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      const isBypass = localStorage.getItem('master_bypass') === 'true';
      if (user) {
        localStorage.removeItem('isDemoMode');
        localStorage.removeItem('demoOrgId');
        
        // Verifica se o usuário já existe na base de dados (registrado)
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const searchParams = new URLSearchParams(location.search);
          const destination = searchParams.get('redirect') || '/app/dashboard';
          navigate(destination);
          return;
        } else if (user.email) {
          try {
            const { collection, query, where, getDocs } = await import('firebase/firestore');
            const q = query(collection(db, 'users'), where('email', '==', user.email));
            const emailSnap = await getDocs(q);
            if (!emailSnap.empty) {
              const existingDoc = emailSnap.docs[0];
              setPendingLinkingUser({
                uid: user.uid,
                email: user.email,
                existingUid: existingDoc.id
              });
              setInitialLoading(false);
              return;
            }
          } catch (verErr) {
            console.error("Erro ao checar e-mail existente:", verErr);
          }
          
          // Se o usuário não existir na coleção correspondente (primeiro login com Google por exemplo),
          // vamos auto-provisionar a organização PRO dele imediatamente para acesso instantâneo do zero!
          try {
            const { setDoc, doc } = await import('firebase/firestore');
            const customOrgId = `org_${Math.random().toString(36).substring(2, 10)}`;
            const userProvidedName = "Minha Empresa Almox";

            await setDoc(doc(db, 'users', user.uid), {
              email: user.email,
              orgId: customOrgId,
              role: 'user',
              plan: 'pro', // Auto-provisionado completo
              cpfCnpj: '',
              phone: '',
              companyName: userProvidedName,
              planActivatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString()
            });

            await setDoc(doc(db, `organizations/${customOrgId}/settings`, 'default'), {
              companyName: userProvidedName,
              managerName: user.displayName || "Gestor Principal",
              cnpj: "",
              phone: "",
              email: user.email || "",
              welcomeMessage: "Organização e segurança em primeiro lugar. Vamos movimentar o estoque com agilidade!",
              customGreeting: "Boas-vindas ao painel operacional!",
              masterPin: "1234", 
              seniorPin: "2345",
              juniorPage: "/app/fleet",
              isDemoMode: false,
              isActive: true,
              createdAt: new Date().toISOString()
            });

            localStorage.removeItem('isDemoMode');
            localStorage.removeItem('demoOrgId');
            
            const searchParams = new URLSearchParams(location.search);
            const destination = searchParams.get('redirect') || '/app/dashboard';
            navigate(destination);
            return;
          } catch (provErr) {
            console.error("Erro auto-provisionamento:", provErr);
            setError("Houve uma inconsistência ao ativar seu painel de trabalho virtual. Tente novamente.");
          }
        } else {
          setError("Este usuário não possui um endereço de e-mail válido.");
        }
      } else if (isBypass) {
        localStorage.removeItem('isDemoMode');
        localStorage.removeItem('demoOrgId');
        navigate('/app/dashboard');
        return;
      }
      setInitialLoading(false);
    });
    return () => unsub();
  }, [navigate, location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const searchParams = new URLSearchParams(location.search);
    const destination = searchParams.get('redirect') || '/app/dashboard';

    try {
      if (isRegistering) {
        if (formData.password.length < 6) {
          setError('A senha deve ter pelo menos 6 caracteres.');
          setLoading(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('As senhas não coincidem.');
          setLoading(false);
          return;
        }
        if (!formData.login.includes('@')) {
          setError('Use um e-mail válido para o cadastro.');
          setLoading(false);
          return;
        }

        const paidPlan = 'pro'; // Ativação PRO gratuita imediata
        const cpfCnpj = '';
        const phone = '';
        const userProvidedName = 'Minha Empresa Almox';

        // Organização própria isolada e zerada ("contas do zero")
        const customOrgId = `org_${Math.random().toString(36).substring(2, 10)}`;

        const userCredential = await createUserWithEmail(formData.login, formData.password);
        
        // Criar perfil inicial no Firestore
        const { setDoc, doc } = await import('firebase/firestore');
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: formData.login,
          orgId: customOrgId,
          role: 'user',
          plan: paidPlan,
          cpfCnpj,
          phone,
          companyName: userProvidedName,
          planActivatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });

        // Configurações padrão da organização da nova marca
        await setDoc(doc(db, `organizations/${customOrgId}/settings`, 'default'), {
          companyName: userProvidedName,
          managerName: "Gestor Principal",
          cnpj: "",
          phone: "",
          email: formData.login,
          welcomeMessage: "Organização e segurança em primeiro lugar. Vamos movimentar o estoque com agilidade!",
          customGreeting: "Boas-vindas ao painel operacional!",
          masterPin: "1234", 
          seniorPin: "2345",
          juniorPage: "/app/fleet",
          isDemoMode: false,
          isActive: true,
          createdAt: new Date().toISOString()
        });

        localStorage.removeItem('isDemoMode');
        localStorage.removeItem('demoOrgId');
        navigate(destination);
        return;
      }

      // Chave Mestra do Criador
      if (formData.login.toLowerCase() === 'bresdrasalmox' && formData.password === 'Bresdras7507@') {
         localStorage.setItem('master_bypass', 'true');
         localStorage.removeItem('isDemoMode');
         localStorage.removeItem('demoOrgId');
         try {
           await ensureAuth();
         } catch (anonErr: any) {
           console.warn('Anonymous Auth disabled:', anonErr);
           if (anonErr.code === 'auth/admin-restricted-operation') {
             // Mesmo sem anon auth, permitimos o bypass via localStorage, 
             // mas avisamos que o DB será demo-only
             console.log('Using local-only bypass');
           }
         }
         navigate(destination);
         return;
      }

      // Login normal (email real)
      if (formData.login.includes('@')) {
        localStorage.removeItem('master_bypass');
        localStorage.removeItem('isDemoMode');
        localStorage.removeItem('demoOrgId');
        await loginWithEmail(formData.login, formData.password);
        navigate(destination);
      } else {
        setError('Por favor, insira um e-mail válido ou use a Chave Mestra.');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        if (err.code === 'auth/user-not-found') {
          setError('Sua conta não foi encontrada. Mudando para a tela de Cadastro...');
          setTimeout(() => {
            setIsRegistering(true);
            setError('');
          }, 1500);
        } else {
          setError('E-mail ou senha incorretos.');
        }
      } else {
        setError(isRegistering ? 'Erro ao criar conta. Tente outro e-mail.' : 'Falha no login. Verifique suas credenciais.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google sign in failed:", err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError("Não foi possível acessar com o Google. Tente fazer login comum.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLinkExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingLinkingUser) return;
    setIsLinking(true);
    setLinkError('');

    try {
      // Autentica com email e senha da conta existente anterior
      await loginWithEmail(pendingLinkingUser.email, linkPassword);
      
      // Sucesso! O onAuthStateChanged irá interceptar a nova autenticação com a UID correta.
      setPendingLinkingUser(null);
      localStorage.removeItem('isDemoMode');
      localStorage.removeItem('demoOrgId');
      
      const searchParams = new URLSearchParams(location.search);
      const destination = searchParams.get('redirect') || '/app/dashboard';
      navigate(destination);
    } catch (err: any) {
      console.error("Linking failed:", err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setLinkError('Senha incorreta para esta conta AlmoxPro. Por favor, tente novamente.');
      } else {
        setLinkError('Erro ao validar a conta existente: ' + (err.message || 'Credencial inválida'));
      }
    } finally {
      setIsLinking(false);
    }
  };

  const handleCancelLinking = async () => {
    try {
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    } catch (err) {
      console.warn("Sign out failed on cancel:", err);
    }
    setPendingLinkingUser(null);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        delayChildren: 0.1,
        staggerChildren: 0.1 
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen flex flex-col items-center justify-center bg-[hsl(var(--background))] p-4 relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

      <motion.div variants={itemVariants} className="w-full max-w-md mb-6 flex justify-start z-10">
        <button
          onClick={() => navigate('/')}
          type="button"
          className="group flex items-center gap-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Voltar
        </button>
      </motion.div>
      <motion.div variants={itemVariants} className="w-full max-w-md space-y-8 bg-[hsl(var(--card))/80] backdrop-blur-sm p-8 rounded-3xl border border-[hsl(var(--border))] shadow-2xl relative z-10">
        {pendingLinkingUser ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <motion.div 
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center shadow-inner text-amber-500"
                >
                  <Lock className="h-8 w-8 text-amber-500 animate-pulse" />
                </motion.div>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-[hsl(var(--foreground))] text-amber-500">
                Vincular Conta Existente
              </h2>
              <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))] leading-normal">
                Percebemos que você já possui uma conta registrada no <strong>AlmoxPro</strong> com o e-mail: <strong className="text-foreground">{pendingLinkingUser.email}</strong>.
              </p>
              <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed italic">
                Para vincular seu Google com segurança e acessar suas informações registradas (produtos, estoques, relatórios) sem duplicar, digite a sua senha abaixo.
              </p>
            </div>

            <form onSubmit={handleLinkExisting} className="space-y-4">
              {linkError && (
                <div className="p-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg text-center font-bold">
                  {linkError}
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Sua senha original AlmoxPro"
                  className="block w-full pl-10 pr-10 py-3 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))/50] text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent transition text-sm"
                  value={linkPassword}
                  onChange={(e) => setLinkPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-bold shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all"
                  disabled={isLinking}
                >
                  {isLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar e Vincular Conta'}
                </Button>

                <button
                  type="button"
                  onClick={handleCancelLinking}
                  className="w-full py-2 bg-transparent text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
                >
                  Cancelar e Voltar para Login
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <motion.div 
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner animate-[pulse_3s_infinite]"
                >
                  <AlmoxProLogo />
                </motion.div>
              </div>
              <h2 className="text-3xl font-extrabold tracking-tighter text-[hsl(var(--foreground))]">
                {isRegistering ? 'Criar Conta' : 'Acesso AlmoxPro'}
              </h2>
              <p className="mt-2 text-[hsl(var(--muted-foreground))]">
                {isRegistering ? 'Inicie sua jornada hoje' : 'Entre para gerenciar sua operação'}
              </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 text-sm text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg text-center font-medium"
                >
                  {error}
                </motion.div>
              )}

              <div className="space-y-4">
                <motion.div variants={itemVariants} className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                  </div>
                  <input
                    type="text"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))/50] text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent transition"
                    placeholder={isRegistering ? "Seu e-mail" : "E-mail ou Login Mestre"}
                    value={formData.login}
                    onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                  />
                </motion.div>

                <motion.div variants={itemVariants} className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="block w-full pl-10 pr-10 py-3 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))/50] text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent transition"
                    placeholder="Sua senha"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </motion.div>

                {isRegistering && (
                  <motion.div variants={itemVariants} className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      className="block w-full pl-10 pr-10 py-3 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))/50] text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent transition"
                      placeholder="Confirme sua senha"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    />
                  </motion.div>
                )}
              </div>

              <motion.div variants={itemVariants}>
                <Button
                  type="submit"
                  className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isRegistering ? 'Cadastrar' : 'Entrar')}
                </Button>
              </motion.div>

              {!isRegistering && (
                <>
                  <div className="relative my-4 flex items-center justify-center select-none pointer-events-none">
                    <span className="absolute w-full border-t border-[hsl(var(--border))]" />
                    <span className="relative bg-[hsl(var(--card))] px-3 text-xs uppercase text-[hsl(var(--muted-foreground))] font-black tracking-widest text-[9px]">
                      ou login social
                    </span>
                  </div>
                  <motion.div variants={itemVariants}>
                    <button
                      onClick={handleGoogleSignIn}
                      type="button"
                      disabled={loading}
                      className="w-full h-12 flex items-center justify-center gap-2 border-2 border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))/50] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]/35 font-bold text-sm select-none cursor-pointer transition-all hover:border-[hsl(var(--foreground))]/30 hover:shadow-md"
                    >
                      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.1c-.22-.66-.35-1.39-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Entrar com o Google
                    </button>
                  </motion.div>
                </>
              )}

              <div className="text-center mt-6">
                <button
                  type="button"
                  className="text-sm font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition-colors cursor-pointer"
                  onClick={() => setIsRegistering(!isRegistering)}
                >
                  {isRegistering ? 'Já tem uma conta? Entre aqui' : 'Não tem uma conta? Cadastre-se'}
                </button>
              </div>
            </form>
          </>
        )}

        <div className="mt-8 text-center border-t border-[hsl(var(--border))] pt-6">
          <p className="text-[10px] uppercase tracking-widest font-black text-[hsl(var(--muted-foreground))]">
            Infraestrutura Segura Google Cloud
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
