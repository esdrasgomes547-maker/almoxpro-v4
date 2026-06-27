# PROMPT — AlmoxPro SaaS (colar no Google AI Studio)

---

## CONTEXTO DO PROJETO

Você é um engenheiro sênior fullstack. Você vai transformar o **AlmoxPro** — um sistema de gestão de estoque e logística industrial — em um **SaaS completo**, pronto para vender no Brasil.

### Stack atual (já existe no repo)
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend/DB:** Firebase (Auth via Google login, Firestore em tempo real)
- **UI:** Lucide React + Recharts + shadcn-style components
- **Hospedagem futura:** Firebase Hosting

### Estrutura de arquivos atual
```
src/
  App.tsx                          ← roteamento + auth guard
  main.tsx
  index.css
  components/
    TecgasLogo.tsx
    ThemeProvider.tsx
    layout/AppLayout.tsx           ← sidebar, header, nav
    ui/badge.tsx, button.tsx, card.tsx, table.tsx
  lib/
    firebase.ts                    ← Firebase Auth + Firestore init
    data.ts
    notificationService.ts         ← WhatsApp (wa.me) + mailto
    utils.ts
  pages/
    Dashboard.tsx                  ← KPIs + gráficos (Recharts)
    Inventory.tsx                  ← CRUD estoque + movimentações
    Shipments.tsx                  ← CRUD expedições
    Suppliers.tsx                  ← CRUD fornecedores
    Employees.tsx                  ← CRUD funcionários + EPIs
    Settings.tsx                   ← config empresa + tema + notif
```

### Firestore — coleções atuais (flat, sem multi-tenant ainda)
```
/inventory/{itemId}
/inventory/{itemId}/movements/{movId}
/shipments/{shipmentId}
/suppliers/{supplierId}
/employees/{employeeId}
/settings/default
```

### O que o sistema faz hoje
- Login obrigatório via Google (Firebase Auth)
- Dashboard com KPIs dinâmicos e gráfico de expedição
- Controle de estoque com histórico de movimentações
- Gerenciamento de expedições, fornecedores, funcionários
- Tema dark/light com toggle
- Notificações via WhatsApp (wa.me link) e Email (mailto)

---

## O QUE PRECISA SER CONSTRUÍDO (SaaS Layer)

Construa **todos os arquivos abaixo**, completos, sem omitir código.

---

### 1. MULTI-TENANT — Migração para organizações

Migre a estrutura do Firestore de flat para multi-tenant:

```
/organizations/{orgId}/inventory/{itemId}
/organizations/{orgId}/inventory/{itemId}/movements/{movId}
/organizations/{orgId}/shipments/{shipmentId}
/organizations/{orgId}/suppliers/{supplierId}
/organizations/{orgId}/employees/{employeeId}
/organizations/{orgId}/settings/default
```

Crie `src/lib/tenant.ts`:
- Hook `useOrganization()` que retorna o `orgId` do usuário autenticado
  (lido do Firestore: `/users/{uid}` → campo `orgId`)
- Todos os hooks de dados recebem `orgId` como parâmetro
- Ao criar conta nova, criar automaticamente um documento `/organizations/{orgId}`
  e `/users/{uid}` com `orgId`, `role: "premium_max"` e `plan: "premium_max"`

Atualize TODOS os arquivos de páginas (Dashboard, Inventory, Shipments,
Suppliers, Employees, Settings) para usar o `orgId` em todas as queries
do Firestore.

---

### 2. SISTEMA DE ROLES (Firebase Custom Claims)

**Roles existentes:**
- `master` → dono do produto (Esdras) e chefes — acesso total, sem cobrança, nunca expira
- `premium_max` → cliente pagante ativo — acesso completo ao sistema
- sem role / `inactive` → bloqueado, redireciona para página de upgrade

**Arquivo: `functions/src/index.ts`** (Firebase Cloud Functions v2, Node 20)

Crie as seguintes Cloud Functions:

