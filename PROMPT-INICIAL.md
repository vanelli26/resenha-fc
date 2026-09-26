# Prompt inicial — Fase 0 (colar no Claude Code)

> Pré-requisitos feitos por você antes de colar:
> 1. Projeto criado no console do Firebase, com Authentication (provedor Google) e Firestore (região `southamerica-east1`) habilitados, e um app Web registrado (copie a config).
> 2. `npm i -g firebase-tools` e `firebase login`.
> 3. Pasta do repositório com `CLAUDE.md` e `DIRETRIZES.md` na raiz.
> 4. Skill do Angular copiada para `.claude/skills/angular-developer` e plugin Firebase habilitado (`/plugin marketplace add firebase/agent-skills` e `/plugin install firebase@firebase`).

---

Leia `CLAUDE.md` e `DIRETRIZES.md` por completo. Vamos executar a **Fase 0 — Fundação** do roadmap (DIRETRIZES, seção 9). O repositório ainda não tem o projeto Angular.

Objetivo: base funcional com login Google, layout responsivo e Firebase configurado, sem nenhuma feature de domínio ainda.

Escopo:

1. Criar o projeto Angular na raiz do repositório com a versão estável atual do Angular CLI: standalone, roteamento, SCSS, sem SSR, com strict mode. Informe a versão exata instalada e registre na seção 10 de DIRETRIZES.
2. Adicionar ESLint (`@angular-eslint`) e garantir que `npm run lint` e `npm run build` existam e passem.
3. Instalar PrimeNG na versão compatível com o major do Angular, com tema via preset oficial em `providePrimeNG`, animações configuradas conforme a documentação dessa versão e tradução pt-BR global.
4. Configurar locale pt-BR (`LOCALE_ID`, `registerLocaleData`, `DEFAULT_CURRENCY_CODE = 'BRL'`).
5. Integrar o Firebase: decidir entre `@angular/fire` (se houver versão compatível) e SDK modular com providers próprios, conforme DIRETRIZES seção 6. Registrar a escolha na seção 10. A config web vai em `src/environments/` — vou colar os valores quando você pedir.
6. Criar a estrutura de pastas da seção 6 (`core`, `shared`, `features`, `models`) apenas com o necessário agora; não criar pastas vazias de features futuras.
7. Models da seção 3 em `src/app/models/` (interfaces e union types), incluindo constantes de posições (3.1), papéis e modalidades. Somente tipos e constantes, sem services de domínio.
8. Autenticação:
   - Service de auth com login Google (popup) e logout, estado exposto como signal.
   - No primeiro login, criar/atualizar `usuarios/{uid}` com `nome`, `email`, `fotoUrl`, `criadoEm` (sem escrever `adminGeral`).
   - Guard funcional de rota autenticada.
   - Tela de login simples com PrimeNG.
9. Shell/layout mobile-first: barra superior com nome do app, avatar e menu do usuário (sair); área de conteúdo; seletor de time preparado mas desabilitado/vazio (será alimentado na Fase 1). Página inicial autenticada com um placeholder "Meus times".
10. Firebase no repositório: `firebase.json` (Hosting apontando para o output do build com rewrite SPA, e Firestore), `.firebaserc` (vou informar o projectId), `firestore.rules` e `firestore.indexes.json` vazio.
11. `firestore.rules` base: negar tudo por padrão; liberar apenas `usuarios/{uid}` conforme a tabela da seção 4 (o próprio lê e escreve, sem poder alterar `adminGeral`, com validação de campos). Passar pelo skill `firebase-security-rules-auditor`.
12. Atualizar a seção "Firebase" do `CLAUDE.md` se algo diferir do descrito.

Fora do escopo: times, atletas, financeiro, agenda, mural, deploy, testes automatizados, validação no navegador.

Antes de implementar, apresente o `Plano:` com as versões que pretende instalar e a decisão sobre `@angular/fire`. Aguarde minha confirmação. Se algo em DIRETRIZES estiver ambíguo para esta fase, pergunte em vez de assumir.

Ao final, use o formato "Resultado final de cada tarefa" do `CLAUDE.md`.
