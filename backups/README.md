# Backup Checkpoint - Almox Pro

Este diretório contém cópias de backup seguras dos arquivos de configuração críticos do sistema e regras de banco de dados (`firestore.rules`), criadas em **03 de Junho de 2026** como um ponto de restauração confiável de produção.

## Arquivos de Backup

1. **`firestore.rules`**
   - Configuração de regras do Firestore otimizada.
   - Corrige o bypass de segurança do tenant, garantindo acesso completo a organizações demo `demo-*` e permitindo permissões flexíveis de Master Admin sem quebra de regras.

2. **`server.ts`**
   - O servidor Express integrado com Vite do backend.
   - Contém as APIs integradas com IA (Gemini robust checker, análise de serviços de engenharia e scanner OCR de códigos de barra).

3. **`firebase.ts`**
   - Inicialização e tratamento de conexão do SDK cliente do Firebase e Firestore.
   - Configuração de cache massivo persistente offline e retentativas em login anônimo.

4. **`tenant.ts`**
   - Lógica de tenant (`useOrganization`) para isolar com precisão os dados de demonstração dos dados de produção.

## Como Restaurar

Caso precise voltar a este checkpoint em qualquer arquivo, basta substituir o conteúdo do arquivo original no projeto com o conteúdo correspondente contido neste diretório de `/backups`.
