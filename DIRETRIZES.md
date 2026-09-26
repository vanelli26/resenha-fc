# DIRETRIZES — ResenhaFC

Fonte de verdade para domínio, modelo de dados, permissões, regras técnicas e roadmap. Mudança de regra de negócio ou de modelo exige atualização deste arquivo no mesmo trabalho e registro na seção 10.

---

## 1. Produto

Aplicação web (mobile-first) para gestão de times de futebol society: elenco, cobranças e caixa, agenda de jogos/eventos com presença, mural de recados, escalação e campeonatos.

Usuários acessam majoritariamente pelo celular. Idioma pt-BR, moeda BRL, fuso `America/Sao_Paulo`.

---

## 2. Domínio

### 2.1 Times

- **Piratas FC**: mensalidade mensal dos jogadores; despesa mensal de aluguel do campo.
- **Futebol Profissa**: campo próprio (sem despesa de campo); cobrança semestral dos jogadores; os benefícios de quem paga a semestralidade existem mas **não são gerenciados pelo sistema**.
- Em ambos: avulsos pagam por jogo; goleiros não pagam (modalidade `isento`).
- Cada time é independente: elenco, caixa, agenda, mural e campeonatos próprios. Não existe caixa consolidado entre times.

### 2.2 Atleta

Cadastro de uma pessoa **dentro de um time**. Pode existir sem conta no app (ex.: avulso eventual). Quando a pessoa tem conta, o atleta é vinculado ao `uid` dela.

Uma pessoa que joga nos dois times tem **um atleta em cada time**, ambos ligados ao mesmo `uid`. Posições, número de camisa e modalidade são por time.

### 2.3 Papéis

| Papel | Escopo | Pode |
|---|---|---|
| `adminGeral` | global | criar/editar times, definir diretoria e tesouraria de qualquer time, tudo que diretoria e tesouraria podem |
| `diretoria` | por time | elenco, convites, aprovar entradas, agenda, presença, escalação, mural, campeonatos |
| `tesouraria` | por time | configuração financeira, cobranças, baixas, lançamentos, relatórios do caixa |
| `jogador` | por time | ver mural, agenda, elenco e campeonatos do time; confirmar a própria presença; ver as próprias cobranças |

Uma pessoa pode acumular papéis (ex.: `["jogador", "tesouraria"]`). O caixa do time (saldo, lançamentos, relatórios) é visível apenas para `diretoria` e `tesouraria`; `jogador` nunca vê o caixa. A diretoria poderá tornar público algum valor específico (ex.: custo de um evento), mas isso é funcionalidade futura, ainda não especificada.

### 2.4 Modalidades de cobrança

| Modalidade | Referência | Geração |
|---|---|---|
| `mensal` | `AAAA-MM` (ex.: `2026-10`) | tesouraria gera as cobranças do mês |
| `semestral` | `AAAA-S1` (jan–jun) / `AAAA-S2` (jul–dez) | tesouraria gera as cobranças do semestre |
| `avulso` | `eventoId` | tesouraria gera após o evento, para avulsos com presença confirmada como `compareceu` |
| `isento` | — | nunca gera cobrança |

Quais modalidades um time aceita e seus valores ficam na configuração financeira do time (seção 3). Um time só pode atribuir a um atleta modalidades habilitadas nele.

### 2.5 Cobrança

- Status armazenado: `pendente`, `pago`, `cancelado`.
- **Atrasado é derivado** (`pendente` e `vencimento` < hoje), calculado na UI. Não é gravado.
- Valor copiado da configuração no momento da geração (mudança de preço não altera cobranças já geradas).
- ID determinístico `{atletaId}_{referencia}`: gerar duas vezes não duplica.
- Baixa (marcar como paga): na mesma escrita em lote, cobrança → `pago` + criação do lançamento de receita com ID `cob_{cobrancaId}`.
- Estorno: cobrança volta a `pendente` e o lançamento `cob_{cobrancaId}` é removido, na mesma escrita em lote.

### 2.6 Lançamentos (caixa)

