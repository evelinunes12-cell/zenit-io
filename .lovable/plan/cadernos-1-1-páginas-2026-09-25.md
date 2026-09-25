# Cadernos 1.1 — Páginas

## Estrutura atual e padrões reutilizados

- **Cadernos:** `notebooks` já possui UUID, proprietário obrigatório, disciplina opcional, timestamps, gatilho de atualização, permissões e RLS por `auth.uid()`.
- **Dados e estado:** `src/services/notebooks.ts` concentra o CRUD; as telas usam React Query, invalidação de cache e mensagens de sucesso/erro.
- **Interface:** `NotebookCard`, `NotebookDialog`, `CreateNotebookDialog`, componentes do design system, skeletons e confirmações destrutivas serão mantidos.
- **Navegação:** a rota protegida `/planner/cadernos` já existe dentro da navegação comum. O clique no card hoje abre apenas informações básicas e será convertido em navegação para o caderno.
- **Preparação existente:** não há tabela, tipos, serviço ou rota de páginas; a fundação deixou a rota de listagem e os componentes de identificação do caderno prontos para evolução incremental.

## O que será construído

1. **Estrutura segura de páginas**
   - Criar `notebook_pages` com `id`, `notebook_id`, `title`, `position`, `created_at` e `updated_at`.
   - Relacionar cada página obrigatoriamente a um caderno e remover suas páginas quando o caderno for excluído.
   - Adicionar índice para listagem ordenada e atribuir automaticamente a próxima posição de criação, começando em zero.
   - Aplicar permissões e RLS para leitura, criação, edição e exclusão somente quando o caderno pertencer ao usuário autenticado.

2. **Serviço e componentes compartilhados**
   - Criar tipos e operações para listar, criar, renomear e excluir páginas.
   - Manter `notebook_id` e `position` imutáveis durante a edição do título.
   - Criar um diálogo simples e reutilizável para criação/edição, com apenas o título obrigatório.
   - Criar um item de página com título, atualização e menu de editar/excluir.

3. **Experiência interna do caderno**
   - Adicionar a rota protegida `/planner/cadernos/:id`.
   - Exibir navegação de volta, ícone, nome, descrição e disciplina do caderno.
   - Listar páginas por `position ASC` e timestamp como desempate.
   - Cobrir carregamento, erro, vazio orientativo e caderno inexistente/não acessível sem revelar dados.
   - Preservar a edição das informações do caderno na tela interna.

4. **Evolução da listagem**
   - Fazer o card abrir a nova tela interna em vez do painel lateral provisório.
   - Exibir a contagem real de páginas com uma consulta agregada, sem uma consulta por caderno.
   - Manter busca por título/descrição e todas as ações atuais de criação, edição e exclusão.

5. **Validação**
   - Verificar criação, renomeação, ordenação e exclusão de páginas com usuário autenticado.
   - Verificar caderno vazio, erros, rota inexistente e isolamento entre proprietários.
   - Verificar listagem, contagem, navegação e diálogos em desktop e mobile.
   - Confirmar que nenhum editor, conteúdo rico, bloco, tag, ícone de página, drag-and-drop ou busca em páginas foi adicionado.

## Detalhes técnicos

- A posição será atribuída no banco em uma operação protegida contra criações simultâneas; a interface não enviará posições arbitrárias.
- As policies consultarão a propriedade em `notebooks`, mantendo a autorização no banco e não apenas na interface.
- Alterações nas páginas atualizarão o timestamp do caderno para que a ordenação e o texto “Atualizado” continuem representando atividade real.
- A contagem será incorporada à consulta da listagem, evitando o padrão N+1.
- O detalhe do caderno buscará somente um registro pertencente ao usuário; ausência e falta de acesso terão a mesma resposta visual.
