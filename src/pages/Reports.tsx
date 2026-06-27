import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { useOrganization } from "../lib/tenant";

export function Reports() {
  const { orgId } = useOrganization();
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, `organizations/${orgId}/inventory`), limit(2000));
    const unsub = onSnapshot(q, (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/inventory`));
    return () => unsub();
  }, [orgId]);

  const filteredInventory = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return inventory.filter(item => 
      item.name?.toLowerCase().includes(lower) || 
      item.category?.toLowerCase().includes(lower) ||
      item.id?.toLowerCase().includes(lower)
    );
  }, [inventory, searchTerm]);

  const displayedItems = selectedItemIds.length > 0 
    ? inventory.filter(item => selectedItemIds.includes(item.id)) 
    : filteredInventory;

  const reportDataByCat = useMemo(() => {
    const data: Record<string, { qty: number, totalValue: number }> = {};
    displayedItems.forEach(item => {
      const cat = item.category || 'Sem Categoria';
      if (!data[cat]) {
        data[cat] = { qty: 0, totalValue: 0 };
      }
      data[cat].qty += item.qty || 0;
      data[cat].totalValue += ((item.qty || 0) * (item.price || 0));
    });
    return data;
  }, [displayedItems]);

  const grandTotal = displayedItems.reduce((sum, item) => sum + ((item.qty || 0) * (item.price || 0)), 0);
  const totalQty = displayedItems.reduce((sum, item) => sum + (item.qty || 0), 0);

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text(`Relatório de Inventário - ${new Date().toLocaleDateString()}`, 14, 15);
    doc.setFontSize(10);
    doc.text(selectedItemIds.length > 0 ? '(Itens Selecionados)' : '(Todos os Itens)', 14, 20);
    
    const tableData = displayedItems.map(item => [
      item.name,
      item.category || '-',
      (item.qty || 0).toString(),
      `R$ ${(item.price || 0).toFixed(2)}`,
      `R$ ${((item.qty || 0) * (item.price || 0)).toFixed(2)}`
    ]);

    autoTable(doc, {
      head: [['Produto', 'Categoria', 'Quantidade', 'Valor Un.', 'Total Venda']],
      body: tableData,
      startY: 25,
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text(`Quantidade Total: ${totalQty}`, 14, finalY);
    doc.text(`Valor Total: R$ ${grandTotal.toFixed(2)}`, 14, finalY + 6);
    
    doc.save('relatorio_inventario.pdf');
  };

  const downloadCSV = () => {
    const headers = ['Produto', 'Categoria', 'Quantidade', 'Valor Un.', 'Total Venda'];
    const rows = displayedItems.map(item => [
      `"${item.name || ''}"`,
      `"${item.category || ''}"`,
      item.qty || 0,
      (item.price || 0).toFixed(2),
      ((item.qty || 0) * (item.price || 0)).toFixed(2)
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "relatorio_inventario.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItemIds(filteredInventory.map(i => i.id));
    } else {
      setSelectedItemIds([]);
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    setSelectedItemIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Relatórios de Inventário</h1>
        <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadCSV}><Download className="mr-2 h-4 w-4" /> Baixar CSV</Button>
            <Button size="sm" onClick={downloadPDF}><Download className="mr-2 h-4 w-4" /> Baixar PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Itens Listados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayedItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Quantidade Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQty}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Valor Total de Venda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">R$ {grandTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle>
            {selectedItemIds.length > 0 ? `Resumo por Categoria (${selectedItemIds.length} selecionados)` : 'Resumo por Categoria'}
          </CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar para filtrar..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto space-y-6">
          <Table className="min-w-[500px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-center">
                  <input 
                    type="checkbox"
                    checked={filteredInventory.length > 0 && selectedItemIds.length === filteredInventory.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-muted-foreground text-primary focus:ring-primary"
                  />
                </TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Valor Un.</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map(item => (
                <TableRow key={item.id} data-state={selectedItemIds.includes(item.id) ? "selected" : undefined}>
                  <TableCell className="text-center">
                    <input 
                      type="checkbox"
                      checked={selectedItemIds.includes(item.id)}
                      onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                      className="rounded border-muted-foreground text-primary focus:ring-primary"
                    />
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate" title={item.name}>{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.category}</TableCell>
                  <TableCell className="text-right font-mono">{item.qty}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    R$ {(item.price || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    R$ {((item.qty || 0) * (item.price || 0)).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {filteredInventory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {Object.keys(reportDataByCat).length > 0 && (
            <div className="pt-6 border-t">
              <h3 className="text-lg font-bold mb-4">Totais Agrupados por Categoria</h3>
              <Table className="min-w-[500px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Quantidade Total</TableHead>
                    <TableHead className="text-right">Valor Total de Venda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(Object.entries(reportDataByCat) as [string, { qty: number, totalValue: number }][]).map(([cat, data]) => (
                    <TableRow key={cat} className="bg-muted/20">
                      <TableCell className="font-medium">{cat}</TableCell>
                      <TableCell className="text-right font-mono">{data.qty}</TableCell>
                      <TableCell className="text-right font-mono font-bold">R$ {data.totalValue.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