- Movimentos efetivos de caixa: `receita` ou `despesa`, com categoria, descrição, valor e data.
- Receitas de cobrança são criadas apenas pela baixa (2.5), nunca manualmente.
- Despesas recorrentes (ex.: campo do Piratas) ficam na configuração do time; a tesouraria lança a do mês com um clique, ID `rec_{recorrenteId}_{AAAA-MM}` (idempotente).
- Saldo = soma de receitas − soma de despesas, via agregação no Firestore. Sem documento de saldo desnormalizado.

### 2.7 Eventos e presença

- Tipos: `jogo`, `treino`, `amistoso`, `campeonato`, `confraternizacao`, `outro`.
- Status: `agendado`, `realizado`, `cancelado`.
- Presença por atleta: `resposta` (`vou`, `nao_vou`, `talvez`) informada pelo jogador; `compareceu` marcado pela diretoria ao encerrar o evento.
- Jogo pode ter adversário, placar e vínculo com campeonato.

### 2.8 Mural

Recados por time, publicados por diretoria. Campos: título, texto, fixado, autor, data. Comentários ficam fora do MVP.

### 2.9 Escalação

Por evento: formação e posicionamento de atletas com presença `vou` (titulares e reservas). Sorteio equilibrado de times para jogos internos é fase posterior.

### 2.10 Campeonatos

Por time: nome, temporada, status. Partidas são eventos com `campeonatoId`. Estatísticas por atleta (gols, assistências, amarelos, vermelhos) lançadas pela diretoria.

### 2.11 Entrada de novos membros (convite)

1. Diretoria gera um convite do time (código aleatório, validade).
2. Pessoa abre o link, faz login e cria uma **solicitação** para aquele time.
3. Diretoria aprova: vincula a um atleta existente ou cria um novo, define modalidade, e cria o acesso com papel `jogador`.
4. Diretoria (ou adminGeral) pode acrescentar ou remover papéis depois, incluindo `diretoria` e `tesouraria`.

---

## 3. Modelo de dados (Firestore)

Tudo de um time fica sob `times/{timeId}`, porque cada time é independente e isso mantém as Security Rules simples (o acesso do usuário é lido direto por caminho).

```
usuarios/{uid}
  nome, email, fotoUrl, criadoEm
  adminGeral: bool                       // só alterável pelo console/Admin SDK

times/{timeId}                           // timeId = slug (imutável; usado na URL /t/:timeId)
  nome, slug, cor, escudo, criadoEm      // cor = paleta da lista; escudo = data URL (upload) | null (ver 6.1)
  financeiro: {
    mensal:    { ativo, valorCentavos, diaVencimento }
    semestral: { ativo, valorCentavos, diaVencimento, mesVencimentoS1, mesVencimentoS2 }
    avulso:    { ativo, valorCentavos }
    despesasRecorrentes: [{ id, descricao, categoria, valorCentavos, diaVencimento }]
  }

times/{timeId}/acessos/{uid}             // permissões do usuário no time
  uid, timeId, timeNome                  // repetidos para a consulta "Meus times" (collection group)
  nome                                   // nome da pessoa, desnormalizado para a lista de membros
  papeis: ["jogador" | "diretoria" | "tesouraria"]
  atletaId: string | null
  concedidoPor, atualizadoEm

times/{timeId}/atletas/{atletaId}
  nome, apelido, telefone?, fotoUrl?
  uid: string | null                     // conta vinculada
  modalidade: "mensal" | "semestral" | "avulso" | "isento"
  posicoes: string[]                     // ver 3.1
  numeroCamisa?, status: "ativo" | "afastado" | "inativo"
  criadoEm, atualizadoEm

times/{timeId}/convites/{codigo}         // reutilizável até expirar ou ser desativado; validade padrão 7 dias
  ativo, expiraEm, criadoPor, criadoEm
  timeNome                               // desnormalizado: quem abre o convite ainda não pode ler o time

times/{timeId}/solicitacoes/{uid}
  nome, email, status: "pendente" | "aprovada" | "recusada", convite, criadoEm

times/{timeId}/cobrancas/{atletaId_referencia}
  atletaId, atletaNome                   // nome desnormalizado para listagem
  tipo: "mensal" | "semestral" | "avulso"
  referencia, valorCentavos, vencimento (Timestamp)
  status: "pendente" | "pago" | "cancelado"
  pagoEm?, baixadoPor?, observacao?

times/{timeId}/lancamentos/{id}
  tipo: "receita" | "despesa", categoria, descricao
  valorCentavos, data (Timestamp)
  cobrancaId?, recorrenteId?, criadoPor, criadoEm

times/{timeId}/eventos/{eventoId}
  tipo, titulo, data (Timestamp), local, adversario?, placarPro?, placarContra?
  status, campeonatoId?, criadoPor

times/{timeId}/eventos/{eventoId}/presencas/{atletaId}
  resposta, compareceu?, atualizadoEm

times/{timeId}/eventos/{eventoId}/escalacao/principal
  formacao, titulares: [{ atletaId, posicao, x, y }], reservas: string[]

times/{timeId}/recados/{id}
  titulo, texto, fixado, autorUid, autorNome, criadoEm

times/{timeId}/campeonatos/{campeonatoId}
  nome, temporada, status

times/{timeId}/campeonatos/{campeonatoId}/estatisticas/{atletaId}
  gols, assistencias, amarelos, vermelhos
```

