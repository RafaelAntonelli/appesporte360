- [x] Padronizar todos os códigos de matrícula como alfanuméricos únicos de exatamente 7 caracteres.
- [x] Garantir letras e números aleatórios em cada código de matrícula de 7 caracteres.
- [x] Exibir o código de matrícula nas listas de alunos e em todos os relatórios exportados.
- [x] Corrigir a criação da planilha no backup e validar o envio.
- [x] Excluir alunos inativados das notificações de atestados vencidos e vencendo, com testes de regressão.
- [x] Adicionar as listas de escolas públicas e privadas ao formulário de matrícula conforme a rede selecionada.
- [x] Adicionar contato pelo WhatsApp no cadastro, nos perfis, nas cinco notificações e na lista de atestados dos relatórios, com testes dos links.
- [x] Aplicar proteção à inicialização publicada, validar os três testes de regressão e a abertura local.
- [ ] Publicar a correção e confirmar a abertura no site público; depende da publicação pelo usuário.
- [x] Permitir pesquisar escolas e adicionar escola fora da lista no formulário de matrícula.
- [x] Adicionar foto da Ficha no formulário, perfil e planilha exportada; teste de Excel aprovado.
- [ ] Conferir leitura e exportação da Ficha real pela tela; não há nenhuma Ficha anexada na base atual. Leitura sintética, revisão e troca de anexo validadas sem salvar cadastro; link na planilha validado em teste.
- [x] Integrar IA autenticada com permissões, bloqueio persistente e revisão humana.
- [x] Ler o anexo Ficha e revisar os campos sugeridos sem salvar matrícula; JPG, PNG e WebP até 8 MB. PDFs permanecem anexados, mas o modelo disponível não aceita PDF.
- [x] Calcular relatórios de IA com paginação, filtros cruzados e alunos únicos por grupo; média real de 50 ativos conferida em 11,44 anos e comparação por modalidade/turno validada.
- [x] Gerar rascunhos editáveis de WhatsApp sem dados pessoais ou envio automático; texto revisado presente no link.
- [x] Sugerir mapeamento de cabeçalhos na importação mantendo validações; sugestão e correção manual confirmadas sem importar.
- [x] Validar as quatro chamadas reais, cálculos, revisão e proteção; 23 testes aprovados e quatro acessos diretos sem autenticação recusados.

## Área do aluno (pedido de 20/10)
- [x] Etapa 1: aba Aluno no login (CPF ou matrícula + nascimento), limites de tentativas e aviso de inativo.
- [x] Etapa 2: liberação presencial do aparelho por QR Code; seção Acessos dos alunos na Equipe.
- [x] Etapa 3: consentimento e Salvar login neste aparelho.
- [x] Etapa 4: área do aluno com Meu dia, Crachá e Avisos.
- [x] Etapa 5: perfil do aluno com edição de contatos e foto.
- [x] Etapa 6: tela Avisos (só administradores), avisos na área do aluno e envio pelo Firebase prontos.
- [x] Notificações no celular: conexão do Firebase ligada e envio de teste aceito.
- [ ] Confirmar o recebimento num celular Android real; depende de um aluno ativar as notificações no site publicado.
- [x] Lembretes 30 e 15 minutos antes da aula: agendador a cada 5 min, sem repetição, aluno pode desligar; alunos em licença não recebem.
- [ ] Confirmar a chegada de um lembrete num celular real; depende de um aluno com notificações ativas no site publicado.
- [x] Etapa 7: menu rolável, Sair no topo do celular, fila de espera recolhida no Painel.
- [x] Verificação final com aluno de teste e limpeza dos dados de teste.

- [x] Equipe: aba Permissões dos professores só abre com a senha do administrador (vale 15 min, bloqueia ao sair da aba); gravação sem senha recusada pelo banco.

