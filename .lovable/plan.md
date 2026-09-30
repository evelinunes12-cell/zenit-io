# Separar Cadernos do Planner

## Objetivo
Transformar Cadernos em uma área própria da navegação, mantendo o fluxo atual de criação rápida na dashboard.

## Alterações
- Adicionar **Cadernos** como item independente no menu lateral, com destaque ativo também nas telas internas de caderno e página.
- Remover o atalho **Cadernos** do cabeçalho interno do Planner.
- Mover as rotas de `/planner/cadernos` para `/cadernos`, incluindo detalhes e editor de páginas.
- Atualizar todos os links, redirecionamentos, pré-carregamento e informações de página para os novos endereços.
- Manter **Novo caderno** e **Nova página** no botão **Criar** da dashboard, usando os mesmos diálogos e regras atuais.
- Preservar compatibilidade: os endereços antigos do Planner redirecionarão para os novos endereços de Cadernos.
- Validar navegação e criação em desktop e celular.

## Detalhes técnicos
- Nenhuma alteração no banco de dados ou nos registros existentes.
- O item Cadernos usará o menu lateral já existente e a rota protegida própria `/cadernos`.
- A navegação inferior móvel permanecerá com os quatro itens atuais; Cadernos continuará acessível pelo menu lateral móvel e pelo botão Criar, evitando comprimir essa barra.