### 3.1 Posições (futebol society)

`goleiro`, `fixo`, `ala_direita`, `ala_esquerda`, `meia`, `pivo`. Lista fechada em uma constante; alteração exige decisão.

### 3.2 Convenções

- Datas: `Timestamp` do Firestore. Referências de competência: string (`2026-10`, `2026-S2`).
- Dinheiro: inteiro em centavos, campo com sufixo `Centavos`. Formatação só na UI (`currency: 'BRL'`).
- Enums: union types TypeScript + constantes; nunca strings soltas espalhadas.
- IDs determinísticos onde a operação precisa ser idempotente (cobranças, lançamentos de baixa e recorrentes).
- Desnormalizar só nome para listagem (ex.: `atletaNome`); ao renomear atleta, não é obrigatório reescrever histórico.

---

## 4. Permissões e Security Rules

- Função auxiliar `acesso(timeId)` = `get(/databases/$(database)/documents/times/$(timeId)/acessos/$(request.auth.uid))`.
- `adminGeral` lido de `usuarios/{uid}`; o próprio usuário **não** pode escrever `adminGeral`.
- Negar tudo por padrão; liberar por coleção.

| Coleção | Leitura | Escrita |
|---|---|---|
| `usuarios/{uid}` | o próprio / adminGeral | o próprio (exceto `adminGeral`) |
| `times/{timeId}` | quem tem acesso ao time | adminGeral; `financeiro` também tesouraria |
| `acessos/{uid}` | o próprio; diretoria; tesouraria | adminGeral; diretoria do time (qualquer papel) |
| `atletas` | acesso ao time | diretoria (sem exclusão: sair do elenco = status `inativo`); o jogador vinculado edita no próprio atleta só apelido, telefone, posições, camisa e `fotoUrl` (sincronizada da foto do Google ao abrir o elenco) |
| `convites` | leitura por código para usuário logado (só `get`); `list` só diretoria | diretoria cria; atualização só para desativar |
| `solicitacoes/{uid}` | o próprio; diretoria | criar: o próprio, com convite ativo e não expirado, status `pendente`; atualizar (só `status`, de `pendente` para `aprovada`/`recusada`) e excluir: diretoria |
| `cobrancas` | tesouraria/diretoria: todas; jogador: só `atletaId == acesso.atletaId` | tesouraria |
| `lancamentos` | tesouraria/diretoria | tesouraria |
| `eventos`, `recados`, `campeonatos`, `estatisticas`, `escalacao` | acesso ao time | diretoria |
| `presencas/{atletaId}` | acesso ao time | jogador: só o próprio `atletaId`, só `resposta`, só evento `agendado`; diretoria: tudo |

- Validar tipos e campos permitidos nas escritas (`keys().hasOnly(...)`), valores em centavos inteiros e ≥ 0, enums válidos.
- Toda alteração de regra passa pelo skill `firebase-security-rules-auditor` antes de concluir.
- Em todas as linhas acima, `diretoria` inclui `adminGeral` (`podeGerir()` nas rules).

---

## 5. Fluxos principais

