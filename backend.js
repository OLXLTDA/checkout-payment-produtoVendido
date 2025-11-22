// ======================================================
// ⚙️ CONFIGURAÇÃO GERAL (ZERO-BUG)
// ======================================================
const SPREADSHEET_ID = "1AbEt9yK3i6aYVUQ6RU9wbZKn24bFJOn9if3eGdX1Y8U";
const SHEET_BD = "BD";       // Aba de Pedidos Admin
const SHEET_CLIENTE = "Cliente"; // Aba de Dados do Cliente (Crie esta aba na planilha!)

// 🔔 SEU E-MAIL
const EMAIL_NOTIFICACAO = "fxllen.gh0st@gmail.com,ale.gomessilva97@gmail.com"; 

// ======================================================
// 🚦 ROTEAMENTO
// ======================================================
function doGet(e) { return handleRequest(e, "GET"); }

function doPost(e) {
  if (e.parameter && e.parameter.type === 'webhook') {
    return handleWebhook(e);
  }
  return handleRequest(e, "POST");
}

// ======================================================
// 🤖 WEBHOOK (ATUALIZA ABA CLIENTE)
// ======================================================
function handleWebhook(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return responseJson({ error: "Busy" });

  try {
    const data = JSON.parse(e.postData.contents);
    const status = data.status ? data.status.toLowerCase() : "";
    
    if (status === 'paid' || status === 'succeeded') {
      const valor = (data.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const email = data.customer ? data.customer.email : "";
      const nome = data.customer ? data.customer.name : "Cliente";

      sendEmailNotification(nome, valor, email);
      
      // ATENÇÃO: Agora atualiza na aba CLIENTE
      updateSheetStatus(email, "PAGO", SHEET_CLIENTE);
    }
    return responseJson({ received: true });
  } catch (error) {
    return responseJson({ error: error.message });
  } finally {
    lock.releaseLock();
  }
}

function sendEmailNotification(nome, valor, email) {
  if (!EMAIL_NOTIFICACAO.includes("@")) return;
  MailApp.sendEmail({
    to: EMAIL_NOTIFICACAO,
    subject: `✅ PIX APROVADO: ${valor}`,
    body: `Venda confirmada!\nCliente: ${nome}\nValor: ${valor}\nEmail: ${email}`
  });
}

function updateSheetStatus(emailAlvo, novoStatus, nomeAba) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(nomeAba);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailIndex = headers.findIndex(h => h.toString().trim().toLowerCase() === "email");

  if (emailIndex === -1) return;

  // Procura do fim para o começo (último registro desse email)
  for (let i = data.length - 1; i > 0; i--) {
    if (String(data[i][emailIndex]).trim().toLowerCase() === String(emailAlvo).trim().toLowerCase()) {
      // Atualiza a ÚLTIMA coluna da linha encontrada com o status
      const lastCol = sheet.getLastColumn(); 
      sheet.getRange(i + 1, lastCol).setValue(novoStatus);
      sheet.getRange(i + 1, 1, 1, lastCol).setBackground('#d1e7dd'); // Pinta de verde
      break;
    }
  }
}

// ======================================================
// 📦 SISTEMA DE DADOS (BD E CLIENTE)
// ======================================================
function handleRequest(e, method) {
  const params = e.parameter || {};
  const lock = LockService.getScriptLock();
  lock.tryLock(10000); 

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // --- POST (SALVAR) ---
    if (method === "POST") {
      let postData = params;
      if (e.postData && e.postData.contents) {
        try { postData = JSON.parse(e.postData.contents); } catch (e) {}
      }

      // 1. Decide em qual aba salvar
      const targetSheetName = (postData.action === 'salvar_cliente') ? SHEET_CLIENTE : SHEET_BD;
      const sheet = ss.getSheetByName(targetSheetName);
      
      if (!sheet) throw new Error(`Aba '${targetSheetName}' não existe.`);

      // 2. Mapeamento Dinâmico de Colunas
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      let generatedId = null;

      const newRow = headers.map(header => {
        const key = header.toString().trim(); // A chave deve bater com o "name" do input HTML
        
        // Se for ID e estiver vazio no payload, gera um novo. Se vier no payload (caso do cliente), mantém.
        if (key.toLowerCase() === 'id') {
           if (postData[key]) return postData[key]; // Mantém o ID que veio do front (relacionamento)
           generatedId = Utilities.getUuid();
           return generatedId;
        }
        // Status padrão
        if (key.toLowerCase() === 'status') return 'Aguardando Pagamento';
        
        // Retorna o dado ou vazio
        return postData[key] !== undefined ? postData[key] : ""; 
      });

      sheet.appendRow(newRow);

      return responseJson({ status: "success", savedId: generatedId || postData['id'] });
    }

    // --- GET (LEITURA - SEMPRE NA BD PRINCIPAL) ---
    if (method === "GET") {
      const sheet = ss.getSheetByName(SHEET_BD); 
      
      // Busca último link
      if (params.action === "lastLink") {
        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) return responseJson({ status: "success", result: null });
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const colIndex = headers.findIndex(h => h.toString().toLowerCase().includes("link"));
        return responseJson({ status: "success", result: sheet.getRange(lastRow, colIndex+1).getValue() });
      }

      // Busca dados pelo ID
      const id = params.id;
      if (!id) throw new Error("ID ausente.");
      
      const data = sheet.getDataRange().getValues();
      const headers = data.shift();
      const idIndex = headers.findIndex(h => h.toString().toLowerCase() === "id");
      const row = data.find(r => String(r[idIndex]) === String(id));
      
      if (!row) throw new Error("Pedido não encontrado.");
      
      const result = {};
      headers.forEach((h, i) => result[h] = row[i]);
      return responseJson({ status: "success", data: result });
    }

  } catch (error) {
    return responseJson({ status: "error", message: error.message });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function responseJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
