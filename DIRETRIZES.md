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
- Esportes: cada time pratica um ou mais entre `campo`, `society` e `futsal` (o Profissa tem os três). Um time continua sendo um elenco e um caixa só; o esporte define as posições disponíveis (3.1). Definidos pelo adminGeral ou pela diretoria (Gestão › Esportes). Time sem o campo = só society.

### 2.2 Atleta

Cadastro de uma pessoa **dentro de um time**. Pode existir sem conta no app (ex.: avulso eventual). Quando a pessoa tem conta, o atleta é vinculado ao `uid` dela.

Uma pessoa que joga nos dois times tem **um atleta em cada time**, ambos ligados ao mesmo `uid`. Posições, número de camisa e modalidade são por time.

**Vínculo**: a coleção `atletas` guarda todo o cadastro do time, com `vinculo` = `atleta` (joga), `socio` ou `colaborador` (colaborador/torcedor). Ausente = `atleta`. O Elenco mostra só atletas; sócios e colaboradores ficam em Gestão › Sócios e colaboradores (diretoria). Todos podem ter conta, receber cobranças e ver Minhas cobranças; posições e camisa só para atletas. Quem não é atleta edita os próprios dados pelo aviso "Você está no time como…" no Elenco. Sócios e colaboradores entram **só por convite, com login** (como qualquer membro): o vínculo é escolhido pela diretoria ao aprovar a solicitação (ou em Membros), e depois pode ser alterado no Editar de quem tem conta. Cadastro manual sem conta (Novo atleta) é sempre `atleta`; Rules exigem `uid` para `socio`/`colaborador` na criação e quando o vínculo muda.

### 2.3 Papéis

| Papel | Escopo | Pode |
|---|---|---|
| `adminGeral` | global | criar/editar times, definir diretoria e tesouraria de qualquer time, tudo que diretoria e tesouraria podem |
| `diretoria` | por time | elenco, convites, aprovar entradas, agenda, presença, escalação, mural, campeonatos |
| `tesouraria` | por time | configuração financeira, cobranças, baixas, lançamentos, relatórios do caixa |
| `jogador` | por time | ver mural, agenda, elenco e campeonatos do time; confirmar a própria presença; ver as próprias cobranças |

Uma pessoa pode acumular papéis (ex.: `["jogador", "tesouraria"]`). O caixa do time (saldo, lançamentos, relatórios) é visível apenas para `diretoria` e `tesouraria`; `jogador` nunca vê o caixa. A diretoria poderá tornar público algum valor específico (ex.: custo de um evento), mas isso é funcionalidade futura, ainda não especificada.

### 2.4 Planos e modalidade de cobrança

A tesouraria cadastra os **planos de cobrança** do time (até 10): nome (ex.: "Atleta semestral", "Sócio semestral", "Torcedor mensal"), periodicidade e valor. Cada pessoa do cadastro (atleta, sócio ou colaborador) recebe um plano ou fica `isento`; isso é a **modalidade** dela (`atletas.modalidade` = id do plano ou `isento`). Valores diferentes para atletas, sócios e colaboradores = planos diferentes.

| Periodicidade | Referência | Geração |
|---|---|---|
| `mensal` | `AAAA-MM` (ex.: `2026-10`) | tesouraria gera as cobranças do mês |
| `semestral` | `AAAA-S1` (jan–jun) / `AAAA-S2` (jul–dez) | tesouraria gera as cobranças do semestre |
| `avulso` | `eventoId` | tesouraria gera após o evento, para quem tem plano avulso e presença `compareceu` |
| (`isento`) | — | nunca gera cobrança; sempre disponível, não é um plano |

- Vencimentos únicos por periodicidade na configuração (dia do mês; dia e mês de cada semestre); avulso vence na data do jogo.
- Um cadastro só recebe plano existente no time (Rules conferem quando a modalidade muda). Plano em uso não pode ser removido (bloqueio na UI).
- Migração do formato antigo (valores fixos `mensal`/`semestral`/`avulso`): cada modalidade ativa vira um plano com id igual ao nome (`mensal` → "Mensalidade", `semestral` → "Semestralidade", `avulso` → "Avulso"), então cadastros antigos seguem apontando para o plano certo. O app converte ao carregar e grava no formato novo na primeira alteração da configuração.

### 2.5 Cobrança

- Status armazenado: `pendente`, `pago`, `cancelado`.
- **Atrasado é derivado** (`pendente` e `vencimento` < hoje), calculado na UI. Não é gravado.
- Valor e nome do plano (`planoNome`) copiados no momento da geração (mudança de preço ou nome não altera cobranças já geradas). O `tipo` da cobrança é a periodicidade do plano.
- ID determinístico `{atletaId}_{referencia}`: gerar duas vezes não duplica.
- Baixa (marcar como paga): na mesma escrita em lote, cobrança → `pago` + criação do lançamento de receita com ID `cob_{cobrancaId}`.
- Estorno: cobrança volta a `pendente` e o lançamento `cob_{cobrancaId}` é removido, na mesma escrita em lote.
- Cancelar: `pendente` → `cancelado` (sai do "a receber"); reabrir: `cancelado` → `pendente`. Não mexem no caixa. Cobrança nunca é excluída.
- Baixa pede a data do pagamento (padrão hoje) e observação opcional (ex.: Pix); a receita entra no caixa nessa data.

### 2.6 Lançamentos (caixa)

- Movimentos efetivos de caixa: `receita` ou `despesa`, com categoria (texto livre; a UI sugere as já usadas), descrição, valor e data. Receita de baixa usa como categoria o nome do plano da cobrança (`planoNome`); cobranças antigas, sem plano, usam o tipo (Mensalidade, Semestralidade, Avulso).
- Receitas de cobrança são criadas apenas pela baixa (2.5), nunca manualmente.
- Despesas recorrentes (ex.: campo do Piratas) ficam na configuração do time; a tesouraria lança a do mês com um clique, ID `rec_{recorrenteId}_{AAAA-MM}` (idempotente).
- Saldo = soma de receitas − soma de despesas, via agregação no Firestore. Sem documento de saldo desnormalizado.

### 2.7 Eventos e presença

