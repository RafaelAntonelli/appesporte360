# Corrigir usuários e pedidos na Equipe

## Resultado
- A tela Equipe mostrará todas as contas cadastradas, inclusive as que ainda aguardam liberação.
- Cada pessoa aparecerá com nome, e-mail e situação atual: sem acesso, professor ou administrador.
- Os botões existentes continuarão liberando, alterando ou removendo o acesso.

## Implementação
- Carregar a relação completa de contas por uma operação protegida, disponível apenas para administradores.
- Unir cada conta aos seus níveis de acesso já registrados.
- Exibir uma mensagem clara caso a relação não possa ser carregada, em vez de mostrar uma tela vazia.
- Manter os dados pessoais indisponíveis para usuários sem permissão administrativa.

## Validação
- Confirmar que as duas contas atuais aparecem na tela, incluindo o pedido sem acesso.
- Testar a liberação e remoção de acesso e verificar erros de compilação e execução.
