# WhatsApp ↔️ n8n Bridge

Bridge em Node.js que integra o [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) com um fluxo no [n8n](https://n8n.io/). Recebe mensagens de clientes no WhatsApp, encaminha para um webhook HTTP no n8n e expõe um endpoint para que o n8n devolva respostas (texto, botões ou mídia) para o usuário final.

## Requisitos

- Node.js 18 ou superior
- Conta WhatsApp Business ou número comum com acesso ao WhatsApp Web
- Acesso a um servidor HTTP público para hospedar o bridge (para que o n8n consiga consumir as URLs de mídia)

## Instalação

```bash
npm install
```

Crie um arquivo `.env` baseado no modelo:

```bash
cp .env.example .env
```

Edite os valores conforme o seu ambiente:

| Variável                | Descrição                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `PORT`                  | Porta do servidor Express (padrão: `3000`).                                                |
| `N8N_WEBHOOK_URL`       | Webhook HTTP (POST) do n8n que receberá os eventos das mensagens do WhatsApp.              |
| `PUBLIC_BASE_URL`       | URL pública deste bridge (ex.: `https://seu-dominio.com`). Usada para gerar URLs de mídia. |
| `MEDIA_DIR`             | Pasta local para armazenar mídias temporárias (padrão `./media`).                          |
| `WHATSAPP_SESSION_DIR`  | Pasta onde a sessão autenticada do WhatsApp será persistida (padrão `./session`).          |
| `REPLY_API_KEY`         | Chave secreta para autenticar chamadas ao endpoint `/api/reply`.                           |
| `LOG_LEVEL`             | Nível de log aceito pelo [pino](https://github.com/pinojs/pino) (`info`, `debug`, etc.).    |

> ⚠️ Garanta que `PUBLIC_BASE_URL` seja acessível pelo n8n e que esteja configurado atrás de HTTPS quando em produção.

## Executando

### Desenvolvimento

```bash
npm run dev
```

O comando acima usa `nodemon` para recarregar o servidor automaticamente ao alterar os arquivos.

### Produção

```bash
npm start
```

Na primeira execução será exibido um QR Code no terminal; escaneie com o WhatsApp do número que deseja conectar. A sessão autenticada ficará salva no diretório informado em `WHATSAPP_SESSION_DIR`.

## Fluxo de mensagens

1. O cliente envia uma mensagem (texto ou mídia) para o seu número WhatsApp.
2. O bridge captura o evento, salva mídias localmente e dispara um POST para `N8N_WEBHOOK_URL` com os metadados.
3. O n8n processa o evento e, quando desejar enviar uma resposta ao usuário, realiza um POST em `/api/reply` (com o header `X-API-KEY`).
4. O bridge envia a resposta ao usuário via WhatsApp.

### Payload enviado ao n8n para mensagens de texto

```json
{
  "type": "text",
  "from": "5511999999999@c.us",
  "chatId": "5511999999999@c.us",
  "messageId": "ABCDEF1234567890",
  "text": "Olá, gostaria de saber o status do pedido",
  "timestamp": 1699999999
}
```

### Payload enviado ao n8n para mensagens com mídia

```json
{
  "type": "media",
  "mediaKind": "image",
  "from": "5511999999999@c.us",
  "chatId": "5511999999999@c.us",
  "messageId": "ABCDEF1234567890",
  "mimeType": "image/jpeg",
  "mediaUrl": "https://seu-dominio.com/media/3f1b0a8c-2d4e-4e94-8b93-4fe77f4c2ef3.jpg",
  "caption": "Comprovante",
  "timestamp": 1699999999
}
```

A URL de mídia é válida por 24 horas (limpeza automática). O arquivo é armazenado em `MEDIA_DIR` e servido estaticamente pela rota `/media/*`.

## Endpoint de resposta para o n8n

- **URL:** `POST /api/reply`
- **Header obrigatório:** `X-API-KEY: <REPLY_API_KEY>`
- **Body:** JSON conforme exemplos abaixo.

### Resposta de texto

```json
{
  "chatId": "5511999999999@c.us",
  "text": "Pedido #123 confirmado com sucesso!"
}
```

### Resposta com botões

```json
{
  "chatId": "5511999999999@c.us",
  "text": "Confirma o pedido?",
  "buttons": [
    { "id": "approve_all", "text": "✅ Aprovar Tudo" },
    { "id": "edit_lines", "text": "✏️ Editar Itens" }
  ]
}
```

### Resposta com lista

```json
{
  "chatId": "5511999999999@c.us",
  "text": "Selecione uma opção",
  "list": {
    "buttonText": "Abrir opções",
    "sections": [
      {
        "title": "Pedidos",
        "rows": [
          { "id": "order_status", "title": "Consultar status" },
          { "id": "cancel_order", "title": "Cancelar pedido" }
        ]
      }
    ]
  }
}
```

### Resposta com mídia

```json
{
  "chatId": "5511999999999@c.us",
  "media": {
    "url": "https://meu-arquivo.com/preview.pdf",
    "caption": "Seu pedido"
  }
}
```

> O bridge irá baixar o arquivo (até 20 MB) e enviá-lo ao usuário com o caption opcional.

## Webhook no n8n

No n8n, crie um workflow com um nó **Webhook** configurado para `POST` e utilize a URL informada na variável `N8N_WEBHOOK_URL`. Esse nó receberá o payload das mensagens. A partir dele, seu fluxo pode processar as informações e usar um nó **HTTP Request** para chamar `POST /api/reply` quando precisar responder ao usuário.

## Monitoramento & Logs

- Logs estruturados utilizando [pino](https://github.com/pinojs/pino).
- QR Code para autenticação exibido diretamente no terminal (via `qrcode-terminal`).
- Limpeza automática de mídias com mais de 24 horas.
- Tratamento de retentativas com backoff exponencial para envio ao n8n.

## Scripts úteis

| Comando         | Descrição                                   |
| --------------- | ------------------------------------------- |
| `npm run dev`   | Inicia servidor com recarregamento automático. |
| `npm start`     | Inicia servidor em modo produção.              |

## Licença

MIT
