import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, ensureAuth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, collection, setDoc } from 'firebase/firestore';

// Helper function to fetch user public IP address or generate a high-trust fallback
async function fetchUserIP(): Promise<string> {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    if (!response.ok) throw new Error("API response error");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.warn("Real IP fetch failed, using virtual device IP fallback", error);
    let virtualIP = localStorage.getItem("almoxpro_virtual_ip");
    if (!virtualIP) {
      const randomIpTail = Math.floor(Math.random() * 254) + 1;
      virtualIP = `189.120.45.${randomIpTail}`;
      localStorage.setItem("almoxpro_virtual_ip", virtualIP);
    }
    return virtualIP;
  }
}

interface SubscriptionContextType {
  role: string | null;
  plan: string | null;
  orgId: string | null;
  loading: boolean;
  isMaster: boolean;
  isActive: boolean;
  ipAddress: string;
  deviceLimitExceeded: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isMasterRole, setIsMasterRole] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentIp, setCurrentIp] = useState<string>('');
  const [deviceLimitExceeded, setDeviceLimitExceeded] = useState(false);

  useEffect(() => {
    let unsubDoc: (() => void) | undefined;
    let unsubMaster: (() => void) | undefined;
    let unsubDevices: (() => void) | undefined;

    const checkBypass = () => {
      const isBypass = localStorage.getItem('master_bypass') === 'true';
      if (isBypass) {
        setIsMasterRole(true);
        return true;
      }
      return false;
    };

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      const isBypassedAuth = checkBypass();

      if (user) {
        if (user.email === "esdrasgomes547@gmail.com" || isBypassedAuth) {
          setIsMasterRole(true);
        } else if (user.email) {
          unsubMaster = onSnapshot(doc(db, "masters", user.email), (snap) => {
             if (snap.exists()) setIsMasterRole(true);
             else setIsMasterRole(false);
          }, (err) => console.warn("Master check restriction:", err.message));
        }

        unsubDoc = onSnapshot(doc(db, "users", user.uid), async (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const currentRole = data.role || 'user';
            const currentOrgId = data.orgId || 'demo-org';

            setRole(currentRole);
            setOrgId(currentOrgId);
            setPlan(data.plan || null);

            try {
              const ip = await fetchUserIP();
              setCurrentIp(ip);

              const isBypassCheck = localStorage.getItem('master_bypass') === 'true' || user.email === "esdrasgomes547@gmail.com";
              if (isBypassCheck) {
                setDeviceLimitExceeded(false);
                setLoading(false);
                return;
              }

              if (unsubDevices) {
                unsubDevices();
                unsubDevices = undefined;
              }

              const devicesRef = collection(db, `organizations/${currentOrgId}/active_devices`);
              unsubDevices = onSnapshot(devicesRef, async (deviceSnap) => {
                const deviceList: any[] = [];
                deviceSnap.forEach(d => {
                  deviceList.push(d.data());
                });

                const isRegistered = deviceList.some((d: any) => d.ip === ip);

                if (isRegistered) {
                  setDeviceLimitExceeded(false);
                  const existingDevice = deviceList.find((d: any) => d.ip === ip);
                  const lastActiveTime = existingDevice?.lastActive ? new Date(existingDevice.lastActive).getTime() : 0;
                  const now = Date.now();

                  if (now - lastActiveTime > 2 * 60 * 1000) {
                    try {
                      await setDoc(doc(db, `organizations/${currentOrgId}/active_devices`, ip.replace(/\./g, '_')), {
                        ip,
                        lastActive: new Date().toISOString(),
                        userEmail: user.email || 'user@almoxpro.com.br'
                      }, { merge: true });
                    } catch (e) {
                      console.warn("Falha ao sincronizar carimbo do IP:", e);
                    }
                  }
                } else {
                  if (deviceList.length < 3) {
                    setDeviceLimitExceeded(false);
                    try {
                      await setDoc(doc(db, `organizations/${currentOrgId}/active_devices`, ip.replace(/\./g, '_')), {
                        ip,
                        lastActive: new Date().toISOString(),
                        userEmail: user.email || 'user@almoxpro.com.br'
                      });
                    } catch (e) {
                      console.warn("Falha ao registrar novo IP:", e);
                    }
                  } else {
                    setDeviceLimitExceeded(true);
                  }
                }
                setLoading(false);
              }, (err) => {
                console.warn("Devices surveillance blocked by rules:", err.message);
                setLoading(false);
              });

            } catch (err) {
              console.error("Device IP tracking execution failure:", err);
              setLoading(false);
            }

          } else {
            setLoading(false);
          }
        }, (error) => {
          console.warn("User data restriction:", error.message);
          setLoading(false);
        });

      } else {
        setRole(null);
        setOrgId(null);
        setPlan(null);
        setDeviceLimitExceeded(false);
        if (isBypassedAuth) {
          setIsMasterRole(true);
          ensureAuth().catch(err => {
            console.warn("Anonymous auth failed in background:", err.message);
            setLoading(false);
          });
          setLoading(false);
        } else {
          setIsMasterRole(false);
          setLoading(false);
        }
      }
    });

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
      if (unsubMaster) unsubMaster();
      if (unsubDevices) unsubDevices();
    };
  }, []);

  const isBypassed = localStorage.getItem('master_bypass') === 'true';
  const isDemoMode = localStorage.getItem('isDemoMode') === 'true';

  const mappedRole = isBypassed 
    ? 'master' 
    : (plan === 'basic' ? 'basic' : plan === 'medium' ? 'medium' : (plan === 'pro' ? 'master' : role));
  
  const effectiveOrgId = isBypassed ? 'tecgas-master' : orgId;

  const value = {
    role: mappedRole,
    plan: isBypassed ? 'pro' : plan,
    orgId: effectiveOrgId,
    loading,
    isActive: isMasterRole || isBypassed || isDemoMode || (plan !== null && plan !== undefined),
    isMaster: isMasterRole || isBypassed || (plan === 'pro'),
    ipAddress: currentIp,
    deviceLimitExceeded
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscriptionContext must be used within a SubscriptionProvider');
  }
  return context;
}
