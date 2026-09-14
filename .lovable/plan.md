# Plano: Evento Purchase na Meta CAPI

## Objetivo
Garantir que a confirmação de um PIX aprovado dispare o evento `Purchase` pelo servidor, usando o token `META_CAPI_TOKEN` já configurado na Vercel.

## Alterações
- Atualizar a função da Vercel que consulta e confirma o pagamento PIX para enviar `Purchase` à Meta somente quando o status retornado for pago/aprovado.
- Reutilizar um identificador estável baseado no ID do pagamento para a deduplicação do evento.
- Enviar no CAPI `value` com o valor confirmado pela NexusPag e `currency: "BRL"`.
- Obter o Pixel ID configurado no painel sem expor o token da CAPI ao navegador.
- Atualizar somente o texto da aba PIXEL para listar `Purchase` entre os eventos disparados.

## Validação
- Executar os testes aplicáveis à rota de pagamento.
- Confirmar que respostas pendentes não disparam `Purchase` e respostas aprovadas montam o payload correto.
- Verificar que nenhum arquivo de Chat, Gemini, personas ou upload de imagens foi alterado, exceto a linha de texto solicitada na aba PIXEL.

## Fora do escopo
- Nenhuma mudança na conversa, Gemini, personas, uploads ou aparência geral do painel.