- Tipos: `jogo`, `treino`, `amistoso`, `campeonato`, `confraternizacao`, `outro`.
- Status: `agendado`, `realizado`, `cancelado`.
- Presença por cadastro: `resposta` (`vou`, `nao_vou`, `talvez`) informada pela própria pessoa; `compareceu` marcado pela diretoria ao encerrar o evento.
- Quem responde: cadastro `ativo`; em `jogo`, `treino`, `amistoso` e `campeonato`, só `vinculo` atleta; em `confraternizacao` e `outro`, qualquer cadastro (sócios e colaboradores inclusos). Sem limite de vagas nem prazo: responde enquanto o evento estiver `agendado`. A diretoria pode registrar a resposta de qualquer um.
- Todo evento tem `esporte` (campo, society, futsal; entre os do time).
- Jogo, amistoso e campeonato podem ter adversário e placar (opcional, informado no encerramento). Evento do tipo `campeonato` pode apontar para um campeonato do time (`campeonatoId`, opcional; 2.10).
- **Encerrar** (diretoria): placar opcional e **gols** (um por gol a favor: autor entre quem participa ou "gol contra" do adversário, assistência opcional; autor também opcional), status `realizado`, num lote. Presença inicial = quem disse "Vou" (`compareceu`). Quem não respondeu só ganha documento de presença se compareceu (fica sem `resposta`).
- Depois de realizado: "Editar encerramento" corrige placar e gols; **"Ajustar presença"** (diretoria) mostra duas listas, **Foram** e **Não foram**, e tocar numa pessoa a move de lista. Não volta a agendado nem é cancelado.
- Gols ficam em `eventos/{id}/gols/{NN}` (NN = ordem "01".."99"; regravar sobrescreve e apaga as sobras). Base da artilharia e assistências da Fase 4; gol contra conta no placar, não na artilharia.
- Transições de status: `agendado` ↔ `cancelado`; `agendado` → `realizado`.
- Evento não é excluído: a diretoria cancela (continua na agenda, riscado) ou reativa.
- Repetição semanal: na criação, "repetir toda semana por N semanas" (até 12) grava N eventos independentes no mesmo lote.
- **Chamar o time**: no evento agendado, qualquer membro envia pelo WhatsApp (link `wa.me` com mensagem pronta: título, data/hora, local e link do evento) ou copia a mensagem. O link abre o evento; quem não está logado faz login e volta a ele (authGuard guarda a URL). Só membros do time acessam.
- Agenda: próximos a partir do início do dia de hoje (até 30); anteriores em páginas de 20. Presenças do evento aberto em tempo real (listener); na lista, uma leitura da própria resposta por evento. "Meus times" mostra o próximo evento agendado de cada time (índice `status + data`).

### 2.8 Mural

Feed de **postagens** por time (coleção `recados`), estilo Instagram: 1 a 4 fotos e legenda (texto simples, até 2000 caracteres, com quebras de linha). Aba **Mural** é a primeira do time e a tela inicial ao abri-lo. Posts antigos (só texto, com título) continuam válidos.

- **Quem faz o quê**: qualquer membro publica; o autor edita a legenda e exclui o próprio post (as fotos saem junto); a diretoria fixa no topo e exclui qualquer post.
- **Feed**: tempo real (listener), fixados primeiro e depois os mais novos (índice `fixado desc + criadoEm desc`), de 10 em 10 ("Ver mais" aumenta o limite do listener). Carrossel com rolagem lateral e proporção da 1ª foto entre 1:1 e 1.91:1 (retrato cortado no centro), altura máxima de 55% da tela; tocar abre a foto inteira.
- **Fotos**: reduzidas no aparelho (lado maior 1600px, WebP; JPEG onde não houver encoder) e enviadas ao Storage em `times/{timeId}/recados/{postId}/{0-3}.webp|jpeg`, com metadado `autorUid`. O post guarda URL de download, caminho, largura e altura. Se gravar o post falhar, as fotos enviadas são apagadas.
- **Curtidas**: qualquer membro; documento `curtidas/{uid}` no post + contador `qtdCurtidas` no próprio post (atualiza em tempo real no feed). Rules: o contador nunca vem na criação do post e só muda ±1 no mesmo lote em que a curtida da própria pessoa nasce ou some.
- **Comentários**: qualquer membro, até 500 caracteres, sem edição; excluem o autor do comentário, o autor do post ou a diretoria. Abrem num diálogo em tempo real (até 200, mais antigos primeiro). O número de comentários de cada post é contado no servidor (`count`) ao carregar o feed, sem contador no post (um contador de comentários não é verificável com segurança nas Rules).
- **Excluir post** apaga também curtidas e comentários (mesmo lote; Rules liberam apagar filhos de post que deixa de existir no lote).
- **Storage Rules**: envio só por membro do time, imagem webp/jpeg < 5 MB, sem sobrescrever; leitura pelo SDK só membros; exclusão pelo autor (metadado) ou diretoria. As URLs de download têm token: quem tiver o link vê a foto (não indexado, não adivinhável).
- **Apoiadores/patrocinadores**: faixa no topo do mural (logos em fila, rolagem lateral; tocar abre o link). Cadastro pela diretoria em Gestão › Apoiadores: nome, logo (data URL reduzido; até 80 000 caracteres), link https opcional (site, Instagram, wa.me) e ordem (setas sobe/desce). Até 20 por time.

### 2.9 Escalação

Por evento esportivo (não em confraternização/outro; não em cancelado), tela própria `/t/:timeId/agenda/:eventoId/escalacao`, com atalho "⚽ Escalação" no evento. Todos do time veem; a diretoria monta.

- **Formação** da lista fechada do esporte do evento (goleiro implícito): futsal `2-2`, `1-2-1`, `3-1`; society `2-3-1`, `3-2-1`, `2-2-2`; campo `4-4-2`, `4-3-3`, `3-5-2`, `4-2-3-1`, `5-3-2`. Alteração exige decisão (constante `FORMACOES_POR_ESPORTE` e Rules).
- **Campinho** com as vagas (goleiro, defesa, meio, ataque). A diretoria toca numa vaga e escolhe quem joga: primeiro quem vai, depois talvez, depois o resto do elenco; escolher quem já está em outra vaga troca os dois de lugar. Trocar de formação mantém quem cabe pelo número da vaga.
- **Reservas** não são gravadas: quem disse Vou (evento realizado: quem compareceu) e não está no campinho.
- "Enviar" (WhatsApp) ou copiar a escalação em texto para o grupo. "Limpar" apaga a escalação.
- Leitura: evento, elenco, presenças (leitura única, sem listener) e a escalação. Sorteio equilibrado de times para jogos internos é fase posterior.