- **Gerar cobranças** (tesouraria): escolhe modalidade e referência → sistema lista atletas ativos daquela modalidade → confirma → escrita em lote com IDs determinísticos (existentes são ignorados).
- **Cobrar avulsos** (tesouraria): a partir de evento `realizado` → atletas `avulso` com `compareceu == true` → escrita em lote.
- **Baixa / estorno**: seção 2.5.
- **Lançar despesa recorrente**: seção 2.6.
- **Encerrar evento** (diretoria): marca presença efetiva, placar, status `realizado`.
- **Meus times** (jogador): consulta collection group `acessos` com `where('uid', '==', meuUid)` (o doc de acesso guarda também o campo `uid`; regra de collection group permite ler quando `resource.data.uid == request.auth.uid`) e, por time, carrega próximas partidas e cobranças pendentes.

Lotes do Firestore têm limite de 500 operações; dividir quando necessário.

---

## 6. Regras técnicas — Angular e PrimeNG

- Standalone components, `ChangeDetectionStrategy.OnPush`, signals para estado local, `inject()` em vez de construtor.
- Controle de fluxo nativo (`@if`, `@for` com `track`, `@switch`).
- Rotas lazy por feature (`loadComponent` / `loadChildren`). Guards funcionais.
- Formulários: Signal Forms (Angular 22; ver seção 10).
- Estrutura:

```
src/app/
  core/        auth, firebase providers, guards, interceptors, contexto do time atual
  shared/      componentes/pipes genéricos, constantes, utilitários (dinheiro, datas)
  features/
    auth/  times/  elenco/  financeiro/  agenda/  mural/  escalacao/  campeonatos/  convites/
  models/      interfaces e union types do domínio (seção 3)
```

- Acesso ao Firestore só em services de `features/*/data` ou `core`; componentes não chamam o SDK diretamente.
- Um service por agregado; sem repositório genérico abstrato.
- Contexto do time selecionado em um service com signal (`timeAtual`), refletido na URL (`/t/:timeId/...`).
- Firebase: usar `@angular/fire` se houver versão compatível com o major do Angular instalado; caso contrário, SDK modular do Firebase com providers próprios em `core`. Registrar a escolha na seção 10.
- PrimeNG: tema por preset oficial via `providePrimeNG`, tradução pt-BR configurada globalmente. Não adicionar PrimeFlex, Tailwind ou outra lib de UI sem decisão. Layout com CSS próprio (flex/grid), mobile-first.
- Locale: `registerLocaleData(pt)`, `LOCALE_ID = 'pt-BR'`, `DEFAULT_CURRENCY_CODE = 'BRL'`.
- Proibido: `any`, `as` para silenciar erro, lógica de negócio em template, subscribe manual sem necessidade (preferir `toSignal`/`async`).

### 6.1 Tema e identidade visual

- Preset em `core/theme/app-theme.ts`: base Aura, superfícies `zinc`, `darkModeSelector: '.app-dark'`. Modo escuro é o padrão (os escudos dos dois times são sobre fundo preto); o usuário pode alternar no menu.
- Fora de um time: primária verde gramado (`emerald`).
- Cada time escolhe a **cor predominante** em uma lista fechada (`CORES_TIME`): paletas do PrimeUIX mais `preto` (preto e branco: primária preta no claro, branca no escuro). Paletas claras (`yellow`, `amber`, `lime`, `cyan`, `sky`) usam texto preto sobre a primária. O time guarda só o nome da cor; a paleta é montada em `app-theme.ts`.
- Troca de time chama `aplicarTemaDoTime(cor)`.
- Status financeiros fixos em qualquer cor, sempre com ícone além da cor (a cor "pendente" pode coincidir com a do time): pago `success` + check; pendente `warn` + relógio; atrasado `danger` + exclamação; isento/cancelado `secondary`.
- Escudo enviado pela diretoria/adminGeral: redimensionado no navegador (lado maior 256px, WebP; PNG onde não houver encoder WebP) e gravado como data URL no documento do time (até 120 000 caracteres). Sem Storage enquanto o plano for Spark.
- Não usar cores hexadecimais soltas em componentes; usar tokens do tema (`var(--p-primary-color)` etc.).
- Marca oficial em `public/marca/` (balão de conversa com campo, fundo verde listrado): `icone.svg`/`icone-32.png` (favicon), `apple-touch-icon.png` (180px, da versão maskable), `logo-fundo-claro.svg`/`logo-fundo-escuro.svg` (usados por `shared/logo.ts` conforme o modo; no celular estreito, só o ícone) e `fundo.svg`. Cores fixas da marca, não seguem a cor do time. Pacote completo (192/512/maskable) guardado para o manifest da Fase 5.
- Fundo do app (`styles.scss`): modo escuro usa `marca/fundo.svg`; modo claro, brilho da primária + faixas sutis de gramado.
- Celular (< 768px): navegação do time em barra fixa no rodapé com ícone e texto; navegador: abas no topo. Áreas de toque ≥ 44px e respeito às safe areas (notch/barra do iOS).

