import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, doc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, ShieldAlert, CreditCard, Activity, Play, Eye } from 'lucide-react';
import { Organization } from '../types';

export function MasterPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddMasterModalOpen, setIsAddMasterModalOpen] = useState(false);
  const [newMasterEmail, setNewMasterEmail] = useState('');
  
  useEffect(() => {
    // Escuta Organizations - Limiting to prevent memory leak on massive databases
    const qOrg = query(collection(db, "organizations"), orderBy("createdAt", "desc"), limit(2000));
    const unsubOrg = onSnapshot(qOrg, (snap) => {
      setOrganizations(snap.docs.map(d => ({ orgId: d.id, ...d.data() } as Organization)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "organizations"));

    return () => {
      unsubOrg();
    };
  }, []);

  const { totalOrgs, activeOrgs, mrr } = React.useMemo(() => {
    const active = organizations.filter(o => o.status === 'active').length;
    return {
      totalOrgs: organizations.length,
      activeOrgs: active,
      mrr: active * 10
    };
  }, [organizations]);

  const handleSetMaster = async () => {
    if (!newMasterEmail) return;
    try {
      await setDoc(doc(db, "masters", newMasterEmail.toLowerCase()), { 
        addedAt: new Date(),
        email: newMasterEmail.toLowerCase()
      });
      alert(`Role master definida para ${newMasterEmail}. O usuário já pode acessar o painel.`);
      setIsAddMasterModalOpen(false);
      setNewMasterEmail('');
    } catch (e: any) {
      alert(e.message || "Erro");
    }
  };

  const filteredOrgs = React.useMemo(() => {
    return organizations.filter(org => 
      org.orgId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [organizations, searchTerm]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Master Panel</h1>
          <p className="text-[hsl(var(--muted-foreground))] mt-1">Gestão de clientes e assinaturas do Almox pro.</p>
        </div>
        <Button onClick={() => setIsAddMasterModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white">
          <ShieldAlert className="w-4 h-4 mr-2" /> Promover a Master
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Total de Organizações</CardTitle>
            <Activity className="h-4 w-4 text-[hsl(var(--primary))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrgs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">MRR Projetado</CardTitle>
            <CreditCard className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {mrr.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Ativas</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{activeOrgs}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-[hsl(var(--border))] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Clientes</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input 
              type="text" 
              placeholder="Buscar Org ID..." 
              className="w-full h-9 pl-9 pr-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:ring-1 focus:ring-[hsl(var(--primary))] outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Org ID</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
               </TableHeader>
               <TableBody>
                 {filteredOrgs.map(org => {
                   return (
                     <TableRow key={org.orgId}>
                       <TableCell className="font-mono text-xs">{org.orgId}</TableCell>
                       <TableCell>{org.createdAt ? new Date((org.createdAt as any).seconds ? (org.createdAt as any).seconds * 1000 : org.createdAt).toLocaleDateString("pt-BR") : "N/A"}</TableCell>
                       <TableCell>
                         <Badge variant="outline" className={
                           org.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                           'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                         }>
                           {org.status || "Desconhecido"}
                         </Badge>
                       </TableCell>
                       <TableCell className="text-right flex items-center justify-end space-x-2">
                         <Button variant="ghost" size="sm" className="h-8">
                           <Eye className="h-4 w-4 mr-1" /> View
                         </Button>
                       </TableCell>
                     </TableRow>
                   );
                 })}
               </TableBody>
             </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Add Master */}
      {isAddMasterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm shadow-xl">
             <CardHeader className="border-b border-[hsl(var(--border))]">
               <CardTitle>Adicionar Master</CardTitle>
             </CardHeader>
             <CardContent className="p-6 space-y-4">
               <div>
                 <label className="text-sm font-medium mb-1 block">Email do Usuário</label>
                 <input 
                    type="email" 
                    value={newMasterEmail}
                    onChange={(e) => setNewMasterEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:border-[hsl(var(--primary))] outline-none"
                    placeholder="Ex: adson@email.com"
                 />
               </div>
               <div className="flex justify-end space-x-2">
                 <Button variant="outline" onClick={() => setIsAddMasterModalOpen(false)}>Cancelar</Button>
                 <Button className="bg-purple-600 hover:bg-purple-700 text-white" disabled={!newMasterEmail} onClick={handleSetMaster}>Conceder Role</Button>
               </div>
             </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