```typescript
// 1. setMasterRole(uid: string)
//    Seta custom claim { role: "master" } no usuário informado
//    Só pode ser chamada por outro master ou internamente
//    Trigger: onCall (requer role master)

// 2. activateSubscription(data: { orgId, uid, asaasPaymentId, plan })
//    Chamada pelo webhook do Asaas após pagamento confirmado
//    - Seta custom claim { role: "premium_max", plan: "premium_max" }
//    - Cria/atualiza /subscriptions/{orgId} com status: "active",
//      nextBillingDate, asaasCustomerId, asaasSubscriptionId
//    - Cria /organizations/{orgId} se não existir
//    - Cria /users/{uid} com orgId, role, plan

// 3. asaasWebhook (onRequest — HTTP endpoint público)
//    Recebe POST do Asaas com eventos de pagamento
//    Valida o header "asaas-access-token" contra env ASAAS_WEBHOOK_TOKEN
//    Eventos tratados:
//      PAYMENT_CONFIRMED → chama activateSubscription
//      PAYMENT_RECEIVED  → chama activateSubscription
//      PAYMENT_OVERDUE   → seta role "inactive", atualiza /subscriptions/{orgId}
//      PAYMENT_DELETED   → seta role "inactive"
//    Retorna 200 OK sempre para o Asaas não retentar

// 4. createAsaasCustomerAndSubscription (onCall — requer auth)
//    Recebe: { name, email, cpfCnpj, phone, paymentMethod }
//    Cria cliente no Asaas via API REST (base URL: https://api.asaas.com/v3)
//    Cria assinatura de R$10,00/mês no Asaas com o método escolhido
//    Retorna { paymentLink, billingType, status } para o frontend exibir
```

**Variáveis de ambiente necessárias (functions):**
```
ASAAS_API_KEY=          # chave da API Asaas (sandbox: $aact_... / prod: $aas_...)
ASAAS_WEBHOOK_TOKEN=    # token para validar webhooks do Asaas
ASAAS_ENV=sandbox       # "sandbox" ou "production"
```

---

### 3. FIRESTORE SECURITY RULES — `firestore.rules`

Reescreva completamente as regras para multi-tenant + roles:

```javascript
// Regras de acesso:
// master      → lê e escreve TUDO em qualquer organização
// premium_max �� lê e escreve apenas na própria organização
// inactive/sem role → lê apenas /subscriptions/{orgId} e /users/{uid} próprios

// Funções auxiliares necessárias:
// isMaster()        → verifica custom claim role == "master"
// isPremiumMax()    → verifica custom claim role == "premium_max"
// isOrgMember(orgId) → verifica se /users/{uid}.orgId == orgId
// isSignedIn()
// isValidInventoryItem(data), isValidShipment(data), etc. (reutilizar as existentes)

// Estrutura:
// /organizations/{orgId}/** → master ou (premium_max && isOrgMember(orgId))
// /users/{uid}             → próprio usuário ou master
// /subscriptions/{orgId}   → master ou isOrgMember(orgId) (só leitura para membro)
```

---

### 4. LANDING PAGE — `src/pages/Landing.tsx`

Landing page completa, dark por padrão, identidade visual AlmoxPro.
Seções (em ordem):

**Hero:**
- Logo AlmoxPro + tagline: "Gestão industrial de estoque e logística. Simples, rápido, no controle."
- CTA principal: "Começar agora — R$10/mês"
- CTA secundário: "Ver demonstração"
- Badge: "Pix · Cartão · Boleto"

**Problemas que resolve (3 cards):**
- "Perdeu peça no almoxarifado?" → controle de SKU com localização
- "Expedição sem rastreio?" → status em tempo real
- "Fornecedor sem histórico?" → avaliação e contato centralizados

**Features (grade 2x3):**
- Controle de estoque em tempo real
- Alertas de ruptura automáticos
- Histórico de movimentações
- Gestão de expedições
- Catálogo de fornecedores
- Equipe e EPIs

**Pricing (1 plano apenas — Premium Max):**
- Card destacado: R$10,00/mês
- Lista de benefícios: acesso completo a todos os módulos, dados ilimitados,
  alertas automáticos, suporte via WhatsApp, atualizações inclusas
- Botão: "Assinar agora"
- Métodos: ícones de Pix + Cartão + Boleto

**Social proof (placeholder):**
- 3 depoimentos fictícios de técnicos de GLP / almoxarifes