---

## 7. Firestore — consultas e índices

- Toda listagem com limite/paginação quando puder crescer (lançamentos, cobranças, recados).
- Listeners em tempo real só onde agrega valor: presença de evento aberto e mural. Resto: leitura única.
- Totais do caixa e contagens via `getAggregateFromServer` (`sum`, `count`).
- Índices compostos declarados em `firestore.indexes.json` no mesmo trabalho da consulta que os exige.

---

## 8. Ambientes e deploy

- Um projeto Firebase (produção). Desenvolvimento local pode usar o Emulator Suite (Auth + Firestore) se o usuário configurar; não é obrigatório.
- `environment.ts` com a config web do Firebase (não é segredo).

### 8.1 Publicação

`firebase deploy` (hosting, rules ou índices) **somente quando o usuário pedir explicitamente**, informando antes o que será publicado. Rules e índices podem ser publicados separadamente (`--only firestore:rules`, `--only firestore:indexes`).

---

## 9. Roadmap

- **Fase 0 — Fundação**: projeto Angular + PrimeNG + ESLint, Firebase (Auth Google, Firestore, Hosting), locale pt-BR, layout (shell com topo, menu, seletor de time), login/logout, criação de `usuarios/{uid}`, rules base.
- **Fase 1 — Times, acessos e elenco**: cadastro de times (adminGeral), acessos e papéis, atletas, convites e solicitações, tela "Meus times".
- **Fase 2 — Financeiro**: configuração financeira do time, geração de cobranças (mensal, semestral), baixa/estorno, lançamentos, despesas recorrentes, painel do caixa, visão "Minhas cobranças".
- **Fase 3 — Agenda e mural**: eventos, presença, encerramento de evento, cobrança de avulsos, mural.
- **Fase 4 — Escalação e campeonatos**: campinho com escalação por evento, campeonatos, estatísticas, artilharia.
- **Fase 5 — Evoluções** (cada item exige decisão): PWA, notificações push, comprovante de pagamento (Storage), automação agendada (Functions), sorteio equilibrado de times, comentários no mural.

---

## 10. Decisões registradas

