# Fundação de Cadernos

## Padrões existentes que serão reutilizados

- **Rotas e proteção:** páginas carregadas sob demanda em `App.tsx`, protegidas por `ProtectedRoute`, dentro da navegação lateral comum.
- **Planner:** navegação por visões no cabeçalho, com listas próprias para Anotações e Metas; Cadernos será uma visão/rota própria ligada ao Planner.
- **Criar da Home:** o menu fica no `Navbar` e já abre formulários compartilhados para anotações e metas; “Novo caderno” reutilizará o mesmo diálogo usado na área de Cadernos.
- **CRUD:** serviços pequenos sobre o banco, React Query para carregamento/cache e mutations com invalidação, além de mensagens de sucesso e erro.
- **Formulários e exclusão:** componentes do design system, diálogo adaptável, campos controlados, ação primária desabilitada sem título e confirmação destrutiva antes de excluir.
- **Listas e estados:** busca local, cards responsivos, skeleton durante carregamento e estado vazio com orientação e ação principal.
- **Segurança:** UUID e timestamps automáticos, gatilho de `updated_at`, acesso por proprietário via RLS e permissões explícitas para usuários autenticados e serviço interno.
- **Disciplinas:** relação opcional com a entidade já existente; somente disciplinas ativas serão oferecidas na criação/edição, sem duplicar dados.

## O que será construído

1. **Estrutura de dados**
   - Criar apenas `notebooks` com `id`, `user_id`, `title`, `description`, `icon`, `color`, `subject_id`, `created_at` e `updated_at`.
   - Adicionar índice por proprietário/atualização, gatilho de atualização, permissões e políticas para leitura, criação, edição e exclusão apenas pelo dono.
   - Não criar páginas, blocos, conteúdo ou vínculos futuros.

2. **Camada compartilhada de Cadernos**
   - Criar tipos e serviço para listar, criar, atualizar e excluir cadernos.
   - Ordenar por atualização mais recente e retornar somente os campos necessários com disciplina relacionada.
   - Criar um diálogo reutilizável de criação/edição com nome obrigatório, descrição, emoji, cor e disciplina opcional.

3. **Área de Cadernos**
   - Criar a rota protegida `/planner/cadernos` e conectá-la ao contexto do Planner.
   - Exibir cabeçalho, busca por título/descrição, grade responsiva e cards com ícone, nome, descrição curta, disciplina e atualização.
   - Permitir editar e excluir pelo menu do card; clicar no card apenas selecionará/abrirá suas informações básicas nesta etapa, sem editor ou páginas internas.
   - Cobrir carregamento, erro, primeiro caderno e busca sem resultados.

4. **Entradas compartilhadas**
   - Adicionar “Cadernos” à navegação do Planner.
   - Adicionar “Novo caderno” ao botão “Criar” da Home usando exatamente o mesmo diálogo e serviço da área de Cadernos.
   - Atualizar carregamento antecipado da rota e metadados da página.

5. **Validação**
   - Conferir criação, edição, busca, abertura e exclusão com usuário autenticado.
   - Conferir estados de loading, vazio, erro e busca vazia.
   - Verificar desktop e mobile, além da Home e dos fluxos atuais do Planner.
   - Confirmar que não houve implementação de páginas, editor, IA, compartilhamento ou integrações profundas.

## Detalhes técnicos

- A tabela seguirá `gen_random_uuid()`, `now()` e `public.update_updated_at_column()` já usados no projeto.
- O acesso será reforçado em duas camadas: RLS no banco e filtro pelo usuário autenticado nas operações do serviço.
- O vínculo com disciplina usará `ON DELETE SET NULL`, preservando o caderno se a disciplina for removida.
- A cor usará uma paleta curta baseada nos tokens visuais do Zenit; o valor persistido será estável para futuras telas.
- Nenhuma rota de conteúdo interno será criada nesta etapa.
