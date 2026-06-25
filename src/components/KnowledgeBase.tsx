import { useMemo, useState } from 'react';

type CatKey = 'tipos' | 'conceitos' | 'praticas' | 'metodologias';

interface Article {
  id: string;
  cat: CatKey;
  title: string;
  /** Conteúdo HTML estático e controlado (migrado de qa-hub-selbetti.html). */
  body: string;
}

interface CatMeta {
  label: string;
  icon: string; // bg/text do "ícone"
  tag: string; // bg/text da tag
  active: string; // estilo do chip de categoria ativo
}

const CAT_META: Record<CatKey, CatMeta> = {
  tipos: {
    label: 'Tipos de teste',
    icon: 'bg-selbetti-green/15 text-selbetti-green',
    tag: 'bg-selbetti-green/15 text-selbetti-green',
    active: 'bg-selbetti-green/15 text-selbetti-green border-selbetti-green',
  },
  conceitos: {
    label: 'Conceitos de QA',
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    tag: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    active:
      'bg-blue-100 text-blue-700 border-blue-400 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/50',
  },
  praticas: {
    label: 'Boas práticas',
    icon: 'bg-selbetti-orange/15 text-selbetti-orange',
    tag: 'bg-selbetti-orange/15 text-selbetti-orange',
    active: 'bg-selbetti-orange/15 text-selbetti-orange border-selbetti-orange',
  },
  metodologias: {
    label: 'Metodologias',
    icon: 'bg-selbetti-purple/15 text-selbetti-purple',
    tag: 'bg-selbetti-purple/15 text-selbetti-purple',
    active: 'bg-selbetti-purple/15 text-selbetti-purple border-selbetti-purple',
  },
};

