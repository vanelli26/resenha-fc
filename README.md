# ResenhaFC

Gestão de times de futebol (society, campo e futsal): elenco, cobranças e caixa, agenda com presença, mural com fotos e apoiadores. Mobile-first, pt-BR. Em uso por **Piratas FC** e **Futebol Profissa**, cada um com dados independentes.

- Produção: https://resenhafc-2f357.web.app
- Domínio, regras de negócio, modelo de dados, permissões, padrões de código e roadmap: [DIRETRIZES.md](DIRETRIZES.md)
- Instruções para o agente de código: [CLAUDE.md](CLAUDE.md)

## Stack

Angular 22 (standalone, zoneless, signals, Signal Forms) · PrimeNG 22 · Firebase (SDK modular): Authentication (Google), Firestore, Storage e Hosting, plano Blaze. Sem Cloud Functions.

## Rodar local

Requisitos: Node 22 e Firebase CLI (`npm i -g firebase-tools`, `firebase login`).

```bash
npm install
npm start          # http://localhost:4200 (usa o projeto Firebase de produção)
npm run lint
npm run build      # saída em dist/resenha-fc
```

## Publicar

Só com os comandos abaixo, e só o que mudou (ver DIRETRIZES 8.1):

```bash
npm run build && firebase deploy --only hosting
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

As regras do Storage consultam o Firestore: a conta de serviço do Storage precisa do papel IAM **Firebase Rules Firestore Service Agent** (DIRETRIZES 10).

## Estrutura

```
src/app/
  core/       auth, providers Firebase, layout (shell), tema, contexto do time atual
  shared/     avisos, dinheiro, competência, imagem, compartilhar, rótulos e componentes genéricos
  models/     tipos e listas fechadas do domínio
  features/   uma pasta por área (agenda, elenco, financeiro, mural, ...); data/ com os services
firestore.rules · firestore.indexes.json · storage.rules · firebase.json
```

## Licenças

PrimeNG 22 usa a PrimeUI Community License (chave em `environments`, renovação anual; ver DIRETRIZES 10).
