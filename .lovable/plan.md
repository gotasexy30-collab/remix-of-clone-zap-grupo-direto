# Unificar painel, vendas PIX e Meta CAPI

## Objetivo
Fazer o site publicado usar somente o banco já configurado na Vercel, sem depender de uma função ausente nesse banco.

## Alterações
- Trocar a leitura do FUNIL por consultas autenticadas diretas às tabelas de eventos e vendas do mesmo banco usado no login.
- Manter os períodos Hoje, Ontem, 7 dias, 30 dias e Todo o período, calculando visitas, checkout, leads, vendas e faturamento com os registros reais.
- Ajustar a confirmação de pagamento e o webhook para registrar vendas usando a chave disponível do mesmo banco, com prevenção de duplicidade.
- Manter o envio de Purchase à Meta somente quando a NexusPag confirmar o pagamento, com valor e moeda BRL.
- Exibir erro visível no painel se o banco negar a consulta, em vez de deixar todos os números silenciosamente em zero.

## Limites
- Não alterar Chat, Gemini, personas, áudios ou upload de imagens.
- Não misturar dados do banco criado pelo remix com o banco mostrado na imagem.

## Validação
- Confirmar que o painel não chama mais `/functions/v1/funnel-metrics`.
- Testar leitura das métricas e o fluxo de confirmação sem criar cobranças reais.
- Verificar que erros de permissão aparecem claramente no painel.