**FAQ (5 perguntas):**
- Posso cancelar quando quiser?
- Meus dados são seguros?
- Funciona no celular?
- Quantos usuários posso ter?
- Como funciona o pagamento?

**Footer:**
- Logo + copyright ALTEC 2025
- Links: Política de Privacidade, Termos de Uso

A landing page NÃO usa AppLayout. É uma página standalone com header próprio
(logo à esquerda, botão "Entrar" à direita).

---

### 5. FLUXO DE ASSINATURA — `src/pages/Subscribe.tsx`

Página de checkout após clicar em "Assinar agora":

**Step 1 — Dados pessoais:**
- Nome completo, Email, CPF ou CNPJ, Telefone (WhatsApp)

**Step 2 — Método de pagamento:**
- 3 opções com ícone: PIX (gera QR Code), Cartão de Crédito, Boleto
- Ao selecionar Cartão: campos de número, nome, validade, CVV (layout visual de cartão)
- Ao selecionar PIX: aviso "O QR Code será gerado após confirmar"
- Ao selecionar Boleto: aviso "O boleto será enviado por email"

**Step 3 — Confirmação:**
- Se PIX: exibe QR Code (imagem base64 retornada pelo Asaas) + código copia-e-cola
  + countdown de 30 minutos + instrução "Após o pagamento, o acesso é liberado automaticamente"
- Se Boleto: exibe link para download do boleto + instrução
- Se Cartão: exibe mensagem de processamento → redireciona para o app após sucesso

A chamada ao backend é feita via Firebase Cloud Function `createAsaasCustomerAndSubscription`.
Enquanto aguarda, exibe spinner com texto "Gerando sua assinatura...".

Use `useState` + `useCallback` para gerenciar os steps.
Não use biblioteca de formulário externa — só React puro.

---

### 6. PAINEL MASTER — `src/pages/MasterPanel.tsx`

Acessível apenas por usuários com `role: "master"`. Adicionar rota `/master` no App.tsx.

**Seções:**

**Visão geral:**
- Total de organizações ativas
- Total de receita mensal (R$ total_orgs × 10)
- Inadimplentes (status overdue)
- Novos este mês

**Tabela de clientes:**
- Colunas: orgId, nome da empresa, email do admin, status (active/overdue/inactive),
  próxima cobrança, data de criação, ações
- Ações por linha: Reativar, Suspender, Promover a Master, Ver dados da org
- Busca por nome/email
- Fonte de dados: coleção `/subscriptions` + `/organizations`

**Botão "Adicionar Master":**
- Modal com campo de UID ou email do usuário
- Chama Cloud Function `setMasterRole`

Lê dados do Firestore em tempo real com `onSnapshot`.

---

### 7. GUARD DE ACESSO — `src/components/AccessGuard.tsx`

Componente wrapper que:
- Se `loading` → exibe spinner centralizado
- Se `!user` → redireciona para `/` (landing)
- Se `role === "master"` → renderiza children
- Se `role === "premium_max"` → renderiza children
- Se role ausente ou `"inactive"` → exibe tela de "Acesso bloqueado"
  com botão "Assinar agora" que redireciona para `/subscribe`

Lê o role via `user.getIdTokenResult(true).claims.role`.
Forçar refresh do token a cada mount para pegar claims atualizados.

---

### 8. ATUALIZAÇÃO DO `App.tsx`

Adicione as rotas:
```tsx
/ → <Landing /> (pública, sem AppLayout)
/subscribe → <Subscribe /> (pública, sem AppLayout)
/app/* → <AccessGuard><AppLayout><Routes>...</Routes></AppLayout></AccessGuard>
/master → <AccessGuard requireMaster><MasterPanel /></AccessGuard>
```

Remova o login inline do App.tsx atual — o login agora está na Landing.
Após login via Google, verificar se usuário já tem orgId em `/users/{uid}`:
- Sim → redireciona para `/app`
- Não → redireciona para `/subscribe`

---

### 9. HOOK DE SUBSCRIPTION — `src/lib/useSubscription.ts`

```typescript
// Hook que retorna:
// { role, plan, orgId, loading, isActive, isMaster }
// Combina custom claims (via getIdTokenResult) + dados de /users/{uid}
// Refresca automaticamente o token a cada 55 minutos
// Exporta também: useOrganization() → { orgId }
```