### 2.10 Estatísticas e campeonatos

**Artilharia e assistências** (Elenco › Artilharia, `/t/:timeId/elenco/artilharia`, visível a todos do time):
- **Automático**: soma dos gols lançados ao encerrar os eventos `realizado` do ano (2.7). Gol contra conta no placar, não na artilharia. Leitura: 1 consulta dos eventos realizados no ano (índice `status + data`) + 1 leitura da subcoleção `gols` de cada evento, a cada abertura da tela.
- **Ajuste manual** (diretoria): toca num atleta (ou "Lançar números") e digita o **total** de gols e assistências no ano, ex.: jogos de antes do app. Grava só a diferença sobre o automático em `ajustesEstatistica` (inteiro de −999 a 999); exibido = automático + ajuste, nunca negativo, com a marca "ajustado". "Usar automático" zera o ajuste (sem exclusão).
- Ranking por gols ou por assistências, navegação por ano (‹ 2026 ›, `?ano=AAAA`); empate divide a posição.
- Cartões (amarelo/vermelho) fora por enquanto (decisão de 27/09/2026).

**Campeonatos** (Agenda › Campeonatos, `/t/:timeId/agenda/campeonatos`, visível a todos do time):
- Cadastro pela diretoria: nome, temporada (texto livre: "2026", "2026/2") e situação (`andamento`, `encerrado`). Sem exclusão (eventos apontam para ele); encerra-se pela situação.
- Partidas: eventos do tipo `campeonato` com `campeonatoId`, escolhido no formulário do evento (lista os em andamento + o atual do evento). O evento mostra o nome do campeonato com link.
- Tela do campeonato: **campanha** (jogos, vitórias, empates, derrotas, gols pró:contra e saldo, a partir do placar dos jogos realizados; jogos sem placar ficam fora e são avisados), **artilharia própria** (mesmo modelo: automático dos gols dos jogos + ajuste com escopo `c-{campeonatoId}`) e **jogos** (próximos primeiro, depois os anteriores).
- Leitura: 1 consulta do campeonato, 1 dos jogos (índice `campeonatoId + data`, até 100), o elenco, os ajustes e 1 leitura de gols por jogo realizado.

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
  nome, slug, cor, escudo, criadoEm      // cor = paleta da lista; escudo = URL do Storage | data URL antigo | null (ver 6.1)
  esportes?: ("campo" | "society" | "futsal")[]   // ausente = ["society"]
  financeiro: {
    planos: [{ id, nome, periodicidade: "mensal" | "semestral" | "avulso", valorCentavos }]   // até 10
    vencimentos: { diaMensal, diaSemestral, mesS1, mesS2 }
    despesasRecorrentes: [{ id, descricao, categoria, valorCentavos, diaVencimento }]
  }                                      // formato antigo {mensal, semestral, avulso, ...} ainda lido (2.4)

times/{timeId}/acessos/{uid}             // permissões do usuário no time
  uid, timeId, timeNome                  // repetidos para a consulta "Meus times" (collection group)
  nome                                   // nome da pessoa, desnormalizado para a lista de membros
  papeis: ["jogador" | "diretoria" | "tesouraria"]
  atletaId: string | null
  concedidoPor, atualizadoEm

times/{timeId}/atletas/{atletaId}
  nome, apelido, telefone?, fotoUrl?
  uid: string | null                     // conta vinculada
  modalidade: string                     // id de um plano do time ou "isento" (2.4)
  posicoes: { campo?: [], society?: [], futsal?: [] }   // por esporte, ver 3.1
  numeroCamisa?, status: "ativo" | "afastado" | "inativo"
  vinculo?: "atleta" | "socio" | "colaborador"   // ausente = atleta (2.2)
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
  planoNome?                             // nome do plano na geração (ausente nas antigas)
  status: "pendente" | "pago" | "cancelado"
  pagoEm?, baixadoPor?, observacao?

times/{timeId}/lancamentos/{id}
  tipo: "receita" | "despesa", categoria, descricao
  valorCentavos, data (Timestamp)
  cobrancaId?, recorrenteId?, criadoPor, criadoEm

times/{timeId}/eventos/{eventoId}
  tipo, titulo, data (Timestamp), local, esporte, adversario?, placarPro?, placarContra?
  status, campeonatoId? (só tipo campeonato), criadoPor, criadoEm

times/{timeId}/eventos/{eventoId}/presencas/{atletaId}
  resposta?, compareceu?, atualizadoEm   // resposta ausente = marcado pela diretoria sem ter respondido

times/{timeId}/eventos/{eventoId}/gols/{NN}   // NN = "01".."99" (ordem)
  autorId: string | null                 // null = gol contra do adversário
  assistenciaId?, atualizadoEm

times/{timeId}/eventos/{eventoId}/escalacao/principal
  formacao                               // da lista do esporte do evento (2.9)
  titulares: [{ atletaId, vaga }]        // até 11; vaga 0 = goleiro, depois da defesa ao ataque
  atualizadoPor, atualizadoEm

times/{timeId}/recados/{id}              // postagem do mural
  texto, fotos?: [{ url, caminho, largura, altura }] (1..4), titulo? (antigos)
  fixado, autorUid, autorNome, autorFotoUrl?, criadoEm, qtdCurtidas?

times/{timeId}/recados/{id}/curtidas/{uid}          // existir = curtiu
  criadoEm

times/{timeId}/recados/{id}/comentarios/{id}
  texto, autorUid, autorNome, autorFotoUrl?, criadoEm

times/{timeId}/patrocinadores/{id}
  nome, logo (data URL | null), link?, ordem, criadoEm

