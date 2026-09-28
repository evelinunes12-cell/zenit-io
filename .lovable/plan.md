# Página pelo botão Criar

## Objetivo
Adicionar **Nova página** ao menu **Criar** da dashboard e permitir escolher um caderno existente antes de informar o título.

## Implementação
- Criar um diálogo reutilizável para o fluxo global de nova página.
- Carregar os cadernos do usuário usando a consulta já existente.
- Exibir seleção de caderno e título obrigatório da página, com estados de carregamento, erro e ausência de cadernos.
- Criar a página pelo serviço atual, atualizar as listas e contagens em cache e abrir diretamente o editor da página criada.
- Integrar a nova opção ao menu **Criar**, mantendo as opções atuais.

## Validação
- Testar criação com cadernos existentes e abertura do editor correto.
- Verificar os estados sem cadernos, erro e salvamento.
- Conferir o fluxo em desktop e mobile sem alterar a criação interna de páginas no caderno.

## Dados
Nenhuma alteração no banco. Serão reutilizados `notebooks`, `notebook_pages` e as regras de acesso atuais.
