# Cadernos 1.2A — Editor básico de páginas

## Objetivo
Transformar cada página de caderno em um espaço de escrita com título separado, conteúdo persistente e salvamento explícito, sem avançar para formatação acadêmica, autosave ou experiência em blocos.

## Estrutura atual e integração
- `notebook_pages` já guarda título, posição e datas, com acesso autorizado pela propriedade do caderno.
- `NotebookDetailPage` carrega o caderno e suas páginas; os cards hoje oferecem apenas editar título e excluir.
- A página ganhará uma rota filha própria, acessada ao clicar no card, mantendo `/planner/cadernos/:id` como visão do caderno.
- O serviço `notebookPages` continuará sendo a fonte única para leitura e atualização de páginas.
- O `RichTextEditor` existente, baseado em TipTap e já usado nas anotações, será evoluído para aceitar um modo básico sem toolbar. Isso preserva seleção, copiar, colar, desfazer e refazer nativos sem criar outro editor.

## Persistência
- Adicionar `content TEXT NOT NULL DEFAULT ''` a `notebook_pages` por migração aditiva.
- Usar HTML simples produzido pelo TipTap, compatível com a evolução futura, sem tabela de blocos ou estrutura paralela.
- Atualizar título e conteúdo no mesmo registro; `notebook_id` e `position` permanecem protegidos e inalterados.
- O trigger atual continuará atualizando `updated_at` da página e do caderno.

## Experiência da página
- Criar uma tela de edição em `/planner/cadernos/:notebookId/paginas/:pageId`.
- Exibir retorno ao caderno, título editável, última atualização, estado de salvamento e área de escrita com “Comece a escrever...”.
- Manter o botão “Salvar” acessível em desktop e celular, com estados `Salvando...`, `Salvo` e `Alterações não salvas`.
- Após sucesso, atualizar o cache da página, da lista e do caderno sem duplicar registros; em erro, manter integralmente o texto digitado e permitir nova tentativa.
- Tratar carregamento, erro, página inexistente ou sem acesso com retorno seguro ao caderno.

## Proteção contra perda
- Detectar mudanças comparando título e conteúdo atuais com a última versão salva.
- Alertar ao fechar/recarregar a aba usando o mecanismo do navegador.
- Bloquear navegação interna enquanto houver alterações e oferecer “Continuar editando” ou “Sair sem salvar”.
- Não implementar autosave nesta etapa.

## Alterações previstas
- Banco: nova coluna `content` em `notebook_pages`.
- Serviço e tipos: buscar página individual e salvar título + conteúdo.
- Editor: opção de ocultar a toolbar, preservando comandos básicos de edição.
- Interface: nova tela de página; cards passam a abrir essa tela, mantendo o menu de editar/excluir.
- Navegação: rota, metadados e pré-carregamento da nova tela.
- Validação: fluxo escrever → salvar → sair → voltar; falha de salvamento; proteção de alterações; estados vazio/erro; desktop e mobile.

## Fora do escopo
- Formatação acadêmica, toolbar avançada, blocos, subpáginas, anexos, colaboração, IA, atalhos personalizados e autosave.
