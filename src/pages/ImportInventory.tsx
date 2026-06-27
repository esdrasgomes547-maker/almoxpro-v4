import { useState } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, Loader2, CheckCircle2 } from "lucide-react";
import { useOrganization } from "../lib/tenant";
import { handleFirestoreError, OperationType } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { saveInventoryItem } from "../lib/inventoryWrites";

interface Product {
  name: string;
  category: string;
  quantity: number;
  minStock: number;
  price: number;
}

export function ImportInventory() {
  const { orgId } = useOrganization();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [parsedData, setParsedData] = useState<Product[] | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type === "text/csv") {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          processDataWithAI(results.data);
        },
        error: (error) => setError(error.message),
      });
    } else if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        processDataWithAI(XLSX.utils.sheet_to_json(sheet));
      };
      reader.readAsBinaryString(file);
    } else {
      setError("Formato de arquivo não suportado.");
    }
  };

  const processDataWithAI = async (data: any[]) => {
    if (data.length === 0) {
      setError("A planilha está vazia.");
      return;
    }

    setIsProcessingAI(true);
    setError(null);
    setParsedData(null);

    try {
      const sampleRow = data[0];
      const headers = Object.keys(sampleRow);

      let mapping: any = {};
      
      try {
        const { chamarGeminiBackend } = await import("../lib/llmRouter");
        const responseText = await chamarGeminiBackend({
          mensagens: [{
             role: "user",
             text: `Dado as seguintes colunas: ${JSON.stringify(headers)}\nE o seguinte dado de exemplo: ${JSON.stringify(sampleRow)}\nMapeie as colunas para o banco de dados. Retorne um JSON estrito obedecendo este formato: { \"name\": \"colunaX\", \"category\": \"colunaY\", \"quantity\": \"colunaZ\", \"minStock\": \"colunaW\", \"price\": \"colunaK\" }. Não use markdown ou \`\`\`. Retorne apenas texto plano validado.`
          }]
        });
        if (responseText) {
          mapping = JSON.parse(responseText.trim().replace(/^```json/, '').replace(/```$/, '').trim());
        }
      } catch(e) {
        console.warn("Gemini parse failed", e);
      }

      const mappedProducts = data.map((item) => {
        const name = (mapping.name && item[mapping.name]) ? String(item[mapping.name]) : "Produto sem nome";
        const category = (mapping.category && item[mapping.category]) ? String(item[mapping.category]) : "Categoria Geral";
        
        let quantityStr = (mapping.quantity && item[mapping.quantity]) ? String(item[mapping.quantity]) : "0";
        let minStockStr = (mapping.minStock && item[mapping.minStock]) ? String(item[mapping.minStock]) : "0";
        let priceStr = (mapping.price && item[mapping.price]) ? String(item[mapping.price]) : "0";

        const quantity = parseFloat(quantityStr.replace(',', '.').replace(/[^0-9.-]+/g,"")) || 0;
        const minStock = parseFloat(minStockStr.replace(',', '.').replace(/[^0-9.-]+/g,"")) || 0;
        const price = parseFloat(priceStr.replace(',', '.').replace(/[^0-9.-]+/g,"")) || 0;

        return { name, category, quantity, minStock, price };
      });

      setParsedData(mappedProducts);
      setIsProcessingAI(false);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro inesperado ao processar os dados.');
      setIsProcessingAI(false);
    }
  };

  const confirmImport = async () => {
    if (!parsedData || !orgId) return;

    setIsProcessingAI(true);
    setError(null);
    
    try {
      for (const prod of parsedData) {
        const newId = `ITEM-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
        const status = prod.quantity <= 0 ? 'OUT_OF_STOCK' : (prod.quantity <= prod.minStock ? 'WARNING' : 'OK');
        const firestoreData = {
          name: prod.name,
          category: prod.category,
          location: "Importado",
          qty: prod.quantity,
          minQty: prod.minStock,
          price: prod.price,
          status,
        };
        await saveInventoryItem(orgId, newId, firestoreData);
      }
      
      setImportedCount(parsedData.length);
      setImportSuccess(true);
      setParsedData(null);
      
      setTimeout(() => {
        navigate('/app/inventory');
      }, 3000);

    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("Missing or insufficient permissions")) {
         handleFirestoreError(err, OperationType.CREATE, `organizations/${orgId}/inventory`);
      }
      setError(err.message || 'Erro inesperado ao salvar os dados.');
      setIsProcessingAI(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importar Estoque com IA</h1>
        <p className="text-muted-foreground mt-2">
          {parsedData 
            ? "Revise os dados identificados antes de confirmar a importação."
            : "Faça o upload de uma planilha (CSV ou XLSX). Nossa IA identificará as colunas automaticamente."}
        </p>
      </div>

      {!importSuccess && (
        parsedData ? (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2">Produto</th>
                      <th className="pb-2">Categoria</th>
                      <th className="pb-2">Qtd</th>
                      <th className="pb-2">Min</th>
                      <th className="pb-2">Preço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((prod, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2">{prod.name}</td>
                        <td className="py-2">{prod.category}</td>
                        <td className="py-2">{prod.quantity}</td>
                        <td className="py-2">{prod.minStock}</td>
                        <td className="py-2">R$ {prod.price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => setParsedData(null)}>Cancelar</Button>
                <Button onClick={confirmImport} disabled={isProcessingAI}>
                  {isProcessingAI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Confirmar Importação
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed transition-colors p-16 text-center rounded-lg flex flex-col items-center justify-center space-y-4 ${
                  isProcessingAI ? "border-primary/50 bg-primary/5 cursor-wait" : "border-primary/25 hover:border-primary/50 cursor-pointer bg-muted/10"
                }`}
              >
                <input {...getInputProps()} disabled={isProcessingAI} />
                <div className="p-4 bg-primary/10 rounded-full">
                  {isProcessingAI ? <Loader2 className="w-10 h-10 text-primary animate-spin" /> : <UploadCloud className="w-10 h-10 text-primary" />}
                </div>
                <div>
                  <p className="text-lg font-medium">
                    {isProcessingAI ? "Analisando planilha com IA..." : "Arraste e solte o arquivo aqui"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isProcessingAI ? "Isso pode levar alguns segundos." : "Ou clique para navegar. Suporta .csv e .xlsx"}
                  </p>
                </div>
                {!isProcessingAI && (
                  <Button variant="outline" className="mt-4">
                    Selecionar Arquivo
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      )}

      {error && (
        <div className="p-4 bg-destructive/15 text-destructive rounded-md font-medium">
          {error}
        </div>
      )}

      {importSuccess && (
        <div className="p-6 bg-green-500/15 text-green-700 border border-green-500/30 rounded-lg flex flex-col items-center justify-center space-y-3 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
          <div className="text-center">
            <h3 className="text-xl font-bold tracking-tight">Importação concluída!</h3>
            <p className="mt-1 font-medium">{importedCount} produtos foram cadastrados no estoque.</p>
            <p className="text-sm opacity-80 mt-2">Redirecionando para a lista de itens...</p>
          </div>
        </div>
      )}
    </div>
  );
}