## Atualização de arquitetura e backup (pedido de 20/10)
- [x] Fila offline em ordem exata (ID único, horário UTC, envio um a um, para no primeiro erro, opção de descartar).
- [x] Links de fotos e documentos sempre temporários; validade configurável em Backup → Links e privacidade (padrão 24 h, máximo 24 h).
- [x] Avisos sempre guardados na central da Área do Aluno, com aviso claro em aparelhos sem notificações.
- [x] Fotos, documentos e fichas reduzidas e comprimidas no aparelho antes do envio e da leitura por IA.
- [x] Planilha do backup sem links, com todos os dados e o código de matrícula.
- [x] Arquivos no Drive com nome CODIGO_TIPO.extensão; arquivos antigos renomeados no backup de 20/10.
- [x] Restauração pelo Drive (planilha + arquivos) ligando cada arquivo ao aluno pelo código; testada com aluno temporário.

## Novo visual (pedido de 20/10)
- [x] Cópia do visual anterior guardada para poder voltar atrás.
- [x] Etapa 1: cores azul-marinho/azul/ciano, fontes Sora e Manrope, botões em degradê, modo escuro salvo no aparelho sem piscar.
- [x] Etapa 2: etiqueta única de situação (Ativo verde, Licença amarelo, Atestado vencido vermelho, Inativo cinza) em Alunos, Turmas e Presença.
- [x] Etapa 3: menu lateral com Modo escuro e Sair; no celular, topo azul-marinho, 4 botões + "Mais".
- [x] Etapa 4: login com topo em ondas, abas Equipe/Aluno, "Lembrar meu e-mail" (só o e-mail).
- [x] Etapa 5: Alunos com tabela de títulos fixos, cartões no celular, chips de situação, "Mais filtros" e menu "⋯".
- [x] Etapa 6: chamada com botões grandes, barra "X de Y marcados" e "Marcar todos como presentes" em Presença e Turmas.
- [x] Etapa 7: conferido no computador e no celular (360 px), claro e escuro, sem tela mais larga que o celular.
- [ ] Conferir com uma conta de professor que os itens bloqueados continuam ocultos; depende de uma conta de professor para teste.

## Ajustes do menu, barra superior, Painel e Turmas (pedido de 22/10)
- [x] Cópia do visual atual guardada (.lovable/visual-anterior-menu/).
- [x] Etapa 1: foto (ou iniciais), nome e papel no menu e no topo do celular, abrindo Meu perfil; tela Meu perfil com foto e nome.
- [x] Etapa 2: imagem do Programa Esporte 360 em pé no fundo do menu, com véu na cor do menu (claro e escuro).
- [x] Etapa 3: faixa SECULJE à direita da barra superior com degradê sem emenda.
- [x] Etapa 4: Painel sem busca e sem os cartões; Nova matrícula só para administradores.
- [x] Etapa 5: três cartões de resumo em Turmas (32 / 1.280 / 88 conferidos com os cartões das turmas); filtros e botões quebram de linha.
- [ ] Conferir com uma conta de professor que "Nova matrícula" não aparece no Painel; não há conta de professor cadastrada.

## Nova tela de login (pedido de 22/10, noite)
- [x] Cópia da tela de login guardada (.lovable/visual-anterior-login/).
- [x] Fundo de ondas (em pé no celular, deitado a partir de 768 px), véu e brilho atrás da área de login.
- [x] Logo Esporte 360 e selo SECULJE lado a lado no topo, com linha fina entre eles.
- [x] Área de login centralizada (até 448 px), faixa em degradê, "Esporte 360", títulos por aba e tela.
- [x] Abas em botão duplo, "Lembrar meu e-mail" e "Esqueci minha senha" na mesma linha, Entrar com seta e "Entrando...".
- [x] Conferido no celular, 1000×700 e 1920×1080, claro e escuro, sem rolar.
- [ ] Entrar com uma conta da equipe de verdade; depende da senha de uma conta da equipe.

## Letras mais visíveis no menu lateral (pedido de 23/10)
- [x] Cópia do menu lateral guardada (.lovable/visual-anterior-menu-lateral/).
- [x] Botões sem caixa, letras brancas semi-negrito com sombra leve, ícones de 20 px, destaque ao passar o mouse.
- [x] Tela aberta com fundo suave, faixa azul de 3 px e ícone azul; rodapé (Meu perfil, Modo escuro, Sair) no mesmo estilo e mais alto.
- [x] Conferido no computador, claro e escuro, como administrador; celular sem mudanças.
- [ ] Conferir como professor; não há conta de professor cadastrada.
