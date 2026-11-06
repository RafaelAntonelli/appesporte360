# Class Mate

Preciso criar um software para windows e android para realizar matriculas e sistema de presença, pode me ajudar com isso?

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://easy-attend-register.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7a8e031b-b6b5-47c9-8a73-4f9ae3539406).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Acesso sem internet — Esporte 360

- Abra conectado com a conta da equipe e espere aparecer “Listas salvas para usar sem internet”. A primeira abertura precisa de internet.
- No site publicado, a abertura guarda apenas os arquivos do app e um documento público sem dados pessoais. Listas necessárias ficam no aparelho, separadas por conta; não compartilhe um aparelho desbloqueado.
- Sem conexão, Alunos e Turmas permitem consulta e a chamada permite marcar/desmarcar. Licenças permanecem justificadas. Fotos e documentos não são baixados para uso offline.
- Ao conectar, as ações são enviadas em ordem, com nova verificação da conta e permissão. Registros mais recentes da equipe são preservados. Uma falha segura as próximas ações; o aviso permite tentar novamente ou descartar explicitamente.
- Sair com pendências pede confirmação; as pendências ficam no aparelho para a mesma conta. A reabertura sem internet não libera funções de administrador.
- Não há registro de abertura offline na prévia/desenvolvimento. A abertura fechando/reabrindo o app, a instalação e a atualização precisam ser conferidas depois de publicar, em Android real.
- Conferência local: 99 testes passaram; lista real de 280 alunos/35 turmas/292 matrículas apenas lida; marcas e desfazer testados com dados isolados no navegador e fila descartada. Nenhuma presença real criada; falta automática permaneceu desligada. Ainda não verificados: envio de presença válida real, professor, reabertura totalmente sem rede do app publicado e recebimento de push no Android.