times/{timeId}/ajustesEstatistica/{escopo}_{atletaId}   // correção manual da artilharia (2.10)
  atletaId, escopo                       // escopo = ano "AAAA" ou campeonato "c-{campeonatoId}"
  gols, assistencias                     // diferença sobre o automático, −999..999
  atualizadoPor, atualizadoEm

times/{timeId}/campeonatos/{campeonatoId}
  nome, temporada, status: "andamento" | "encerrado", criadoEm
```

### 3.1 Posições por esporte

Listas fechadas em constantes (`models/posicao.model.ts`); alteração exige decisão.

- **Society**: `goleiro`, `fixo`, `ala_direita`, `ala_esquerda`, `meia`, `pivo`.
- **Campo**: `goleiro`, `zagueiro`, `lateral_direito`, `lateral_esquerdo`, `volante`, `meia`, `meia_atacante`, `ponta_direita`, `ponta_esquerda`, `centroavante`.
- **Futsal**: `goleiro`, `fixo`, `ala_direita`, `ala_esquerda`, `pivo`.

O atleta guarda as posições por esporte. Atletas antigos têm uma lista simples, lida como society (Rules aceitam os dois formatos); ao salvar, passam ao formato novo. O formulário mostra os esportes do time mais os que o atleta já tem posição (desligar um esporte não apaga dado).

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
| `times/{timeId}` | quem tem acesso ao time | adminGeral (nome, cor, escudo, esportes); diretoria: só `esportes`; tesouraria/adminGeral: só `financeiro`, validado |
| `acessos/{uid}` | o próprio; diretoria; tesouraria | adminGeral; diretoria do time (qualquer papel) |
| `atletas` | acesso ao time | diretoria (sem exclusão: sair do elenco = status `inativo`); o jogador vinculado edita no próprio atleta só nome, apelido, telefone, posições, camisa e `fotoUrl` (modalidade, status e `vinculo` só a diretoria) (sincronizada da foto do Google ao abrir o elenco) |
| `convites` | leitura por código para usuário logado (só `get`); `list` só diretoria | diretoria cria; atualização só para desativar |
| `solicitacoes/{uid}` | o próprio; diretoria | criar: o próprio, com convite ativo e não expirado, status `pendente`; atualizar (só `status`, de `pendente` para `aprovada`/`recusada`) e excluir: diretoria |
| `cobrancas` | tesouraria/diretoria: todas; jogador: só `atletaId == acesso.atletaId` | tesouraria: cria só `pendente`; depois só transições de status (baixa, estorno, cancelar, reabrir); nunca exclui |
| `lancamentos` | tesouraria/diretoria | tesouraria; `cob_*` só junto com a baixa/estorno da cobrança e não editável |
| `eventos` | acesso ao time | diretoria (`campeonatoId` só no tipo campeonato e de campeonato existente) |
| `eventos/{id}/escalacao/principal` | acesso ao time | diretoria; formação da lista do esporte do evento, até 11 titulares, fora de confraternização/outro; pode apagar |
| `campeonatos` | acesso ao time | diretoria; sem exclusão |
| `ajustesEstatistica` | acesso ao time | diretoria (id = `{escopo}_{atletaId}`, atleta existente, escopo ano ou campeonato existente, valores −999..999); sem exclusão |
| `recados` | acesso ao time | qualquer membro cria (autor = ele, sem fixar); autor edita só `texto`; diretoria só `fixado`; qualquer membro muda `qtdCurtidas` ±1 junto com a própria curtida; exclui autor ou diretoria |
| `recados/{id}/curtidas/{uid}` | acesso ao time | a própria pessoa, junto com o contador do post |
| `recados/{id}/comentarios` | acesso ao time | qualquer membro cria (autor = ele); sem edição; exclui autor, autor do post ou diretoria |
| `eventos/{id}/gols` | acesso ao time | diretoria, só com o evento `realizado` |
| `patrocinadores` | acesso ao time | diretoria |
| `presencas/{atletaId}` | acesso ao time | a própria pessoa: só o próprio `atletaId` (vínculo nos dois lados), só `resposta` (nunca `compareceu`), cadastro ativo, evento `agendado` e elegível pelo tipo (2.7); diretoria: qualquer um, inclusive `compareceu`; sem exclusão |

- Validar tipos e campos permitidos nas escritas (`keys().hasOnly(...)`), valores em centavos inteiros e ≥ 0, enums válidos.
- Toda alteração de regra passa pelo skill `firebase-security-rules-auditor` antes de concluir.
- Em todas as linhas acima, `diretoria` e `tesouraria` incluem `adminGeral` (`podeGerir()` e `podeFinanceiro()` nas rules).
- Atleta só recebe modalidade habilitada no time (rules conferem na criação e quando a modalidade muda).

---

## 5. Fluxos principais

- **Gerar cobranças** (tesouraria): escolhe a periodicidade (mensal/semestral) e a referência → sistema lista os cadastros ativos cujo plano tem essa periodicidade, cada um com o valor do próprio plano → confirma → escrita em lote com IDs determinísticos (existentes são ignorados).
- **Cobrar avulsos** (tesouraria): no evento `realizado` (ou pelo atalho em Gerar cobranças) → quem compareceu e tem plano `avulso` → escrita em lote (2.4).
- **Baixa / estorno**: seção 2.5.
- **Lançar despesa recorrente**: seção 2.6.
- **Encerrar evento** (diretoria): placar e gols, status `realizado`; presença inicial = quem disse Vou, ajustada depois (2.7).
- **Meus times** (jogador): consulta collection group `acessos` com `where('uid', '==', meuUid)` (o doc de acesso guarda também o campo `uid`; regra de collection group permite ler quando `resource.data.uid == request.auth.uid`) e, por time, conta as cobranças pendentes do meu atleta e mostra o próximo evento agendado.

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
  features/    uma pasta por área; `data/` guarda os services do Firestore/Storage da área
    agenda/ auth/ campeonatos/ convites/ elenco/ escalacao/ financeiro/ gestao/ inicio/ membros/ mural/
    estatisticas/ patrocinadores/ solicitacoes/ time/ (layout e rotas do time) times/ (admin)
  models/      interfaces e union types do domínio (seção 3)
```

