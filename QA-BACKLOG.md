# QA Backlog — bugs menores e melhorias

Registro de itens de baixa prioridade levantados nas revisões de QA, para corrigir depois.
Os itens de severidade Alta/Média são corrigidos na hora; aqui ficam os menores.

> Convenção: cada item tem status `[ ]` (aberto) / `[x]` (resolvido), severidade e sugestão.

---

## Aberto

### [ ] BUG-C · Squad derivada por suposição do Area Path
- **Severidade:** Baixa
- **Origem:** branch `feat/organizacao-repositorio` (2026-06-30)
- **Descrição:** `squad` é extraída como o **2º segmento** do `System.AreaPath` (ex.: `SHARE-4\DI` → `DI`). Funciona para a estrutura atual do SHARE-4, mas se alguma squad tiver o Area Path configurado diferente (sub-área mais profunda, ou área = nome do projeto), o valor pode sair distinto/errado.
- **Como reproduzir:** importar um card cuja squad use um Area Path fora do padrão `Projeto\Squad`.
- **Sugestão:** validar contra os Area Paths reais das squads (DI, SQUAD SHARE-4, ORION, EVOLUCAO); se variar, mapear via lista/config em vez de posição fixa. Arquivo: `src/lib/cardImport.ts` (`areaTeam`).

### [ ] BUG-D · Import sobrescreve o Título sem confirmação
- **Severidade:** Baixa
- **Origem:** branch `feat/organizacao-repositorio` (2026-06-30)
- **Descrição:** ao "Buscar do Azure", o Título é preenchido automaticamente (`<id> - <PBI>`), sobrescrevendo um título digitado manualmente. A confirmação de sobrescrita atual só cobre User Story / Critérios de Aceite / Análise do Dev.
- **Sugestão:** incluir o Título na verificação de "sobrescrever conteúdo já preenchido?" no `handleImport`. Arquivo: `src/components/TestCaseGenerator.tsx`.

### [ ] BUG-E · Cabeçalho do grupo mostra Squad/Sprint só do primeiro caso
- **Severidade:** Baixa
- **Origem:** branch `feat/organizacao-repositorio` (2026-06-30)
- **Descrição:** no repositório e na execução, o cabeçalho de cada grupo (feature) usa `items[0].squad/sprint`. Se um mesmo título (feature) tiver casos com squad/sprint diferentes, exibe só o do primeiro.
- **Sugestão:** garantir squad/sprint uniformes por grupo, ou exibir "vários" quando divergir. Arquivos: `src/components/SavedTestCases.tsx`, `src/components/Execucao.tsx`.

### [ ] PERF-01 · Bundle único > 500 KB
- **Severidade:** Baixa (não funcional)
- **Descrição:** o build gera um chunk JS > 500 KB (gzip ~200 KB). Sem impacto funcional, mas o Vite avisa.
- **Sugestão:** code-splitting por rota (`React.lazy`) ou `manualChunks` no Vite. Arquivo: `vite.config.ts`.

---

## Resolvido

<!-- Mover itens para cá quando corrigidos, com o commit. -->
