# Plano: Atualizar URL de Produção

O objetivo é atualizar a URL base do backend para apontar para a nova infraestrutura na Vercel fornecida pelo usuário.

## Alterações Propostas

### Frontend
- **Configuração**: Atualizar `BASE_URL` em `src/constants.ts` para `https://clone-zap-grupo-direto-20.vercel.app`.
- **Lógica de Chat**: Garantir que o `src/pages/Index.tsx` continue consumindo a `BASE_URL` corretamente para ativos como áudios e imagens dinâmicas.

## Detalhes Técnicos
- A constante `BASE_URL` é centralizada e usada para construir caminhos de arquivos estáticos (áudios) e chamadas de geração de imagem.
- A alteração reflete a mudança do Render para a Vercel conforme solicitado.