| Data | Decisão |
|---|---|
| 26/09/2026 | Stack: Angular + PrimeNG + Firebase (Auth, Firestore, Hosting). |
| 26/09/2026 | Dois times independentes (Piratas FC, Futebol Profissa), dados sob `times/{timeId}`. |
| 26/09/2026 | Atleta por time, podendo existir sem conta; pessoa em dois times = dois atletas com o mesmo `uid`. |
| 26/09/2026 | Modalidades: mensal, semestral, avulso, isento. Goleiros como `isento`. |
| 26/09/2026 | Benefícios da semestralidade do Profissa não são gerenciados. |
| 26/09/2026 | Sem Storage e Cloud Functions no início (plano Spark). Cobranças geradas por ação da tesouraria, com IDs idempotentes. |
| 26/09/2026 | Dinheiro em centavos inteiros; status "atrasado" derivado, não gravado. |
| 26/09/2026 | Tema por time (seção 6.1): Piratas preto/branco, Profissa amarelo/preto, base verde; modo escuro padrão. |
| 26/09/2026 | Nome do app: **ResenhaFC** (genérico, vários times). Projeto Firebase `resenhafc-2f357`. Domínio de hospedagem a definir. |
| 26/09/2026 | Angular 22 + PrimeNG 22 (última versão do PrimeNG exige Angular ^22.1). PrimeNG 22 usa a PrimeUI License (não é mais MIT): usar Community License (grátis, renovação anual), chave em `providePrimeNG({ license })` via `environments`. Chave atual expira em 26/09/2027 (+30 dias de carência); renovar, trocar a chave e republicar antes disso. |
| 26/09/2026 | Firebase via SDK modular (`firebase` 12.x) com providers próprios em `core`: `@angular/fire` não tem versão compatível com Angular 22 (última estável 20.1.0, peer `@angular/core ^20`). |
| 26/09/2026 | Login apenas com Google por enquanto. Apple fica para depois (exige Apple Developer Program); `AuthService` preparado para mais provedores. |
| 26/09/2026 | Versões instaladas na Fase 0: Angular 22.2.0 (CLI 22.2.0, TypeScript 6.0, zoneless), PrimeNG 22.1.1, `@primeuix/themes` 3.0.1, `@primeicons/angular` 8 (ícones SVG como componentes), `primelocale` 2.5.0 (pt-BR), `firebase` 12.19.0, `angular-eslint` 22.5.0. Node 22 arm64. |
| 26/09/2026 | Formulários: Signal Forms (estáveis no Angular 22, recomendados pela skill oficial), no lugar de Reactive Forms tipados. |
| 26/09/2026 | Firestore fora do bundle inicial: token `FIRESTORE` em `core/firebase/firestore.token.ts`, importado só por código lazy. Budget inicial: aviso 650 kB, erro 1 MB. |
| 26/09/2026 | Diretoria concede e remove qualquer papel do próprio time (`jogador`, `diretoria`, `tesouraria`), além do adminGeral. |
| 26/09/2026 | Jogador nunca vê o caixa do time. Divulgar valores específicos (ex.: custo de evento) será funcionalidade futura da diretoria, a especificar. |
| 26/09/2026 | Última diretoria: bloqueio só na UI (Rules não contam documentos); adminGeral corrige se necessário. |
| 26/09/2026 | Convite reutilizável por várias pessoas até expirar (padrão 7 dias) ou ser desativado pela diretoria. |
| 26/09/2026 | Telefone do atleta visível a todos do time (leitura de `atletas` = acesso ao time). |
| 26/09/2026 | `timeId` = slug do time (URL legível, imutável). `acessos` guarda `nome` e `convites` guarda `timeNome` (desnormalização só de nome, 3.2). |
| 26/09/2026 | Cor do time escolhida em lista de paletas (substitui temas fixos `piratas`/`profissa`; campo `tema` removido ao salvar o time). |
| 26/09/2026 | Escudo por upload, gravado como data URL no documento do time (sem Storage/Blaze). Substitui arquivos em `public/escudos/`. |
| 26/09/2026 | Vínculo conta ↔ atleta editável em Membros (vincular existente, criar novo ou desvincular), independente do papel `jogador`. |
| 26/09/2026 | Jogador edita no próprio atleta: apelido, telefone, posições e camisa. Nome, modalidade e status continuam com a diretoria. |
| 26/09/2026 | Foto do atleta = foto do Google da conta vinculada, copiada pelo próprio jogador para `atletas.fotoUrl` (diretoria não lê `usuarios`). Visível ao time. |
| 26/09/2026 | Identidade visual: marca oficial do usuário (`public/marca/`) em logo, favicon, ícone do iPhone e fundo do modo escuro; barra inferior de navegação no celular. Manifest/PWA continua na Fase 5. Repositório público no GitHub (`vanelli26/resenha-fc`). |

---

## 11. Pendências (perguntar ao usuário antes de assumir)

1. ~~Login: apenas Google ou também e-mail/senha?~~ Resolvido: só Google por enquanto (seção 10).
2. ~~Diretoria pode conceder `tesouraria`/`diretoria`?~~ Resolvido: sim (seção 10).
3. ~~Jogador pode ver o saldo do caixa?~~ Resolvido: nunca (seção 10).
4. Avulso com conta pode ver as próprias cobranças por jogo? (padrão proposto: sim)
5. ~~Nome do app~~ ResenhaFC (seção 10). Domínio de hospedagem: a definir.