- Acesso ao Firestore só em services de `features/*/data` ou `core`; componentes não chamam o SDK diretamente.
- Um service por agregado; sem repositório genérico abstrato.
- Contexto do time selecionado em um service com signal (`timeAtual`), refletido na URL (`/t/:timeId/...`).
- Firebase: SDK modular com providers próprios em `core/firebase` (sem `@angular/fire`; ver seção 10).
- PrimeNG: tema por preset oficial via `providePrimeNG`, tradução pt-BR configurada globalmente. Não adicionar PrimeFlex, Tailwind ou outra lib de UI sem decisão. Layout com CSS próprio (flex/grid), mobile-first.
- Locale: `registerLocaleData(pt)`, `LOCALE_ID = 'pt-BR'`, `DEFAULT_CURRENCY_CODE = 'BRL'`.
- Proibido: `any`, `as` para silenciar erro, lógica de negócio em template, subscribe manual sem necessidade (preferir `toSignal`/`async`).

### 6.1 Tema e identidade visual

- Preset em `core/theme/app-theme.ts`: base Aura, superfícies `zinc`, `darkModeSelector: '.app-dark'`. Modo escuro é o padrão (os escudos dos dois times são sobre fundo preto); o usuário pode alternar no menu.
- Fora de um time: primária verde gramado (`emerald`).
- Cada time escolhe a **cor predominante** em uma lista fechada (`CORES_TIME`): paletas do PrimeUIX mais `preto` (preto e branco: primária preta no claro, branca no escuro). Paletas claras (`yellow`, `amber`, `lime`, `cyan`, `sky`) usam texto preto sobre a primária. O time guarda só o nome da cor; a paleta é montada em `app-theme.ts`.
- Troca de time chama `aplicarTemaDoTime(cor)`.
- Status financeiros fixos em qualquer cor, sempre com ícone além da cor (a cor "pendente" pode coincidir com a do time): pago `success` + check; pendente `warn` + relógio; atrasado `danger` + exclamação; isento/cancelado `secondary`.
- Escudo enviado pelo adminGeral: redimensionado no navegador (lado maior 512px, WebP; PNG onde não houver encoder WebP, mantendo transparência) e enviado ao Storage em `times/{timeId}/escudo/{data-hora}.ext`; o time guarda a URL de download. Trocar ou remover apaga o arquivo anterior. Escudos antigos em data URL continuam válidos até serem trocados.
- Não usar cores hexadecimais soltas em componentes; usar tokens do tema (`var(--p-primary-color)` etc.).
- Marca oficial em `public/marca/` (balão de conversa com campo, fundo verde listrado): `icone.svg`/`icone-32.png` (favicon), `apple-touch-icon.png` (180px, da versão maskable), `logo-fundo-claro.svg`/`logo-fundo-escuro.svg` (usados por `shared/logo.ts` conforme o modo; no celular estreito, só o ícone) e `fundo.svg`. Cores fixas da marca, não seguem a cor do time. Ícones do app instalado (`icone-192.png`, `icone-512.png`, `icone-maskable-512.png`) gerados do `icone.svg` (maskable: fundo sem cantos e desenho a 80%, na área segura).
- Fundo do app (`styles.scss`): modo escuro usa `marca/fundo.svg`; modo claro, brilho da primária + faixas sutis de gramado.
- Celular (< 768px): navegação do time em barra fixa no rodapé com ícone e texto; navegador: abas no topo. Áreas de toque ≥ 44px e respeito às safe areas (notch/barra do iOS).

---

### 6.2 Padrões de código

Seguir o que já existe antes de criar algo novo. Exemplos de referência entre parênteses.

**Tela (page)** — `features/<area>/<nome>-page.ts|html|scss`, rota lazy em `time.routes.ts`.
- Estado em signals; derivados em `computed`; valor editável que reinicia com a entrada em `linkedSignal`.
- **Carregar por time**: um `effect` lê `timeAtual.timeId()` (e outros parâmetros), limpa o estado e chama `carregar()` dentro de `untracked` (a tela é reaproveitada ao trocar de time). Ao receber a resposta, **descartar resposta atrasada**: só aplicar se `timeAtual.timeId()` (e o parâmetro) ainda for o mesmo (`caixa-page`, `convites-page`).
- Listener (`onSnapshot`) só onde a seção 7 permite; guardar a função de parar e chamá-la ao trocar de time e no `DestroyRef` (`mural-page`, `evento-page`).
- Estados visuais: `p-skeleton` carregando; texto `.texto-suave` para vazio ("Ninguém.", "Nenhum…"); erro em aviso.

**Avisos e confirmação** (`shared/avisos.ts`) — nunca usar `MessageService` direto.
- `Avisos.sucesso/info/atencao/erro`. Erro sempre com `erro('Não foi possível …', e)` (o detalhe vem de `mensagemDeErro`).
- Escrita disparada pelo usuário: `await avisos.executar(this.processando, () => service.x(...), 'Feito', 'Não foi possível salvar')`, que liga o indicador, avisa e retorna `true/false`; depois do `true`, a tela fecha diálogo e recarrega.
- Confirmação: `this.confirmacao.confirm(confirmacaoPadrao({ titulo, mensagem, rotulo, aoConfirmar }))`, com `ConfirmationService` e `<p-confirmdialog>` na própria tela. `perigosa: false` para ação não destrutiva.
- Falha em complemento não essencial (ex.: contagens do feed) pode ser silenciosa, com comentário explicando.

**Componentes** — standalone, OnPush, `input()`/`output()`; template/estilos inline quando curtos (< ~60 linhas), arquivos separados quando maiores.
- Componente de apresentação não injeta services de dados; recebe dados por input e emite eventos (`lista-pessoas`, `lista-presenca`, `ajuste-presenca`, `seletor-presenca`). Exceção: ações autocontidas que só avisam (`chamar-time`).
- Formulário em diálogo: componente próprio com `salvar`/`cancelar` como outputs, Signal Forms dentro dele; a tela grava (`atleta-form`, `evento-form`, `encerrar-evento`). Formulário denso usa `shared/formulario-compacto.scss`.
- Lógica pura reaproveitável fica em função exportada ao lado do componente ou em `shared/` (`gruposDePresenca`, `situacaoDaCobranca`, `shared/competencia.ts`).
- Dividir uma tela quando ela mistura modos ou passa de ~300 linhas.

