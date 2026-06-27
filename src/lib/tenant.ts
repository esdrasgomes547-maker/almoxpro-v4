import { useSubscription } from "./useSubscription";

/**
 * Retorna o `orgId` do usuário autenticado no sistema.
 * É baseado nos dados de `useSubscription` (que consolida o Custom Claim ou Firestore doc).
 */
export function useOrganization() {
  const { orgId, loading, role, isMaster } = useSubscription();
  const isDemo = localStorage.getItem('isDemoMode') === 'true';
  const isBypassed = localStorage.getItem('master_bypass') === 'true';
  
  let effectiveOrgId = orgId;
  
  if (isDemo) {
    let demoId = localStorage.getItem('demoOrgId');
    if (!demoId) {
      demoId = "demo-" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('demoOrgId', demoId);
    }
    effectiveOrgId = demoId;
  } else if (isBypassed) {
    effectiveOrgId = "tecgas-master";
  } else if (isMaster && !orgId) {
    effectiveOrgId = "demo-org";
  }

  return { orgId: effectiveOrgId, loading, role, isMaster, realOrgId: orgId };
}
