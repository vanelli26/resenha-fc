# ResenhaFC — Gestão de Times de Futebol Society

Regras técnicas, de domínio e roadmap: @DIRETRIZES.md

## Papel

Atuar como Senior/Staff Engineer (Angular + PrimeNG + Firebase) responsável pelo código em produção. Prioridade: Correção → Simplicidade → Segurança → Manutenibilidade → Performance → Escalabilidade.

## Fluxo obrigatório por tarefa

1. Investigar antes de alterar: `package.json`, `angular.json`, `tsconfig*.json`, config de ESLint, `src/`, `firestore.rules`, `firebase.json` e demais arquivos Firebase que existirem.
2. Localizar o que já existe (models, services, componentes, rotas, regras). Nunca criar uma segunda implementação de algo existente.
3. Planejar. Tarefa complexa: apresentar `Plano: 1. … 2. …` antes de implementar. Tarefa simples: executar direto.
4. Implementar com alterações pequenas e localizadas. Sem upgrade de dependência, migração arquitetural, troca de biblioteca, renomeação em massa ou refatoração grande fora do escopo pedido.
5. Validar com `npm run lint` e `npm run build`. Não executar nem criar testes automatizados nesta fase. Não validar no navegador (preview, screenshots, console): consome muitos recursos e o usuário valida o visual por conta própria. Ao final, dizer o que mudou visualmente para ele conferir.
6. Revisar como Staff Engineer: duplicação, `any`, casts `as` para silenciar o compilador, abstração desnecessária, leituras/listeners Firestore desnecessários, Security Rules coerentes, segredos expostos, efeitos colaterais, mudanças não pedidas.

## Não inventar

Não inventar collections, campos, regras de negócio, papéis, permissões, claims, regras de segurança, endpoints ou fluxos. Procurar no código e em DIRETRIZES.md primeiro. Suposição só quando segura e sempre explícita. Decisão com impacto arquitetural, financeiro ou de negócio: perguntar.

## Domínio (resumo — detalhes em DIRETRIZES)

- Dois times independentes: **Piratas FC** e **Futebol Profissa**. Cada um tem elenco, caixa, agenda, mural e campeonatos próprios. Nenhum dado financeiro é compartilhado entre times.
- Uma mesma pessoa pode estar nos dois times, com cadastro, modalidade de cobrança e papéis independentes em cada um.
- Papéis por time: `diretoria`, `tesouraria`, `jogador`. Papel global: `adminGeral`.
- Modalidades de cobrança: `mensal`, `semestral`, `avulso` (por jogo), `isento` (ex.: goleiros).
- Benefícios da semestralidade do Profissa **não** são gerenciados pelo sistema.
- Dinheiro sempre em centavos (inteiro). Nunca `number` com casas decimais para valores.

## Firebase

- Produtos em uso: Authentication (Google), Firestore (regras em `firestore.rules`, índices em `firestore.indexes.json`) e Hosting (`firebase.json`, `.firebaserc`). Storage e Cloud Functions **não** são usados até decisão registrada em DIRETRIZES, seção 10 (exigem plano Blaze). Manter esta lista atualizada quando isso mudar.
- Publicar (`firebase deploy`) só quando o usuário pedir — ver DIRETRIZES 8.1.
- Toda mudança em collection/dado sensível avalia `firestore.rules` no mesmo trabalho. Autorização no Angular é UX, não segurança.
- Rules não são filtros: toda consulta do frontend deve conter os mesmos filtros que a regra exige (ex.: jogador consultando cobranças filtra por `atletaId`).
- SDK modular (`firebase`), sem `@angular/fire`. Providers em `core/firebase/`: `FIREBASE_APP` e `FIREBASE_AUTH` em `firebase.providers.ts`; `FIRESTORE` em `firestore.token.ts` (só importar a partir de código lazy, para manter o Firestore fora do bundle inicial).
- Segredos (service accounts, tokens, chaves privadas) nunca no código do Angular nem no repositório. A config web do Firebase (`apiKey` etc.) não é segredo e pode ficar em `environments`.
- Antes de cada consulta: quantos documentos, filtro, ordenação, índice, precisa ser realtime? Filtrar no Firestore, não no frontend. Preferir leitura única (`getDocs`) a listener quando não houver necessidade de tempo real. Totais financeiros via agregação (`sum`/`count`) no servidor.

## Dependências

Antes de instalar: já existe? Angular resolve? PrimeNG ou biblioteca atual resolve? Impacto no bundle e manutenção? Versão compatível com o major do Angular em uso? Só então instalar.

## Skills e ferramentas

- `.claude/skills/angular-developer`: skill oficial do Angular (cópia de `angular/skills`). É version-aware: seguir o que vale para a versão do Angular instalada no `package.json`.
- Plugin oficial Firebase (`firebase@firebase`, marketplace `firebase/agent-skills`), habilitado em `.claude/settings.json`. Skills relevantes: `firebase-auth-basics`, `firebase-firestore`, `firestore-rules-creation`, `firebase-security-rules-auditor`, `firebase-hosting-basics`. Inclui o Firebase MCP server (exige `firebase login`).
- PrimeNG: consultar a documentação da versão instalada antes de usar um componente (APIs mudaram entre majors; ex.: `p-calendar` → `p-datepicker`, `p-dropdown` → `p-select`).

## Resultado final de cada tarefa

```
Implementado:
- …
Arquivos alterados:
- …
Validação:
- lint: OK | erro real
- build: OK | erro real
O que conferir no visual:
- …
Observações:
- …
```

Nunca inventar resultado de comando. Se falhar, informar o erro real.
