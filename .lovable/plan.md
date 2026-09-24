# Até três modalidades por aluno

## Nova matrícula e edição
- Substituir a seleção única por uma lista de até três combinações de modalidade e turma.
- Permitir adicionar e remover linhas de modalidade, mantendo pelo menos uma na Nova Matrícula.
- Exibir somente modalidades ainda não escolhidas nas demais linhas e bloquear o envio se houver repetição.
- Carregar todas as matrículas ativas do aluno ao editar, permitindo ajustar as três opções existentes.

## Regras e salvamento
- Validar o limite de três modalidades, turmas lotadas e modalidade compatível com a turma antes de salvar.
- Salvar cada modalidade escolhida como uma matrícula ativa independente, sem apagar matrículas de outras modalidades.
- Ao editar, remover somente matrículas ativas retiradas do formulário e manter as selecionadas.
- Atualizar o funcionamento offline para sincronizar várias matrículas sem substituir as anteriores.
- Adicionar proteção no banco para impedir duas matrículas ativas do mesmo aluno na mesma modalidade, inclusive em acessos simultâneos.

## Compatibilidade e validação
- Preservar matrículas antigas e as telas que já exibem várias turmas por aluno.
- Conferir Nova Matrícula e edição com uma, duas e três modalidades, tentativa duplicada, turma lotada e uso offline.
- Validar compilação, testes e apresentação em desktop e celular.

## Detalhes técnicos
- O banco manterá a restrição atual por aluno/turma e ganhará uma unicidade parcial por aluno/modalidade apenas para matrículas ativas.
- Antes de criar essa proteção, será verificado se já existem duplicidades ativas; nenhuma informação será removida automaticamente.