**Services** (`features/<area>/data/*.service.ts`, `providedIn: 'root'`) — um por agregado; únicos que importam o SDK do Firebase.
- Recebem `timeId` por parâmetro, retornam `ComId<T>` via `conversor<T>()`. Escritas compostas em `writeBatch` (limite 500).
- Constantes de limite das Rules exportadas pelo service ou model (`MAX_PLANOS`, `MAX_FOTOS_POST`).
- Exceção documentada: `ConfigFinanceiraService.atualizar` usa o time atual e atualiza o contexto após gravar.

**Modelos e rótulos** — tipos e listas fechadas em `models/` (union type + constante); textos de exibição em `shared/rotulos.ts` (`ROTULO_*`). Nunca string solta de enum no template.

**Estilos** — CSS próprio, mobile-first, só tokens do tema. Classes globais em `styles.scss`: `.cartao`, `.cartao-link` (+ `__seta`), `.selo-alerta`, `.formulario`, `.campo` (+ `__dica`, `__erro`), `.acoes`, `.lista`, `.texto-suave`, `.dica`, `.cabecalho-secao`, `.visualmente-oculto`. Classes locais em BEM (`bloco__elemento--modificador`). Sem `::ng-deep`; para estilizar componente PrimeNG, usar inputs dele (`inputStyle`, `styleClass`).

**Utilitários de `shared/`** — `dinheiro` (centavos ↔ reais, `ReaisPipe`), `competencia` (referências e períodos: mês, semestre, ano), `imagem` (redução de fotos), `compartilhar` (WhatsApp, copiar), `rotulos`, `erros`, `avisos`; componentes `voltar`, `foto-pessoa`, `escudo`, `logo`, `abas-secao` (abas internas por rota: Financeiro, Elenco, Agenda). Ranking de artilharia reutilizável em `estatisticas/ranking-artilharia` (ano e campeonato). Navegação ‹ período › em `financeiro/navegador-periodo` (mês, semestre ou ano).

**Nomes** — domínio e código em pt-BR (classes, métodos, signals); sufixos só para tipo de arquivo (`-page`, `.service`, `.model`, `.routes`). Signals booleanos como estado (`carregando`, `salvando`, `processando`), ações como verbos (`salvar`, `excluir`).

### 6.3 PWA (app instalável)

- `public/manifest.webmanifest`: nome ResenhaFC, `display: standalone`, `start_url` e `scope` `/`, fundo e tema `#09090b`, pt-BR, ícones da marca (6.1). `index.html` liga o manifest e as metas do iPhone (tela cheia, barra de status translúcida; o layout respeita as safe areas).
- Service worker oficial do Angular (`@angular/service-worker`, `ngsw-config.json`), só no build de produção, registrado quando o app estabiliza. Guarda os arquivos do app no aparelho (grupo `app` em prefetch: index, JS, CSS, manifest; grupo `marca` sob demanda). **Sem cache de dados**: Firestore e Storage continuam online pelo SDK. Rotas com `__` (ex.: `/__/auth/…` do login Google) ficam fora da navegação do service worker.
- Versão nova: baixada em segundo plano; o shell mostra "Nova versão do ResenhaFC disponível · Atualizar" (`core/pwa/atualizacao-app.service.ts`). Confere de novo ao voltar para o app (no máximo a cada 5 min). Cache quebrado no aparelho → recarrega.
- "Instalar app" no menu do usuário (`core/pwa/instalacao-app.service.ts`): no Chrome/Android usa o pedido nativo (`beforeinstallprompt`); no iPhone mostra as instruções (Compartilhar › Adicionar à Tela de Início). Some quando o app já está aberto instalado.
- Hosting: JS/CSS com hash ficam em cache por 1 ano; `ngsw-worker.js`, `safety-worker.js`, `worker-basic.min.js`, `ngsw.json`, `manifest.webmanifest` e `index.html` sempre revalidam (`no-cache`), senão a atualização não chega. Para desligar o service worker em produção, publicar com o `safety-worker.js` no lugar do `ngsw-worker.js` (procedimento oficial do Angular).

## 7. Firestore — consultas e índices

- Toda listagem com limite/paginação quando puder crescer (lançamentos, cobranças, recados).
- Listeners em tempo real só onde agrega valor: presença de evento aberto, feed do mural e comentários abertos. Resto: leitura única.
- Totais do caixa e contagens via `getAggregateFromServer` (`sum`, `count`).
- Índices compostos declarados em `firestore.indexes.json` no mesmo trabalho da consulta que os exige.

---

## 8. Ambientes e deploy

- Um projeto Firebase (produção). Desenvolvimento local pode usar o Emulator Suite (Auth + Firestore) se o usuário configurar; não é obrigatório.
- `environment.ts` com a config web do Firebase (não é segredo).

### 8.1 Publicação

`firebase deploy` (hosting, rules ou índices) **somente quando o usuário pedir explicitamente**, informando antes o que será publicado. Rules e índices podem ser publicados separadamente (`--only firestore:rules`, `--only firestore:indexes`, `--only storage`).

---

## 9. Roadmap