---

### 10. ARQUIVO `.env.example` ATUALIZADO

```
# Firebase (frontend)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_ID=

# Firebase Functions (backend — definir no console do Firebase)
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
ASAAS_ENV=sandbox

# IDs dos masters iniciais (separados por vírgula)
MASTER_UIDS=uid1,uid2
```

---

### 11. SCRIPT DE SETUP INICIAL — `scripts/setup-masters.ts`

Script Node.js que:
- Lê `MASTER_UIDS` do `.env`
- Para cada UID, usa Firebase Admin SDK para setar custom claim `{ role: "master" }`
- Exibe confirmação no terminal

```bash
# Uso: npx ts-node scripts/setup-masters.ts
```

---

### 12. `firebase.json` e `firestore.indexes.json`

Atualize `firebase.json` para incluir:
- hosting (public: dist, rewrites para SPA)
- functions (source: functions, runtime: nodejs20)
- firestore rules e indexes

Crie `firestore.indexes.json` com índices para:
- `/organizations/{orgId}/inventory` por `status` + `category`
- `/organizations/{orgId}/shipments` por `date` DESC + `status`
- `/subscriptions` por `status` + `createdAt` DESC

---

## INSTRUÇÕES DE GERAÇÃO

1. Gere **um arquivo de cada vez**, completo, sem `// ... resto do código`.
2. Comece pelo `firestore.rules`, depois `functions/src/index.ts`,
   depois `src/lib/tenant.ts`, depois `src/lib/useSubscription.ts`,
   depois `src/pages/Landing.tsx`, depois `src/pages/Subscribe.tsx`,
   depois `src/pages/MasterPanel.tsx`, depois `src/components/AccessGuard.tsx`,
   e por último `src/App.tsx` atualizado.
3. Para as páginas existentes (Dashboard, Inventory, etc.), mostre apenas
   as linhas que precisam mudar para usar `orgId` — use comentários
   `// ALTERAR: ` para indicar cada mudança.
4. Use TypeScript estrito em todos os arquivos.
5. Comentários em português (pt-BR).
6. Estilos apenas com Tailwind CSS e variáveis CSS existentes (`hsl(var(--primary))` etc.).
7. Não instale bibliotecas novas além das já listadas no `package.json` atual.
   Exceção: `firebase-admin`, `firebase-functions` e `axios` nas Cloud Functions.
8. No Asaas, use sempre a URL base condicional:
   ```typescript
   const ASAAS_BASE = process.env.ASAAS_ENV === 'production'
     ? 'https://api.asaas.com/v3'
     : 'https://sandbox.asaas.com/api/v3';
   ```
9. O valor da assinatura é **R$10,00** (BRL), ciclo **MONTHLY**.
10. Na Cloud Function `asaasWebhook`, nunca retornar status 4xx/5xx
    para o Asaas — sempre 200, logar erros internamente.

---

## DEPENDÊNCIAS A ADICIONAR

No `package.json` do projeto principal, não há novas dependências.

No `functions/package.json` (novo), inclua:
```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "typescript": "~5.8.2",
    "@types/node": "^20.0.0",
    "ts-node": "^10.9.0"
  },
  "engines": { "node": "20" }
}
```

---

## RESULTADO ESPERADO

Ao final, o ALTEC deve:

✅ Ter uma landing page pública em `/` vendendo o plano Premium Max por R$10/mês  
✅ Aceitar pagamento via Pix, Cartão de Crédito/Débito e Boleto (Asaas)  
✅ Ativar acesso automaticamente via webhook após confirmação de pagamento  
✅ Isolar dados de cada cliente em `/organizations/{orgId}/...`  
✅ Ter roles `master` (dono) e `premium_max` (cliente) com Firebase Custom Claims  
✅ Bloquear acesso a usuários sem assinatura ativa  
✅ Ter painel `/master` para gerenciar todos os clientes  
✅ Funcionar com deploy em `firebase deploy` (hosting + functions + rules)  

---

*Projeto: AlmoxPro — Sistema de Gestão Industrial de Estoque e Logística*  
*Empresa: AlmoxPro Solutions*  
*Repositório: github.com/esdrasgomes547-maker/AlmoxPro*