const ARTICLES: Article[] = [
  {
    id: 'teste-unitario',
    cat: 'tipos',
    title: 'Teste unitário',
    body: `Testa a menor unidade do código (função, método) de forma isolada, sem dependências externas.<ul><li><strong>Responsável:</strong> geralmente o desenvolvedor</li><li><strong>Ferramentas:</strong> JUnit, Jest, NUnit, PyTest</li><li><strong>Quando usar:</strong> a cada commit, integrado ao CI/CD</li></ul><div class="kb-example"><strong>Exemplo</strong>Testar se a função parseDate() retorna null para uma string inválida.</div>`,
  },
  {
    id: 'teste-integracao',
    cat: 'tipos',
    title: 'Teste de integração',
    body: `Verifica se dois ou mais módulos funcionam corretamente juntos — API + banco, front + back, serviço A + B.<ul><li><strong>Foco:</strong> contratos de interface e comunicação entre partes</li><li><strong>Ferramentas:</strong> Postman, REST Assured, Supertest</li></ul><div class="kb-example"><strong>Exemplo</strong>Verificar se o endpoint POST /auth/reset-password persiste no banco e dispara e-mail via SendGrid.</div>`,
  },
  {
    id: 'teste-e2e',
    cat: 'tipos',
    title: 'Teste end-to-end (E2E)',
    body: `Simula o fluxo completo do usuário do início ao fim, passando por todas as camadas do sistema.<ul><li><strong>Mais lento e custoso</strong>, mas valida a experiência real</li><li><strong>Ferramentas:</strong> Cypress, Playwright, Selenium</li><li>Use para fluxos críticos de negócio e smoke tests antes de releases</li></ul><div class="kb-example"><strong>Exemplo</strong>Abrir documento no ECM → editar índice data/hora → salvar → reabrir e validar persistência.</div>`,
  },
  {
    id: 'teste-regressao',
    cat: 'tipos',
    title: 'Teste de regressão',
    body: `Garante que uma mudança no código não quebrou funcionalidades que já funcionavam antes.<ul><li><strong>Essencial</strong> após qualquer correção de bug ou nova feature</li><li>Deve cobrir os fluxos principais do sistema</li><li>Candidato ideal para automação</li></ul><div class="kb-example"><strong>Exemplo</strong>Após corrigir o parseDate() no Share4, re-testar o Share Clássico para garantir que não foi impactado.</div>`,
  },
  {
    id: 'teste-exploratorio',
    cat: 'tipos',
    title: 'Teste exploratório',
    body: `Teste sem roteiro fixo onde o QA usa experiência e intuição para encontrar bugs não previstos.<ul><li>Muito eficaz para edge cases e inconsistências visuais</li><li>Complementa (não substitui) os casos estruturados</li><li>Registre o que foi explorado para não repetir sem critério</li></ul>`,
  },
  {
    id: 'teste-performance',
    cat: 'tipos',
    title: 'Teste de performance',
    body: `Avalia o comportamento do sistema sob carga — tempo de resposta, uso de memória, throughput e limites.<ul><li><strong>Tipos:</strong> carga (load), estresse (stress), pico (spike), resistência (soak)</li><li><strong>Ferramentas:</strong> JMeter, k6, Gatling, Locust</li></ul>`,
  },
  {
    id: 'teste-acessibilidade',
    cat: 'tipos',
    title: 'Teste de acessibilidade',
    body: `Verifica se o sistema pode ser usado por pessoas com deficiências visuais, motoras ou cognitivas.<ul><li><strong>Padrão:</strong> WCAG 2.1 (níveis A, AA, AAA)</li><li><strong>Ferramentas:</strong> axe, Lighthouse, NVDA (leitor de tela)</li><li>Verificar contraste, navegação por teclado, labels em campos</li></ul>`,
  },
  {
    id: 'smoke-test',
    cat: 'tipos',
    title: 'Smoke test',
    body: `Teste rápido pós-deploy para confirmar que as funções básicas estão operando antes do teste completo.<ul><li>Não é exaustivo — é um "está de pé?"</li><li>Deve durar no máximo 10 a 15 minutos</li><li>Se falhar, o build é rejeitado imediatamente</li></ul>`,
  },
  {
    id: 'severidade-prioridade',
    cat: 'conceitos',
    title: 'Severidade vs. Prioridade',
    body: `Dois conceitos frequentemente confundidos — sempre devem ser registrados separadamente.<ul><li><strong>Severidade:</strong> impacto técnico do bug no sistema</li><li><strong>Prioridade:</strong> urgência de negócio para correção</li></ul><div class="kb-example"><strong>Exemplo clássico</strong>Logo de cabeça para baixo: <strong>severidade baixa</strong>, <strong>prioridade alta</strong>. Bug que impede login de 1 usuário interno: <strong>severidade alta</strong>, <strong>prioridade média</strong>.</div>`,
  },
  {
    id: 'cobertura-testes',
    cat: 'conceitos',
    title: 'Cobertura de testes',
    body: `Métrica que indica o quanto do sistema está sendo testado pelos casos escritos.<ul><li><strong>Cobertura de código:</strong> % de linhas/branches executadas pelos testes automatizados</li><li><strong>Cobertura de requisitos:</strong> % de critérios de aceite cobertos por casos de teste</li><li>100% de cobertura não significa zero bugs — significa que tudo foi testado</li></ul>`,
  },
  {
    id: 'criterio-aceite',
    cat: 'conceitos',
    title: 'Critério de aceite',
    body: `Condições que uma User Story deve satisfazer para ser considerada completa e aceita pelo cliente ou PO.<ul><li>Escrito antes do desenvolvimento (definição de pronto)</li><li>Base para todos os casos de teste do QA</li><li>Deve ser testável, específico e não ambíguo</li></ul><div class="kb-example"><strong>Boa prática</strong>Se um CA não é testável ("o sistema deve ser rápido"), questione. Peça uma métrica concreta ("resposta abaixo de 2 segundos").</div>`,
  },
  {
    id: 'ciclo-vida-bug',
    cat: 'conceitos',
    title: 'Ciclo de vida de um bug',
    body: `Um bug passa por estados bem definidos da descoberta ao fechamento.<ul><li><strong>Aberto:</strong> identificado e registrado pelo QA</li><li><strong>Em andamento:</strong> dev trabalhando na correção</li><li><strong>Resolvido:</strong> dev corrigiu — aguarda reteste do QA</li><li><strong>Fechado:</strong> QA validou e confirmou a correção</li><li><strong>Reaberto:</strong> correção não funcionou ou gerou regressão</li></ul>`,
  },
  {
    id: 'definicao-pronto',
    cat: 'conceitos',
    title: 'Definição de pronto (DoD)',
    body: `Conjunto de critérios que toda entrega deve satisfazer além dos critérios de aceite da US.<ul><li>Exemplos: testes unitários escritos, casos de teste executados, sem bugs críticos abertos, documentação atualizada, deploy em homologação feito</li><li>A DoD é do time, não da US — vale para todas as entregas</li></ul>`,
  },
  {
    id: 'bom-caso-teste',
    cat: 'praticas',
    title: 'Como escrever um bom caso de teste',
    body: `Um caso mal escrito passa falsa sensação de cobertura.<ul><li><strong>Título:</strong> diz o que está sendo testado, não como</li><li><strong>Pré-condições:</strong> tudo que precisa estar configurado antes</li><li><strong>Passos:</strong> numerados, atômicos, reproduzíveis por qualquer pessoa do time</li><li><strong>Resultado esperado:</strong> concreto e verificável — nunca "deve funcionar corretamente"</li></ul><div class="kb-example"><strong>Evite</strong>"Testar o login." <strong>Prefira</strong>"CT-001 — Login com credenciais válidas redireciona para o dashboard."</div>`,
  },
  {
    id: 'registrar-bug',
    cat: 'praticas',
    title: 'Como registrar um bug de qualidade',
    body: `Um bug bem registrado resolve-se mais rápido. Um bug mal registrado volta com "não reproduzi".<ul><li><strong>Título:</strong> [O que] + [onde] + [quando]</li><li><strong>Evidência:</strong> sempre. Print, vídeo, log — sem evidência o bug não existe</li><li><strong>Passos:</strong> detalhados o suficiente para qualquer dev reproduzir sem pedir ajuda</li><li><strong>Ambiente:</strong> versão, browser, OS, dados usados no teste</li><li><strong>Resultado atual vs. esperado:</strong> os dois campos são obrigatórios</li></ul>`,
  },
  {
    id: 'qa-cicd',
    cat: 'praticas',
    title: 'QA na esteira de CI/CD',
    body: `O QA moderno está presente em todo o ciclo, não só no final.<ul><li>Participar do refinamento para questionar critérios ambíguos</li><li>Smoke tests automatizados a cada deploy em homologação</li><li>Regressão automatizada para fluxos críticos</li><li>Gate de qualidade: build não sobe para produção sem aprovação do QA</li></ul>`,
  },
  {
    id: 'questionar-antes',
    cat: 'praticas',
    title: 'Quando questionar antes de testar',
    body: `Testar com critérios ambíguos é desperdício. Questione antes — não depois de encontrar o bug.<ul><li>CA com termos vagos: "rápido", "correto", "amigável" → peça métricas</li><li>Fluxos de erro não descritos → o que acontece quando falha?</li><li>Integrações não especificadas → comportamento na indisponibilidade?</li><li>Dados de teste não definidos → quais perfis de usuário testar?</li></ul>`,
  },
  {
    id: 'tdd',
    cat: 'metodologias',
    title: 'TDD — Test Driven Development',
    body: `Metodologia onde os testes são escritos antes do código de produção.<ul><li><strong>Ciclo:</strong> Red (teste que falha) → Green (código mínimo para passar) → Refactor</li><li>Resultado: código com alta cobertura desde o início</li><li>Praticado por devs — o QA deve entender para colaborar</li></ul>`,
  },
  {
    id: 'bdd',
    cat: 'metodologias',
    title: 'BDD — Behavior Driven Development',
    body: `Extensão do TDD focada em comportamento do usuário, usando linguagem natural.<ul><li><strong>Formato Gherkin:</strong> Given (dado que) → When (quando) → Then (então)</li><li>Facilita colaboração entre QA, Dev e negócio (PO)</li><li><strong>Ferramentas:</strong> Cucumber, SpecFlow, Behave</li></ul><div class="kb-example"><strong>Exemplo</strong>Given o usuário está no ECM / When ele abre um documento com índice data/hora / Then os campos devem estar preenchidos automaticamente.</div>`,
  },
  {
    id: 'shift-left',
    cat: 'metodologias',
    title: 'Shift-left testing',
    body: `Filosofia de trazer o QA para as fases mais iniciais do desenvolvimento.<ul><li>QA participa do refinamento de US e revisão de critérios de aceite</li><li>Bugs encontrados mais cedo custam muito menos para corrigir</li><li>Automação de testes como parte do pipeline de desenvolvimento</li></ul>`,
  },
  {
    id: 'piramide-testes',
    cat: 'metodologias',
    title: 'Pirâmide de testes',
    body: `Modelo que define a proporção ideal de testes em um projeto.<ul><li><strong>Base (muitos):</strong> testes unitários — rápidos, baratos, isolados</li><li><strong>Meio (alguns):</strong> testes de integração — verificam comunicação entre módulos</li><li><strong>Topo (poucos):</strong> testes E2E — lentos, mas validam o fluxo completo</li></ul><div class="kb-example"><strong>Anti-pattern</strong>Pirâmide invertida (muitos E2E, poucos unitários) = lenta, frágil e cara de manter.</div>`,
  },

  {
    id: 'teste-aceitacao',
    cat: 'tipos',
    title: 'Teste de aceitação (UAT)',
    body: `Valida se o sistema atende às necessidades do negócio e do usuário final antes de ir para produção.<ul><li><strong>Quem executa:</strong> PO, cliente ou usuários-chave — não só o QA</li><li><strong>Foco:</strong> regras de negócio e fluxos reais, não detalhes técnicos</li><li>É o último portão antes da liberação</li></ul><div class="kb-example"><strong>Exemplo</strong>O cliente valida que o relatório financeiro gerado bate com os números esperados do fechamento do mês.</div>`,
  },
  {
    id: 'teste-seguranca',
    cat: 'tipos',
    title: 'Teste de segurança',
    body: `Verifica se o sistema protege dados e resiste a acessos indevidos.<ul><li><strong>Referência:</strong> OWASP Top 10 (injeção, autenticação quebrada, exposição de dados...)</li><li>Inclui testes de autorização, validação de entrada e gestão de sessão</li><li><strong>Ferramentas:</strong> OWASP ZAP, Burp Suite</li></ul><div class="kb-example"><strong>Exemplo</strong>Tentar acessar o documento de outro usuário trocando o ID na URL (IDOR) — deve ser bloqueado.</div>`,
  },
  {
    id: 'teste-usabilidade',
    cat: 'tipos',
    title: 'Teste de usabilidade',
    body: `Avalia o quão fácil e intuitivo o sistema é para o usuário real.<ul><li>Observa usuários executando tarefas, sem guiá-los</li><li>Mede tempo, erros, hesitações e satisfação</li><li>Difere da acessibilidade: foca em facilidade de uso, não em inclusão</li></ul>`,
  },
  {
    id: 'teste-compatibilidade',
    cat: 'tipos',
    title: 'Teste de compatibilidade',
    body: `Garante que o sistema funciona em diferentes ambientes.<ul><li><strong>Cross-browser:</strong> Chrome, Firefox, Edge, Safari</li><li><strong>Cross-device:</strong> resoluções, sistemas e versões de OS</li><li><strong>Ferramentas:</strong> BrowserStack, Sauce Labs</li></ul>`,
  },
  {
    id: 'teste-sanidade',
    cat: 'tipos',
    title: 'Teste de sanidade (sanity)',
    body: `Verificação rápida e focada após uma correção pontual, para confirmar que aquela função específica voltou a funcionar.<ul><li>Mais estreito que o smoke (que cobre as funções básicas em largura)</li><li>Geralmente não documentado, feito sob demanda</li></ul><div class="kb-example"><strong>Exemplo</strong>Após corrigir o cálculo de juros, testar só esse cálculo antes de rodar a regressão completa.</div>`,
  },
  {
    id: 'teste-api',
    cat: 'tipos',
    title: 'Teste de API',
    body: `Valida diretamente os serviços (REST/GraphQL), sem passar pela interface.<ul><li><strong>Verifica:</strong> status HTTP, schema do corpo, headers, tempo de resposta e regras de negócio</li><li>Mais rápido e estável que testar pela UI</li><li><strong>Ferramentas:</strong> Postman, REST Assured, Insomnia</li></ul><div class="kb-example"><strong>Exemplo</strong>POST sem campo obrigatório deve retornar 400 com mensagem de erro clara — não 500.</div>`,
  },

  {
    id: 'bug-defeito-falha',
    cat: 'conceitos',
    title: 'Erro, defeito, bug e falha',
    body: `Termos próximos, mas distintos na cadeia de um problema.<ul><li><strong>Erro (mistake):</strong> a ação humana equivocada (ex: um cálculo errado escrito pelo dev)</li><li><strong>Defeito / bug:</strong> o resultado desse erro no código</li><li><strong>Falha (failure):</strong> o comportamento incorreto observado em execução</li></ul><div class="kb-example"><strong>Na prática</strong>Nem todo defeito vira falha — só quando o trecho com defeito é executado nas condições certas.</div>`,
  },
  {
    id: 'caso-vs-cenario',
    cat: 'conceitos',
    title: 'Caso de teste vs. cenário de teste',
    body: `Dois níveis de granularidade.<ul><li><strong>Cenário:</strong> o que testar, em alto nível ("recuperação de senha")</li><li><strong>Caso de teste:</strong> o como, com passos, dados e resultado esperado detalhados</li></ul>Um cenário costuma se desdobrar em vários casos de teste (positivos, negativos, edge).`,
  },
  {
    id: 'massa-dados',
    cat: 'conceitos',
    title: 'Massa de dados de teste',
    body: `Conjunto de dados usados para executar os testes. A qualidade da massa define a qualidade do teste.<ul><li>Cobrir casos válidos, inválidos e de borda</li><li>Evitar dados de produção com informação pessoal real (LGPD) — prefira dados anonimizados ou sintéticos</li><li>Massa controlada torna o resultado reproduzível</li></ul>`,
  },
  {
    id: 'teste-baseado-risco',
    cat: 'conceitos',
    title: 'Teste baseado em risco',
    body: `Prioriza o esforço de teste onde o risco é maior (probabilidade × impacto).<ul><li>Testar primeiro o que é crítico para o negócio e mais provável de falhar</li><li>Útil quando o tempo é curto — você não testa tudo, testa o que importa</li></ul><div class="kb-example"><strong>Exemplo</strong>Pagamento e login recebem mais testes que uma tela de "sobre".</div>`,
  },
  {
    id: 'flaky-test',
    cat: 'conceitos',
    title: 'Testes instáveis (flaky)',
    body: `Testes que passam e falham de forma intermitente sem mudança no código.<ul><li><strong>Causas comuns:</strong> esperas fixas (sleep), dependência de ordem, dados compartilhados, concorrência</li><li>Minam a confiança na suíte — o time passa a ignorar falhas reais</li><li><strong>Solução:</strong> esperas explícitas, isolamento de dados, identificar e corrigir (não só re-rodar)</li></ul>`,
  },
  {
    id: 'plano-teste',
    cat: 'conceitos',
    title: 'Plano de teste',
    body: `Documento que define a estratégia de teste de uma feature ou release.<ul><li><strong>Escopo:</strong> o que será e o que não será testado</li><li><strong>Abordagem:</strong> tipos de teste, ambientes, massa de dados</li><li><strong>Critérios:</strong> de entrada, de saída e de suspensão</li></ul>Não precisa ser extenso — um bom plano enxuto vale mais que um documento grande ignorado.`,
  },

  {
    id: 'independencia-testes',
    cat: 'praticas',
    title: 'Independência entre testes',
    body: `Cada teste deve poder rodar sozinho e em qualquer ordem.<ul><li>Um teste não deve depender do resultado de outro</li><li>Criar e limpar a própria massa de dados (setup/teardown)</li><li>Testes dependentes geram falsos negativos e flakiness</li></ul>`,
  },
  {
    id: 'triagem-bugs',
    cat: 'praticas',
    title: 'Triagem de bugs',
    body: `Processo de revisar bugs abertos e decidir o que fazer com cada um.<ul><li>Confirmar reprodutibilidade e remover duplicados</li><li>Definir severidade, prioridade e responsável</li><li>Decidir: corrigir agora, backlog ou won't fix</li></ul>Feita em conjunto por QA, Dev e PO — evita que bugs fiquem esquecidos.`,
  },
  {
    id: 'pair-testing',
    cat: 'praticas',
    title: 'Teste em par (pair testing)',
    body: `Duas pessoas testam juntas a mesma funcionalidade, geralmente QA + Dev ou QA + PO.<ul><li>Combina visões diferentes — quem conhece o código e quem conhece o uso</li><li>Acelera a descoberta e o entendimento de bugs</li><li>Ótimo para features complexas ou novas no time</li></ul>`,
  },
  {
    id: 'nomeacao-casos',
    cat: 'praticas',
    title: 'Nomeação clara de casos',
    body: `O título do caso deve dizer o que é validado e em qual condição, sem precisar abrir o caso.<ul><li>Inclua a condição e o resultado esperado</li><li>Padronize para facilitar busca e leitura</li></ul><div class="kb-example"><strong>Evite</strong>"Teste 1". <strong>Prefira</strong>"Login com senha incorreta exibe mensagem de erro e não autentica."</div>`,
  },

  {
    id: 'modelo-v',
    cat: 'metodologias',
    title: 'Modelo V',
    body: `Modelo onde cada fase de desenvolvimento tem uma fase de teste correspondente, planejada em paralelo.<ul><li>Requisitos ↔ Teste de aceitação</li><li>Design ↔ Teste de integração</li><li>Codificação ↔ Teste unitário</li></ul>O teste é pensado desde o início (não no fim) — espírito parecido com o shift-left.`,
  },
  {
    id: 'atdd',
    cat: 'metodologias',
    title: 'ATDD — Acceptance Test Driven Development',
    body: `Os critérios de aceite viram testes acordados entre negócio, dev e QA <strong>antes</strong> de codificar.<ul><li>Alinha o entendimento dos três papéis logo no começo</li><li>Os testes de aceitação guiam o desenvolvimento</li><li>Reduz retrabalho por requisito mal compreendido</li></ul>`,
  },
  {
    id: 'continuous-testing',
    cat: 'metodologias',
    title: 'Testes contínuos (continuous testing)',
    body: `Executar testes automatizados de forma contínua dentro do pipeline de CI/CD.<ul><li>Feedback rápido a cada commit/merge</li><li>Gate de qualidade: build não avança se testes falham</li><li>Combina unitários, integração e E2E em estágios</li></ul>`,
  },
  {
    id: 'sbtm',
    cat: 'metodologias',
    title: 'Gestão de testes por sessão (SBTM)',
    body: `Estrutura o teste exploratório em sessões com tempo definido (timebox) e uma missão (charter).<ul><li>Cada sessão tem foco, duração e anotações do que foi explorado</li><li>Dá rastreabilidade ao exploratório sem engessá-lo</li><li><strong>Charter:</strong> "Explorar o upload de arquivos buscando falhas de validação de tamanho e tipo"</li></ul>`,
  },
];

