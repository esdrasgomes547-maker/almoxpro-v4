import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "./firebase";
import { chamarLLM } from "./llmRouter";

export interface Inconsistencia {
  tipo: "CATEGORIA_INEXISTENTE" | "SEM_PRECO" | "SEM_FOTO" | "ESTOQUE_CRITICO" | "SEM_LOCALIZACAO";
  severidade: "ALTA" | "MEDIA" | "BAIXA";
  sku: string;
  nome: string;
  descricao: string;
  sugestao: string;
}

export interface RelatorioInconsistencias {
  total: number;
  criticas: number;
  itens: Inconsistencia[];
  resumo: string;
  geradoEm: Date;
}

export async function detectarInconsistencias(orgId: string): Promise<RelatorioInconsistencias> {
  // Busca dados do Firebase
  const [invSnap, catSnap] = await Promise.all([
    getDocs(query(collection(db, `organizations/${orgId}/inventory`), limit(200))),
    getDocs(collection(db, `organizations/${orgId}/categories`)).catch(() => null),
  ]);

  const produtos = invSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const categoriasCadastradas = catSnap
    ? catSnap.docs.map(d => (d.data().name ?? d.id).toUpperCase())
    : [];

  const inconsistencias: Inconsistencia[] = [];

  for (const produto of produtos) {
    // Sem preço
    if (!produto.price || produto.price === 0) {
      inconsistencias.push({
        tipo: "SEM_PRECO",
        severidade: "MEDIA",
        sku: produto.id,
        nome: produto.name,
        descricao: `Produto sem preço de custo cadastrado`,
        sugestao: `Consulte o fornecedor e atualize o valor unitário`,
      });
    }

    // Sem foto
    if (!produto.imageUrl) {
      inconsistencias.push({
        tipo: "SEM_FOTO",
        severidade: "BAIXA",
        sku: produto.id,
        nome: produto.name,
        descricao: `Produto sem imagem cadastrada`,
        sugestao: `Fotografe o produto e faça upload pela tela de estoque`,
      });
    }

    // Sem localização
    if (!produto.location) {
      inconsistencias.push({
        tipo: "SEM_LOCALIZACAO",
        severidade: "MEDIA",
        sku: produto.id,
        nome: produto.name,
        descricao: `Produto sem localização no almoxarifado`,
        sugestao: `Defina a prateleira/posição deste produto`,
      });
    }

    // Estoque crítico
    if ((produto.qty ?? 0) <= (produto.minQty ?? 0) && (produto.minQty ?? 0) > 0) {
      inconsistencias.push({
        tipo: "ESTOQUE_CRITICO",
        severidade: "ALTA",
        sku: produto.id,
        nome: produto.name,
        descricao: `Estoque ${produto.qty === 0 ? "zerado" : "abaixo do mínimo"} (${produto.qty ?? 0} un, mín: ${produto.minQty})`,
        sugestao: `Solicite reposição imediata ao fornecedor`,
      });
    }

    // Categoria que não existe no cadastro (só verifica se tem categorias cadastradas)
    if (categoriasCadastradas.length > 0 && produto.category) {
      const catProduto = produto.category.toUpperCase();
      if (!categoriasCadastradas.includes(catProduto)) {
        inconsistencias.push({
          tipo: "CATEGORIA_INEXISTENTE",
          severidade: "BAIXA",
          sku: produto.id,
          nome: produto.name,
          descricao: `Categoria "${produto.category}" não está cadastrada no sistema`,
          sugestao: `Cadastre a categoria ou corrija o nome do produto`,
        });
      }
    }
  }

  // Ordena por severidade
  const ordem = { ALTA: 0, MEDIA: 1, BAIXA: 2 };
  inconsistencias.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);

  // Gera resumo com Gemini localmente
  let resumo = `Encontrei ${inconsistencias.length} inconsistências (${inconsistencias.filter(i => i.severidade === "ALTA").length} críticas).`;

  if (inconsistencias.length > 0) {
    try {
      const top5 = inconsistencias.slice(0, 5).map(i => `${i.tipo}: ${i.nome} — ${i.descricao}`).join("\n");
      const resultado = await chamarLLM([
        { role: "system", content: "Você é o Pro, assistente industrial do AlmoxPro. Seja direto e profissional." },
        { role: "user", content: `Em 2 frases diretas, resuma estas inconsistências:\n${top5}` }
      ], "resumo_alerta");
      resumo = resultado.texto;
    } catch { }
  }

  return {
    total: inconsistencias.length,
    criticas: inconsistencias.filter(i => i.severidade === "ALTA").length,
    itens: inconsistencias.slice(0, 50), // máx 50 pra não sobrecarregar
    resumo,
    geradoEm: new Date(),
  };
}

// Detecta produtos que precisam de atenção frequente vs raramente alterados
export async function detectarPadroesUso(orgId: string) {
  const movSnap = await getDocs(
    query(collection(db, `organizations/${orgId}/activity_log`), limit(200))
  ).catch(() => null);

  if (!movSnap) return { frequentes: [], raros: [] };

  const contagem: Record<string, number> = {};
  movSnap.docs.forEach(d => {
    const sku = d.data().itemId ?? d.data().sku ?? "";
    if (sku) contagem[sku] = (contagem[sku] ?? 0) + 1;
  });

  const ordenados = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  return {
    frequentes: ordenados.slice(0, 15).map(([sku, count]) => ({ sku, count })),
    raros: ordenados.slice(-15).map(([sku, count]) => ({ sku, count })),
  };
}