- **Fase 0 — Fundação**: projeto Angular + PrimeNG + ESLint, Firebase (Auth Google, Firestore, Hosting), locale pt-BR, layout (shell com topo, menu, seletor de time), login/logout, criação de `usuarios/{uid}`, rules base.
- **Fase 1 — Times, acessos e elenco**: cadastro de times (adminGeral), acessos e papéis, atletas, convites e solicitações, tela "Meus times".
- **Fase 2 — Financeiro**: configuração financeira do time, geração de cobranças (mensal, semestral), baixa/estorno, lançamentos, despesas recorrentes, painel do caixa, visão "Minhas cobranças".
- **Fase 3 — Agenda e mural**: eventos, presença, encerramento de evento, cobrança de avulsos, mural.
- **Fase 4 — Estatísticas, campeonatos e escalação**: 4a artilharia e assistências (automático + ajuste); 4b campeonatos; 4c campinho com escalação por evento (formação por esporte + vagas).
- **Fase 5 — Evoluções** (cada item exige decisão): PWA (feito, 6.3), notificações push, comprovante de pagamento (Storage já disponível), automação agendada (Functions), sorteio equilibrado de times.

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
| 26/09/2026 | Jogador edita no próprio atleta: apelido, telefone, posições e camisa. Nome, modalidade e status continuam com a diretoria. (Substituída abaixo: nome passou ao jogador.) |
| 26/09/2026 | Foto do atleta = foto do Google da conta vinculada, copiada pelo próprio jogador para `atletas.fotoUrl` (diretoria não lê `usuarios`). Visível ao time. |
| 26/09/2026 | Identidade visual: marca oficial do usuário (`public/marca/`) em logo, favicon, ícone do iPhone e fundo do modo escuro; barra inferior de navegação no celular. Manifest/PWA continua na Fase 5. Repositório público no GitHub (`vanelli26/resenha-fc`). |
| 26/09/2026 | "Remover do time" (Membros) apaga o acesso, desvincula a conta e marca o atleta como `inativo`. Elenco mostra só ativos/afastados; inativos ficam ocultos, e só a diretoria pode exibi-los (reativar pelo Editar). |
| 26/09/2026 | Fase 2: jogador vê todas as próprias cobranças, inclusive avulso (pendência 11.4). Só tesouraria (e adminGeral) escreve no financeiro; diretoria consulta caixa e cobranças. |
| 26/09/2026 | Categoria de lançamento em texto livre (com sugestões das já usadas), não lista fixa. |
| 26/09/2026 | Navegação do time: Elenco · Financeiro · Gestão (mais Agenda e Mural nas próximas fases). Gestão reúne Membros, Convites, Solicitações e Configuração financeira em `/t/:timeId/gestao/*`; endereços antigos redirecionam. |
| 26/09/2026 | Despesas recorrentes limitadas a 10 por time (Rules validam item a item, sem laço). Cobrança avulsa depende de eventos (Fase 3). |
| 26/09/2026 | Financeiro navega por período (barra ‹ período ›, `?periodo=AAAA-MM` ou `AAAA-S1/S2` na URL): por mês se o time tem mensal (ou nenhuma), por semestre se tem semestral; com as duas, o usuário escolhe. Cobranças do período = vencimento dentro dele; visão "Em aberto" lista todas as pendentes. O caixa (2b) usa a mesma barra, por mês. |
| 26/09/2026 | Caixa: saldo geral via `sum` no servidor (receitas − despesas); totais do mês somados na tela a partir da lista do mês (já carregada e limitada a 500), sem consultas de agregação extras. Lançamento de baixa (`cob_`) não é editável nem excluível no caixa. Despesas recorrentes cadastradas na Configuração financeira e lançadas no Caixa, mês a mês. |
| 26/09/2026 | Minhas cobranças (`/t/:timeId/financeiro/minhas`): qualquer membro com atleta vinculado vê só as próprias (consulta por `atletaId`, índice composto `atletaId + vencimento`), em aberto primeiro e histórico. Jogador vê a aba Financeiro só com essa tela; quem gere e joga vê a aba "Minhas". "Meus times" mostra selo de pendentes por time (`count` no servidor, índice `atletaId + status`). |
| 26/09/2026 | Jogador vinculado (após aprovação do convite) edita no próprio atleta também o **nome**. Modalidade de cobrança e status continuam só com a diretoria. Cobranças antigas mantêm o `atletaNome` da geração (3.2). |
| 26/09/2026 | Esportes por time (`campo`, `society`, `futsal`), editáveis por adminGeral e diretoria; um time segue com elenco e caixa únicos. Posições do atleta por esporte (3.1), com as listas de campo e futsal aprovadas pelo usuário. |
| 26/09/2026 | Próximas entregas aprovadas: vínculo no cadastro de atletas (`atleta`, `socio`, `colaborador`; Elenco mostra só atletas) e planos de cobrança configuráveis (nome, periodicidade, valor) no lugar dos valores fixos por modalidade; receita da baixa com categoria = nome do plano. |
| 26/09/2026 | Vínculo no cadastro (`atletas.vinculo`: atleta, sócio, colaborador/torcedor), sem coleção nova: cobranças, convite e Minhas cobranças valem para todos. Elenco lista só atletas (filtro na tela: a coleção é pequena e cadastros antigos não têm o campo); Gestão › Sócios e colaboradores lista os demais (só edição: entram por convite, com login). |
| 27/09/2026 | Planos de cobrança (2.4) substituem os valores fixos por modalidade: até 10 por time, validados item a item nas Rules; vencimentos únicos por periodicidade. `atletas.modalidade` passa a ser id de plano ou `isento` (planos migrados mantêm os ids `mensal`/`semestral`/`avulso`, sem regravar cadastros). Cobrança guarda `planoNome`, usado como categoria da receita na baixa. Toda gravação da configuração financeira grava o objeto inteiro (converte times antigos). |
| 27/09/2026 | Fase 3a (Agenda): aba Agenda (depois substituída pelo Mural como primeira, ver abaixo). Evento ganha `esporte` e `criadoEm`; não é excluído (cancelar/reativar). Presença: esportivos só atletas, confraternização/outro todos; sem limite de vagas nem prazo. Repetição semanal cria N eventos independentes (até 12). Entregas da Fase 3: 3a agenda e presença, 3b encerramento e cobrança de avulsos, 3c mural. |
| 27/09/2026 | Fase 3b: encerramento pela diretoria (compareceu + placar opcional, status `realizado`, corrigível depois). Cobrança de avulsos pela tesouraria no próprio evento realizado: quem compareceu e tem plano avulso, valor do plano, vencimento na data do jogo, referência = `eventoId` (idempotente). Rules de cobrança não conferem o evento (tesouraria é confiável, como nas mensais; evita um `get` por cobrança no lote). Cobrança avulsa aparece como "Avulso · jogo de dd/MM". Atalho em Financeiro › Gerar cobranças ("Avulsos por jogo": últimos 10 eventos realizados, índice `status + data desc`). |
| 27/09/2026 | Fase 3c (Mural): aba Mural para todos; diretoria publica, edita e exclui recados (exclusão liberada: recado não tem efeito financeiro nem histórico). Tempo real, fixados no topo, limite de 50. `autorNome` = nome do membro no time (acesso) ou da conta. Sem aviso de "não lido" (exigiria estado por usuário). |
| 27/09/2026 | Mural passa a ser a primeira aba e a tela inicial do time (antes: Agenda). Evento agendado ganha "Chamar o time": mensagem pronta para o WhatsApp (ou copiar) com link direto para confirmar presença; sem link público: só membros logados respondem. |
| 27/09/2026 | Encerrar pede só placar e gols (autor + assistência opcional, "gol contra" do adversário); presença inicial = quem disse Vou, ajustada depois no evento encerrado ("Ajustar presença": listas Foram / Não foram). Gols em subcoleção `gols` do evento (um documento por gol, validado nas Rules), base da artilharia da Fase 4. |
| 27/09/2026 | Projeto migrado para o plano **Blaze** pelo usuário. Mural evolui em 3 entregas: M3 apoiadores (faixa no topo, logo em data URL, sem Storage) — feita primeiro; M1 postagens com 1 a 4 fotos no **Storage** (`times/{timeId}/recados/{postId}/`), todos os membros publicam, autor edita/exclui o próprio, diretoria fixa e exclui qualquer; M2 curtidas (subcoleção por uid + contador validado nas Rules) e comentários (subcoleção; exclui o autor ou a diretoria; sem edição). Comentários saem de "fora do MVP". |
| 27/09/2026 | M1 do mural: Storage em uso (`storage.rules`, token lazy `STORAGE`). Postagens com 1 a 4 fotos reduzidas no aparelho; qualquer membro publica; Firestore Rules validam cada foto (caminho do próprio post) e as permissões de autor/diretoria; Storage Rules validam membro, tipo, tamanho e autor. |
| 27/09/2026 | Regras do Storage consultam o Firestore (membro/diretoria): exige o papel **Firebase Rules Firestore Service Agent** para a conta de serviço do Storage (`service-…@gcp-sa-firebasestorage.iam.gserviceaccount.com`), concedido pelo usuário no IAM. Sem ele, todo envio falha com `storage/unauthorized`. |
| 27/09/2026 | M2 do mural: curtidas com contador no post validado nas Rules (±1 com `exists`/`existsAfter` da curtida da própria pessoa); comentários sem contador (contagem `count` no servidor por post ao carregar o feed). Moderação de comentários: autor, autor do post e diretoria. |
| 27/09/2026 | Escudo do time passa para o Storage (substitui a decisão de data URL no documento): 512px, nome com data/hora (URL nova a cada troca, sem cache velho), anterior apagado. Storage: só adminGeral envia/apaga, qualquer logado lê. Firestore Rules aceitam só URL do bucket do projeto na pasta do próprio time (ou data URL antigo). Logos de apoiadores continuam em data URL. |
| 27/09/2026 | Revisão de código: padrões registrados em 6.2. Avisos e confirmação centralizados (`shared/avisos.ts`: `Avisos`, `executar`, `confirmacaoPadrao`); WhatsApp/copiar em `shared/compartilhar.ts`; tela do evento dividida (`lista-presenca`, `ajuste-presenca`, `chamar-time`, `lista-pessoas`); gravação da configuração financeira num só método do service; estilos repetidos (`.dica`, `.cartao-link`, `.selo-alerta`) no global. Lista de presença não volta à primeira aba a cada resposta recebida. `PROMPT-INICIAL.md` (Fase 0) removido; README reescrito. Sem mudança de regra de negócio. |
| 27/09/2026 | Correção: `qtdCurtidas` faltava nos campos permitidos do post (toda curtida era negada); criação de post não pode trazer o contador. |
| 27/09/2026 | Fase 4 em três entregas: 4a estatísticas → 4b campeonatos → 4c escalação (formação por esporte + vagas tocáveis com quem disse Vou). Artilharia e assistências **automáticas** a partir dos gols dos eventos, com **ajuste manual** da diretoria (coleção `ajustesEstatistica`, guarda a diferença). Cartões fora por enquanto. Artilharia como aba interna do Elenco (sem 6ª aba no rodapé); Campeonatos irão para a Agenda. Substitui `campeonatos/{id}/estatisticas` lançadas à mão. |
| 27/09/2026 | Fase 4b (Campeonatos): cadastro pela diretoria (nome, temporada livre, situação andamento/encerrado; sem exclusão), como aba interna da Agenda. Evento do tipo campeonato aponta opcionalmente para um campeonato (`campeonatoId`, Rules conferem tipo e existência). Tela do campeonato com campanha derivada dos placares, artilharia própria (ajuste com escopo `c-{id}`) e jogos. Índice `campeonatoId + data`. |
| 27/09/2026 | Fase 4c (Escalação): tela própria por evento esportivo, formação da lista fechada por esporte e vagas no campinho (diretoria toca e escolhe; troca de lugar ao escolher quem já está em campo). Titulares gravados como `{atletaId, vaga}` (posição derivada da formação), substituindo `{posicao, x, y}`; reservas calculadas (quem vai e não está em campo), não gravadas. Envio da escalação em texto pelo WhatsApp. Fase 4 concluída. |
| 27/09/2026 | Fase 5 começa pelo PWA (6.3): manifest, ícones gerados da marca, `@angular/service-worker` 22.2 (dependência oficial do Angular, aprovada) com cache só dos arquivos do app, aviso de versão nova e "Instalar app" (pedido nativo no Android; instruções no iPhone). Cabeçalhos do Hosting ajustados para o service worker revalidar sempre. |

---

## 11. Pendências (perguntar ao usuário antes de assumir)

1. ~~Login: apenas Google ou também e-mail/senha?~~ Resolvido: só Google por enquanto (seção 10).
2. ~~Diretoria pode conceder `tesouraria`/`diretoria`?~~ Resolvido: sim (seção 10).
3. ~~Jogador pode ver o saldo do caixa?~~ Resolvido: nunca (seção 10).
4. ~~Avulso com conta pode ver as próprias cobranças por jogo?~~ Resolvido: sim, jogador vê todas as próprias cobranças (seção 10).
5. ~~Nome do app~~ ResenhaFC (seção 10). Domínio de hospedagem: a definir.