const ALL = 'todos';

export default function KnowledgeBase() {
  const [cat, setCat] = useState<CatKey | typeof ALL>(ALL);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ARTICLES.filter((a) => {
      if (cat !== ALL && a.cat !== cat) return false;
      if (term) {
        const haystack = `${a.title} ${a.body}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [cat, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Base de conhecimento
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Referência rápida sobre tipos de teste, conceitos, boas práticas e
          metodologias de QA.
        </p>
      </div>

      {/* Busca + categorias */}
      <div className="space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar conceito, tipo de teste, metodologia…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
        />
        <div className="flex flex-wrap gap-2">
          <CatChip
            active={cat === ALL}
            activeClass="bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
            onClick={() => setCat(ALL)}
          >
            Todos
          </CatChip>
          {(Object.keys(CAT_META) as CatKey[]).map((key) => (
            <CatChip
              key={key}
              active={cat === key}
              activeClass={CAT_META[key].active}
              onClick={() => setCat(key)}
            >
              {CAT_META[key].label}
            </CatChip>
          ))}
        </div>
      </div>

      {/* Artigos (accordion) */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Nenhum resultado encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const meta = CAT_META[a.cat];
            const isOpen = open.has(a.id);
            return (
              <div
                key={a.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
              >
                <button
                  type="button"
                  onClick={() => toggle(a.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.icon}`}
                  >
                    <DocIcon />
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                    {a.title}
                  </span>
                  <span
                    className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium sm:inline ${meta.tag}`}
                  >
                    {meta.label}
                  </span>
                  <svg
                    className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m6 9 6 6 6-6"
                    />
                  </svg>
                </button>
                {isOpen && (
                  <div
                    className="kb-prose px-4 pb-4 pl-[3.75rem]"
                    // Conteúdo estático e controlado (migrado do HTML de referência);
                    // não há entrada de usuário, logo sem superfície de XSS.
                    dangerouslySetInnerHTML={{ __html: a.body }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CatChip({
  active,
  activeClass,
  onClick,
  children,
}: {
  active: boolean;
  activeClass: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? activeClass
          : 'border-gray-300 bg-white text-gray-600 hover:border-selbetti-green dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-selbetti-green'
      }`}
    >
      {children}
    </button>
  );
}

function DocIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  );
}
