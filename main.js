// --- Supabase Configuration ---
console.log('Main.js loaded - v1.0.6 - RPC ATOMIC ACTIVE');
const SUPABASE_URL = 'https://sigshysbziurucfsmesy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZ3NoeXNieml1cnVjZnNtZXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTQwMzAsImV4cCI6MjA4ODIzMDAzMH0.ooBcY83lVgAgvaN9WuUvXGyHiamRgMx3QEyQEgiq6ek';

// Renomeado para evitar conflito com o objeto global 'supabase' injetado pelo CDN
const dbClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- Core Application State ---
// --- Utils ---
const utils = {
    // Formata YYYY-MM-DD para DD/MM/YYYY sem deslocamento de fuso
    formatDate(dateStr) {
        if (!dateStr) return '---';
        if (dateStr.includes('T')) {
            const date = new Date(dateStr);
            return date.toLocaleDateString();
        }
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    },
    // Formata ISO ou DateString para Local Time (Data e Hora)
    formatDateTime(isoStr) {
        if (!isoStr) return '---';
        // Se for apenas data YYYY-MM-DD, trata manualmente para não deslocar fuso
        if (isoStr.length === 10 && isoStr.includes('-')) {
            return this.formatDate(isoStr) + ' (Hora não registrada)';
        }
        // Para ISO completa, garante interpretação local
        const date = new Date(isoStr);
        return date.toLocaleString();
    },
    // Retorna a data/hora atual local em string
    getCurrentDateTime() {
        return new Date().toLocaleString();
    }
};

const state = {
    currentUser: null,
    selectedItems: [],
    signatureData: null,
    db: {
        users: [],
        equipment: [],
        loans: []
    }
};

// --- Data Persistence Layer (Supabase) ---
const storage = {
    async loadAll() {
        if (!dbClient) return;
        ui.showLoading(true);
        try {
            const [eqRes, loanRes, userRes] = await Promise.all([
                dbClient.from('equipamentos').select('*').order('id', { ascending: true }),
                dbClient.from('emprestimos').select('*').order('data', { ascending: false }),
                dbClient.from('usuarios').select('*')
            ]);

            if (eqRes.error) throw eqRes.error;
            if (loanRes.error) throw loanRes.error;
            if (userRes.error) throw userRes.error;

            state.db.equipment = eqRes.data || [];
            state.db.loans = loanRes.data || [];
            state.db.users = userRes.data || [];

        } catch (err) {
            console.error('Erro ao carregar dados:', err);
            ui.notify('Erro ao conectar com o banco de dados', 'error');
        }
        ui.showLoading(false);
    }
};

// --- UI Controller ---
const ui = {
    showLoading(show) {
        document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
    },

    async showPage(pageId) {
        // Refresh data when switching to important pages
        if (['dashboard', 'history', 'equipment', 'new-loan'].includes(pageId)) {
            await storage.loadAll();
        }

        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        document.getElementById(`page-${pageId}`).style.display = 'block';

        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.toggle('active', l.dataset.page === pageId);
        });

        if (pageId === 'dashboard') this.renderDashboard();
        if (pageId === 'new-loan') this.renderLoanItems();
        if (pageId === 'history') this.renderHistory();
        if (pageId === 'admin') {
            this.renderInventory();
            this.renderAdmin();
        }

        // Close sidebar on mobile after navigation
        if (window.innerWidth <= 1024) {
            this.toggleSidebar(false);
        }
    },

    toggleSidebar(show) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const isActive = sidebar.classList.contains('active');
        
        const shouldShow = show !== undefined ? show : !isActive;
        
        sidebar.classList.toggle('active', shouldShow);
        overlay.classList.toggle('active', shouldShow);
    },

    toggleAuth(showLogin) {
        document.getElementById('loginView').style.display = showLogin ? 'block' : 'none';
        document.getElementById('registerView').style.display = showLogin ? 'none' : 'block';
    },

    notify(msg, type = 'success') {
        const area = document.getElementById('notificationArea');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> ${msg}`;
        area.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },

    renderDashboard() {
        const stats = {
            total: state.db.equipment.length,
            available: state.db.equipment.filter(e => e.status === 'available').length,
            active: state.db.loans.filter(l => l.status === 'active').length
        };

        document.getElementById('stat-total').innerText = stats.total;
        document.getElementById('stat-available').innerText = stats.available;
        document.getElementById('stat-active').innerText = stats.active;

        // Verificar atrasos
        const today = new Date().toISOString().split('T')[0];
        const lateLoans = state.db.loans.filter(l => l.status === 'active' && l.data_prevista && l.data_prevista < today);
        const banner = document.getElementById('late-alert-banner');
        if (banner) {
            banner.style.display = lateLoans.length > 0 ? 'block' : 'none';
        }

        const recent = state.db.loans.slice(0, 5);
        const tbody = document.getElementById('recent-table-body');
        tbody.innerHTML = recent.map(l => {
            const itemsList = typeof l.itens === 'string' ? JSON.parse(l.itens) : l.itens;
            const isLate = l.status === 'active' && l.data_prevista && l.data_prevista < today;
            return `
                <tr style="border-bottom:1px solid var(--gray-100)">
                    <td style="padding:1rem">${utils.formatDate(l.data)}</td>
                    <td style="padding:1rem"><b>${l.usuario_nome}</b></td>
                    <td style="padding:1rem">${(itemsList || []).map(i => i.icone).join(' ')}</td>
                    <td style="padding:1rem">
                        <span style="background:${isLate ? 'var(--danger)' : (l.status === 'active' ? 'var(--warning)' : 'var(--success)')}; color:white; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem">
                            ${isLate ? 'ATRASADO' : (l.status === 'active' ? 'ATIVO' : 'DEVOLVIDO')}
                        </span>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--gray-600)">Sem atividades</td></tr>';
    },

    renderLoanItems() {
        // Pre-fill user data
        if (state.currentUser) {
            document.getElementById('loan-name').value = state.currentUser.nome;
            document.getElementById('loan-email').value = state.currentUser.email;
            document.getElementById('loan-cpf').value = state.currentUser.usuario_id || '';
            document.getElementById('loan-date-start').value = new Date().toISOString().split('T')[0];
        }

        const grid = document.getElementById('loan-items-grid');
        grid.innerHTML = state.db.equipment.map(e => `
            <div class="equip-card ${e.status !== 'available' ? 'disabled' : ''} ${state.selectedItems.includes(e.id) ? 'selected' : ''}" 
                 style="${e.status !== 'available' ? 'opacity:0.5; pointer-events:none' : ''}; position:relative">
                <button onclick="event.stopPropagation(); ui.showEquipInfo(${e.id})" 
                        style="position:absolute; top:0.5rem; right:0.5rem; background:white; border:1px solid var(--gray-300); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.8rem; z-index:2" 
                        title="Ver detalhes">ℹ️</button>
                <div onclick="actions.toggleItem(${e.id})" style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center">
                    <span class="equip-icon">${e.icone}</span>
                    <div class="equip-name">${e.nome}</div>
                    <div class="equip-code">${e.codigo}</div>
                </div>
            </div>
        `).join('');
    },

    toggleThirdPartyFields() {
        const isThird = document.getElementById('loan-is-third-party').checked;
        document.getElementById('third-party-fields').style.display = isThird ? 'block' : 'none';
        document.getElementById('loan-third-name').required = isThird;
        document.getElementById('loan-third-cpf').required = isThird;
    },



    previewEquipPhoto(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const preview = document.getElementById('eq-photo-preview');
                preview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover">`;
                state.equipPhotoData = e.target.result;
            }
            reader.readAsDataURL(input.files[0]);
        }
    },

    renderHistory() {
        const list = document.getElementById('history-list');
        // Filtro de privacidade: Admin vê tudo, Usuário vê apenas o dele
        const filteredLoans = state.currentUser.cargo === 'admin'
            ? state.db.loans
            : state.db.loans.filter(l => l.email === state.currentUser.email);

        list.innerHTML = filteredLoans.map(l => {
            const itemsList = typeof l.itens === 'string' ? JSON.parse(l.itens) : l.itens;
            return `
                <div style="padding:1.5rem; border:1px solid var(--gray-200); border-radius:var(--radius-lg); margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center">
                    <div>
                        <h4 style="margin-bottom:0.25rem">#${l.id} - ${l.usuario_nome}</h4>
                        <p style="color:var(--gray-600); font-size:0.875rem">${(itemsList || []).map(i => i.nome).join(', ')}</p>
                        <small>${utils.formatDateTime(l.data)}</small>
                    </div>
                    <div style="display:flex; gap:0.5rem; align-items:center">
                        <span style="font-weight:700; color:${l.status === 'active' ? 'var(--warning)' : 'var(--success)'}">${l.status === 'active' ? 'ATIVO' : 'DEVOLVIDO'}</span>
                        ${l.status === 'active' ? `<button onclick="actions.returnLoan(${l.id})" class="btn" style="width:auto; padding:0.5rem 0.8rem; font-size:0.8rem; background:var(--primary); color:white">Devolver</button>` : ''}
                        <button onclick="actions.viewTerm(${l.id})" class="btn" style="width:auto; padding:0.5rem 0.8rem; font-size:0.8rem">Ver</button>
                        <button onclick="ui.printTermExternal(${JSON.stringify(l).replace(/"/g, '&quot;')})" class="btn" style="width:auto; padding:0.5rem 0.8rem; font-size:0.8rem; background:var(--gray-800); color:white">🖨️</button>
                    </div>
                </div>
            `;
        }).join('') || '<p style="text-align:center; color:var(--gray-600)">Nenhum registro</p>';
    },

    renderInventory() {
        const list = document.getElementById('inventory-list');
        list.innerHTML = state.db.equipment.map(e => `
            <div style="padding:1rem; display:flex; justify-content:space-between; border-bottom:1px solid var(--gray-200)">
                <div style="display:flex; gap:1rem; align-items:center">
                    <span style="font-size:1.5rem">${e.icone}</span>
                    <div>
                        <strong>${e.nome}</strong><br>
                        <small>${e.codigo} | ${e.categoria}</small>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:2rem">
                    <span style="color:${e.status === 'available' ? 'var(--success)' : (e.status === 'in_use' ? 'var(--warning)' : 'var(--danger)')}">
                        ${e.status === 'available' ? 'Disponível' : (e.status === 'in_use' ? 'Em Uso' : e.status)}
                    </span>
                    <div style="display:flex; gap:0.5rem">
                        <button onclick="ui.editEquip(${e.id})" class="btn" style="width:auto; padding:0.4rem 0.8rem; font-size:0.75rem; background:var(--gray-200)">✏️</button>
                        <button onclick="actions.deleteItem(${e.id})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.875rem">Remover</button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    editEquip(id) {
        const eq = state.db.equipment.find(e => e.id === id);
        if (!eq) return;

        document.getElementById('eq-edit-id').value = eq.id;
        document.getElementById('eq-name').value = eq.nome;
        document.getElementById('eq-code').value = eq.codigo;
        document.getElementById('eq-cat').value = eq.categoria;
        document.getElementById('eq-desc').value = eq.descricao || '';

        const preview = document.getElementById('eq-photo-preview');
        if (eq.foto_base64) {
            preview.innerHTML = `<img src="${eq.foto_base64}" style="width:100%; height:100%; object-fit:cover">`;
            state.equipPhotoData = eq.foto_base64;
        } else {
            preview.innerHTML = `<span style="font-size:1.5rem">📷</span>`;
            state.equipPhotoData = null;
        }

        const btn = document.querySelector('#addEquipForm button[type="submit"]');
        btn.innerText = 'Salvar Alterações';
        btn.classList.add('btn-warning');

        // Scroll to form
        document.getElementById('addEquipForm').scrollIntoView({ behavior: 'smooth' });
    },

    clearEquipForm() {
        document.getElementById('addEquipForm').reset();
        document.getElementById('eq-edit-id').value = '';
        document.getElementById('eq-photo-preview').innerHTML = `<span style="font-size:1.5rem">📷</span>`;
        state.equipPhotoData = null;

        const btn = document.querySelector('#addEquipForm button[type="submit"]');
        btn.innerText = 'Adicionar Item';
        btn.classList.remove('btn-warning');
    },

    showEquipInfo(id) {
        const eq = state.db.equipment.find(e => e.id === id);
        if (!eq) return;

        const title = document.getElementById('detailsModalTitle');
        const subtitle = document.getElementById('detailsModalSubtitle');
        const list = document.getElementById('detailsList');

        title.innerText = `${eq.icone} ${eq.nome}`;
        subtitle.innerText = `Código: ${eq.codigo} | Categoria: ${eq.categoria}`;

        list.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:1.5rem">
                ${eq.foto_base64 ? `
                    <div style="width:100%; border-radius:8px; overflow:hidden; border:1px solid var(--gray-200); background:#f9f9f9">
                        <img src="${eq.foto_base64}" style="width:100%; display:block; height:auto">
                    </div>
                ` : ''}
                <div style="padding:1rem; background:var(--gray-50); border-radius:8px; border-left:4px solid var(--primary)">
                    <h4 style="margin-bottom:0.5rem">Descrição e Acessórios</h4>
                    <p style="white-space:pre-wrap; color:var(--gray-700); line-height:1.6">${eq.descricao || 'Nenhuma descrição informada para este item.'}</p>
                </div>
            </div>
        `;

        document.getElementById('detailsModal').classList.add('active');
    },

    renderAdmin() {
        const tbody = document.getElementById('admin-user-table');
        if (!tbody) return;

        tbody.innerHTML = state.db.users.map(u => `
            <tr style="border-bottom:1px solid var(--gray-100)">
                <td style="padding:1rem"><b>${u.nome}</b></td>
                <td style="padding:1rem; color:var(--gray-600)">${u.email}</td>
                <td style="padding:1rem">
                    <span class="badge ${u.cargo === 'admin' ? 'badge-success' : 'badge-gray'}">
                        ${u.cargo.toUpperCase()}
                    </span>
                </td>
                <td style="padding:1rem">
                    <div style="display:flex; gap:0.5rem">
                        <button onclick="ui.openUserModal('${u.id}')" class="btn" style="width:auto; padding:0.4rem 0.8rem; font-size:0.75rem; background:var(--gray-200)">✏️</button>
                        <button onclick="actions.deleteUser('${u.id}')" class="btn" style="width:auto; padding:0.4rem 0.8rem; font-size:0.75rem; background:var(--danger); color:white">🗑️</button>
                        <button onclick="actions.updateUserCargo('${u.id}', '${u.cargo === 'admin' ? 'user' : 'admin'}')" 
                                class="btn" style="width:auto; padding:0.4rem 0.8rem; font-size:0.75rem; background: ${u.cargo === 'admin' ? 'var(--gray-200)' : 'var(--primary)'}; color: ${u.cargo === 'admin' ? 'var(--dark)' : 'white'}">
                            ${u.cargo === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
                        </button>
                    </div>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--gray-600)">Nenhum usuário encontrado</td></tr>';
    },

    openUserModal(userId = null) {
        const modal = document.getElementById('userModal');
        const title = document.getElementById('userModalTitle');
        const form = document.getElementById('userForm');
        form.reset();

        if (userId) {
            const user = state.db.users.find(u => u.id === userId);
            if (!user) return;
            title.innerText = 'Editar Usuário';
            document.getElementById('user-edit-id').value = user.id;
            document.getElementById('user-name').value = user.nome;
            document.getElementById('user-email').value = user.email;
            document.getElementById('user-cpf').value = user.usuario_id || '';
            document.getElementById('user-cargo').value = user.cargo;
            document.getElementById('user-pass-container').style.display = 'none';
            document.getElementById('user-pass').required = false;
        } else {
            title.innerText = 'Novo Usuário';
            document.getElementById('user-edit-id').value = '';
            document.getElementById('user-pass-container').style.display = 'block';
            document.getElementById('user-pass').required = true;
        }
        modal.classList.add('active');
    },

    closeUserModal() { document.getElementById('userModal').classList.remove('active'); },

    initCanvas() {
        const canvas = document.getElementById('signatureCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let drawing = false;

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (e.clientX || e.touches?.[0].clientX) - rect.left,
                y: (e.clientY || e.touches?.[0].clientY) - rect.top
            };
        };

        const start = (e) => { drawing = true; ctx.beginPath(); ctx.moveTo(getPos(e).x, getPos(e).y); };
        const move = (e) => { if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
        const end = () => { if (drawing) { drawing = false; state.signatureData = canvas.toDataURL(); } };

        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);

        canvas.addEventListener('touchstart', start);
        canvas.addEventListener('touchmove', move);
        canvas.addEventListener('touchend', end);

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
    },

    clearSignature() {
        const canvas = document.getElementById('signatureCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        state.signatureData = null;
    },

    openModal(loan) {
        const itemsList = typeof loan.itens === 'string' ? JSON.parse(loan.itens) : loan.itens;
        const content = document.getElementById('termContent');
        const isThird = !!loan.terceiro_nome;

        // Fallbacks caso o banco não tenha retornado todas as colunas
        const safeEmail = loan.email || (state.currentUser ? state.currentUser.email : '---');
        const safeDepto = loan.depto || '---';
        const safeDataPrevista = utils.formatDate(loan.data_prevista);

        const getTermMarkup = (copyLabel, signatureLabel, isReturnCopy = false) => {
            const isReturned = loan.status === 'returned';
            const realReturnDate = loan.data_devolucao ? new Date(loan.data_devolucao) : null;
            const plannedReturnDate = loan.data_prevista ? new Date(loan.data_prevista) : null;

            let delayStatus = '';
            if (isReturnCopy && realReturnDate && plannedReturnDate) {
                const diff = realReturnDate - plannedReturnDate;
                delayStatus = diff > (1000 * 60 * 60 * 24)
                    ? '<span style="color:var(--error); font-weight:bold">⚠️ DEVOLVIDO COM ATRASO</span>'
                    : '<span style="color:var(--success); font-weight:bold">✅ DEVOLVIDO NO PRAZO</span>';
            }

            return `
            <div class="term-copy">
                <div style="display:flex; justify-content:space-between; align-items:start; padding-bottom:1rem; border-bottom:3px solid var(--primary); margin-bottom:2rem">
                    <div>
                        <h1 style="font-size:1.5rem; color:var(--primary); margin:0">TERMO DE RESPONSABILIDADE</h1>
                        <p style="color:var(--gray-600); margin:0.25rem 0">Setor de Suporte Tecnológico - Nutrição Animal | <small>${copyLabel}</small></p>
                    </div>
                    <div style="text-align:right">
                        <span style="background:var(--gray-100); padding:0.5rem; border-radius:4px; font-weight:bold">ID: #${loan.id}</span>
                        <div style="font-size:0.7rem; color:var(--gray-400); margin-top:0.25rem">${isReturnCopy ? utils.getCurrentDateTime() : utils.formatDateTime(loan.data)}</div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 120px; gap:2rem; margin-bottom:2rem">
                    <div style="font-size:0.9rem; line-height:1.6">
                        <p><b>DADOS DO SOLICITANTE:</b></p>
                        <p>Nome: ${loan.usuario_nome}</p>
                        <p>E-mail: ${safeEmail}</p>
                        <p>CPF/Matrícula: ${(!loan.usuario_id || loan.usuario_id.length > 20) ? '' : loan.usuario_id}</p>
                        <p>Departamento: ${safeDepto}</p>
                        
                        ${isReturnCopy && realReturnDate ? `
                            <div style="margin-top:0.5rem; padding:0.5rem; background:var(--gray-50); border-radius:4px">
                                <p><b>DADOS DA DEVOLUÇÃO:</b></p>
                                <p>Data Prevista: ${safeDataPrevista}</p>
                                <p>Data Real: ${utils.formatDate(loan.data_devolucao)}</p>
                                <p>Status: ${delayStatus}</p>
                            </div>
                        ` : ''}

                        ${isThird ? `
                            <div style="margin-top:1rem; padding:1rem; background:var(--gray-50); border-radius:8px; border:1px solid var(--gray-200)">
                                <p style="color:var(--primary); font-weight:bold; margin-top:0">RETIRADA POR TERCEIRO:</p>
                                <p>Nome: ${loan.terceiro_nome}</p>
                                <p>CPF: ${loan.terceiro_cpf}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div style="padding:1.5rem; border:1px solid var(--gray-200); border-radius:8px; background:#fff; font-family:serif; text-align:justify; font-size:0.95rem; line-height:1.5">
                    <p>Pelo presente termo, o colaborador acima identificado declara ter recebido em perfeito estado de conservação os equipamentos listados abaixo:</p>
                    <ul style="margin:1rem 0; padding-left:1.5rem">
                        ${(itemsList || []).map(i => `<li><b>${i.nome}</b> (Série: ${i.codigo})</li>`).join('')}
                    </ul>
                    <p>O solicitante assume inteira responsabilidade pela guarda, conservação e uso adequado dos bens, comprometendo-se a:</p>
                    <ol style="margin:1rem 0; padding-left:1.5rem; font-size:0.85rem">
                        <li>Utilizar os equipamentos exclusivamente para fins profissionais vinculados às atividades da empresa.</li>
                        <li>Não permitir o uso por pessoas não autorizadas.</li>
                        <li>Comunicar imediatamente qualquer defeito, furto ou extravio.</li>
                        <li>Devolver os equipamentos na data prevista: <b>${safeDataPrevista}</b>.</li>
                    </ol>
                    <p style="font-size:0.85rem; margin-top:1rem; border-top: 1px solid var(--gray-100); padding-top: 1rem">O equipamento deverá ser devolvido pelo colaborador nas mesmas condições em que foi entregue, em pleno funcionamento, exceto pelos desgastes naturais decorrentes do uso normal.</p>
                </div>

                <div style="margin-top:3rem; display:grid; grid-template-columns: 1fr 1fr; gap:2rem; text-align:center; font-size:0.85rem">
                    <div>
                        <div style="border-top:1px solid #000; margin-top:2rem; padding-top:0.5rem">Assinatura Solicitante/Terceiro</div>
                    </div>
                    <div>
                        <div style="border-top:1px solid #000; margin-top:2rem; padding-top:0.5rem">${signatureLabel}</div>
                    </div>
                </div>
                
                <div style="text-align:center; margin-top:2rem; color:var(--gray-500); font-size:0.8rem">
                    Registro de ${isReturnCopy ? 'Devolução' : 'Retirada'} em ${isReturnCopy ? utils.getCurrentDateTime() : utils.formatDateTime(loan.data)} | Key: ${loan.usuario_id || loan.id}
                </div>
            </div>
        `;
        };

        const isReturned = loan.status === 'returned';
        content.innerHTML = `
            ${getTermMarkup('1ª VIA - ENTREGA', 'Responsável pela Entrega')}
            ${isReturned ? `
                <div class="term-separator"></div>
                ${getTermMarkup('2ª VIA - DEVOLUÇÃO', 'Responsável pela Devolução', true)}
            ` : ''}
        `;

        // Atualizar botoes do modal para incluir impressão externa
        const footer = document.querySelector('#termModal .no-print[style*="margin-top:3rem"]');
        if (footer) {
            footer.innerHTML = `
                <button onclick="ui.printTermExternal(${JSON.stringify(loan).replace(/"/g, '&quot;')})" class="btn btn-primary">Imprimir Termo (Nova Janela)</button>
                <button onclick="ui.closeModal()" class="btn" style="background:var(--gray-200)">Fechar</button>
            `;
        }
        document.getElementById('termModal').classList.add('active');
    },

    printTermExternal(loan) {
        const itemsList = typeof loan.itens === 'string' ? JSON.parse(loan.itens) : loan.itens;
        const safeEmail = loan.email || '---';
        const safeDepto = loan.depto || '---';
        const safeDataPrevista = utils.formatDate(loan.data_prevista);

        const getMarkup = (copyLabel, signatureLabel, isReturnCopy = false) => {
            const realReturnDate = loan.data_devolucao ? new Date(loan.data_devolucao) : null;
            const plannedReturnDate = loan.data_prevista ? new Date(loan.data_prevista) : null;

            let delayStatus = '';
            if (isReturnCopy && realReturnDate && plannedReturnDate) {
                const diff = realReturnDate - plannedReturnDate;
                delayStatus = diff > (1000 * 60 * 60 * 24)
                    ? '<span style="color:#d32f2f; font-weight:bold">⚠️ DEVOLVIDO COM ATRASO</span>'
                    : '<span style="color:#2e7d32; font-weight:bold">✅ DEVOLVIDO NO PRAZO</span>';
            }

            return `
            <div class="term-copy" style="page-break-after: always; break-after: page; padding: 2cm; font-family: sans-serif; min-height: 25cm; display: flex; flex-direction: column;">
                <div style="display:flex; justify-content:space-between; align-items:start; padding-bottom:1rem; border-bottom:3px solid #163b8c; margin-bottom:2rem">
                    <div>
                        <h1 style="font-size:1.5rem; color:#163b8c; margin:0">TERMO DE RESPONSABILIDADE</h1>
                        <p style="color:#666; margin:0.25rem 0">Setor de Suporte Tecnológico - Nutrição Animal | <small>${copyLabel}</small></p>
                    </div>
                    <div style="text-align:right">
                        <span style="background:#eee; padding:0.5rem; border-radius:4px; font-weight:bold">ID: #${loan.id}</span>
                        <div style="font-size:0.7rem; color:#888; margin-top:0.25rem">${isReturnCopy ? utils.getCurrentDateTime() : utils.formatDateTime(loan.data)}</div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 120px; gap:2rem; margin-bottom:2rem">
                    <div style="font-size:0.9rem; line-height:1.6">
                        <p><b>DADOS DO SOLICITANTE:</b></p>
                        <p>Nome: ${loan.usuario_nome}</p>
                        <p>E-mail: ${safeEmail}</p>
                        <p>CPF/Matrícula: ${(!loan.usuario_id || loan.usuario_id.length > 20) ? '' : loan.usuario_id}</p>
                        <p>Departamento: ${safeDepto}</p>

                        ${isReturnCopy && realReturnDate ? `
                            <div style="margin-top:0.5rem; padding:0.5rem; background:#f5f5f5; border-radius:4px; border:1px solid #ddd">
                                <p style="margin:2px 0"><b>DADOS DA DEVOLUÇÃO:</b></p>
                                <p style="margin:2px 0">Data Prevista: ${safeDataPrevista}</p>
                                <p style="margin:2px 0">Data Real: ${utils.formatDate(loan.data_devolucao)}</p>
                                <p style="margin:2px 0">Status: ${delayStatus}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div style="padding:1.5rem; border:1px solid #eee; border-radius:8px; background:#fff; font-family:serif; text-align:justify; font-size:0.95rem; line-height:1.5; flex-grow: 1;">
                    <p>Pelo presente termo, o colaborador acima identificado declara ter recebido em perfeito estado de conservação os equipamentos listados abaixo:</p>
                    <ul style="margin:1rem 0; padding-left:1.5rem">
                        ${(itemsList || []).map(i => `<li><b>${i.nome}</b> (Série: ${i.codigo})</li>`).join('')}
                    </ul>
                    <p>O solicitante assume inteira responsabilidade pela guarda, conservação e uso adequado dos bens, comprometendo-se a:</p>
                    <ol style="margin:1rem 0; padding-left:1.5rem; font-size:0.85rem">
                        <li>Utilizar os equipamentos exclusivamente para fins profissionais vinculados às atividades da empresa.</li>
                        <li>Não permitir o uso por pessoas não autorizadas.</li>
                        <li>Comunicar imediatamente qualquer defeito, furto ou extravio.</li>
                        <li>Devolver os equipamentos na data prevista: <b>${safeDataPrevista}</b>.</li>
                    </ol>
                    <p style="font-size:0.85rem; margin-top:1rem; border-top: 1px solid #eee; padding-top: 1rem">O equipamento deverá ser devolvido pelo colaborador nas mesmas condições em que foi entregue, em pleno funcionamento, exceto pelos desgastes naturais decorrentes do uso normal.</p>
                </div>

                <div style="margin-top:3rem; display:grid; grid-template-columns: 1fr 1fr; gap:2rem; text-align:center; font-size:0.85rem">
                    <div><div style="border-top:1px solid #000; margin-top:1rem; padding-top:0.5rem">Assinatura Solicitante/Terceiro</div></div>
                    <div><div style="border-top:1px solid #000; margin-top:1rem; padding-top:0.5rem">${signatureLabel}</div></div>
                </div>
                
                <div style="text-align:center; margin-top:2rem; color:#999; font-size:0.8rem">
                    Registro de ${isReturnCopy ? 'Devolução' : 'Retirada'} em ${isReturnCopy ? utils.getCurrentDateTime() : utils.formatDateTime(loan.data)} | Key: ${loan.usuario_id || loan.id}
                </div>
            </div>
        `;
        };

        const isReturned = loan.status === 'returned';
        const printWin = window.open('', '_blank');
        printWin.document.write(`
            <html>
                <head>
                    <title>Termo de Responsabilidade #${loan.id}</title>
                    <style>
                        body { margin: 0; padding: 0; }
                        @media print { 
                            .term-copy { page-break-after: always !important; break-after: page !important; }
                            .term-copy:last-child { page-break-after: auto !important; break-after: auto !important; }
                        }
                    </style>
                </head>
                <body>
                    ${getMarkup('1ª VIA - ENTREGA', 'Responsável pela Entrega')}
                    ${isReturned ? getMarkup('2ª VIA - DEVOLUÇÃO', 'Responsável pela Devolução', true) : ''}
                    <script>
                        window.onload = function() {
                            window.print();
                        }
                    </script>
                </body>
            </html>
        `);
        printWin.document.close();
    },

    closeModal() { document.getElementById('termModal').classList.remove('active'); },

    showStatDetails(type) {
        const modal = document.getElementById('detailsModal');
        const title = document.getElementById('detailsModalTitle');
        const subtitle = document.getElementById('detailsModalSubtitle');
        const list = document.getElementById('detailsList');

        let filtered = [];
        let label = '';

        if (type === 'all') {
            filtered = state.db.equipment;
            label = 'Total de Equipamentos';
        } else if (type === 'available') {
            filtered = state.db.equipment.filter(e => e.status === 'available');
            label = 'Equipamentos Disponíveis';
        } else if (type === 'in_use') {
            filtered = state.db.equipment.filter(e => e.status === 'in_use');
            label = 'Equipamentos Em Uso';
        }

        title.innerText = label;
        subtitle.innerText = `${filtered.length} item(ns) encontrado(s)`;

        list.innerHTML = filtered.map(e => `
            <div class="details-item">
                <div class="details-item-info">
                    <span class="details-item-icon">${e.icone}</span>
                    <div>
                        <div style="font-weight:600">${e.nome}</div>
                        <div class="details-item-meta">${e.codigo} | ${e.categoria}</div>
                    </div>
                </div>
                <div style="font-size:0.75rem; font-weight:700; color:${e.status === 'available' ? 'var(--success)' : 'var(--warning)'}">
                    ${e.status === 'available' ? 'DISPONÍVEL' : 'EM USO'}
                </div>
            </div>
        `).join('') || '<p style="text-align:center; color:var(--gray-500); padding:2rem">Nenhum equipamento nesta categoria.</p>';

        modal.classList.add('active');
    },

    closeDetailsModal() {
        document.getElementById('detailsModal').classList.remove('active');
    }
};

// --- Core Logic ---
const auth = {
    async login(email, pass) {
        console.log('--- Iniciando Login ---');
        console.log('E-mail:', email);

        if (!dbClient) return ui.notify('Sistema fora de configuração', 'error');

        ui.showLoading(true);

        try {
            const { data: authData, error: authError } = await dbClient.auth.signInWithPassword({
                email: email.trim(),
                password: pass.trim()
            });

            if (authError) {
                ui.showLoading(false);
                console.error('Erro de login Auth:', authError);

                let errorMsg = 'E-mail ou senha incorretos'; // Mensagem padrão mais amigável

                if (authError.message.includes('Email not confirmed')) {
                    errorMsg = 'E-mail pendente de confirmação. Verifique sua caixa de entrada.';
                } else if (authError.message.includes('Invalid login credentials')) {
                    errorMsg = 'Usuário não encontrado ou senha inválida.';
                } else if (authError.status === 400) {
                    errorMsg = 'Dados de acesso inválidos. Verifique os campos.';
                } else {
                    errorMsg = authError.message;
                }

                ui.notify(errorMsg, 'error');
                return;
            }

            console.log('Auth sucesso! User ID:', authData?.user?.id);

            if (authData?.user) {
                // Tenta buscar as informações adicionais da tabela 'usuarios' usando o ID do Supabase Auth
                const { data: userData, error: dbError } = await dbClient
                    .from('usuarios')
                    .select('*')
                    .eq('id', authData.user.id)
                    .single();

                if (dbError || !userData) {
                    console.error('Perfil não encontrado para o ID:', authData.user.id);
                    await dbClient.auth.signOut();
                    ui.showLoading(false);
                    return ui.notify('Acesso negado. Seu perfil não foi encontrado no sistema.', 'error');
                }

                const userProfile = userData;

                state.currentUser = userProfile;
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('appContainer').classList.add('active');

                document.querySelectorAll('.admin-only').forEach(el => {
                    el.style.display = (userProfile.cargo === 'admin') ? 'block' : 'none';
                });

                ui.showPage('dashboard');
                ui.notify(`Bem vindo, ${userProfile.nome} `);
            }
        } catch (err) {
            console.error('Erro inesperado no login:', err);
            ui.notify('Erro interno ao processar login', 'error');
        } finally {
            ui.showLoading(false);
        }
    },
    async register(name, email, cpf, pass) {
        if (!dbClient) return ui.notify('Sistema fora de configuração', 'error');
        ui.showLoading(true);

        try {
            // 1. Criar no Supabase Auth
            const { data: authData, error: authError } = await dbClient.auth.signUp({
                email: email,
                password: pass,
                options: {
                    data: { nome: name }
                }
            });

            if (authError) throw authError;

            // 2. Criar na tabela 'usuarios'
            const { error: dbError } = await dbClient.from('usuarios').insert([{
                id: authData.user.id,
                email: email.trim().toLowerCase(),
                nome: name.trim(),
                usuario_id: cpf.trim(), // Salvando o CPF/Matrícula
                cargo: 'user'
            }]);

            if (dbError) {
                console.error('Erro ao salvar dados extras:', dbError);
                ui.notify('Conta Auth criada, mas erro ao salvar no perfil: ' + dbError.message, 'warning');
            }

            ui.notify('Conta criada com sucesso!');
            ui.toggleAuth(true);

            if (authData?.user?.identities?.length === 0) {
                ui.notify('E-mail já cadastrado!', 'error');
            } else {
                ui.notify('Verifique seu e-mail para confirmar a conta (se ativado).');
            }

        } catch (err) {
            console.error('Erro no cadastro:', err);
            ui.notify('Erro ao cadastrar: ' + err.message, 'error');
        } finally {
            ui.showLoading(false);
        }
    },
    async checkSession() {
        if (!dbClient) return;
        const { data: { session } } = await dbClient.auth.getSession();
        if (session?.user) {
            console.log('Sessão ativa encontrada para:', session.user.email);
            // Reutiliza a lógica de login para carregar o perfil
            await this.loginWithUser(session.user);
        }
    },
    async loginWithUser(user) {
        // Busca perfil extra
        const { data: userData } = await dbClient
            .from('usuarios')
            .select('*')
            .eq('email', user.email)
            .single();

        if (!userData) {
            await dbClient.auth.signOut();
            return;
        }

        const userProfile = userData;

        state.currentUser = userProfile;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appContainer').classList.add('active');
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = (userProfile.cargo === 'admin') ? 'block' : 'none');
        ui.showPage('dashboard');
    },
    async logout() {
        if (dbClient) await dbClient.auth.signOut();
        window.location.reload();
    }
};

const actions = {
    toggleItem(id) {
        const idx = state.selectedItems.indexOf(id);
        if (idx > -1) state.selectedItems.splice(idx, 1);
        else state.selectedItems.push(id);
        ui.renderLoanItems();
    },

    async returnLoan(loanId) {
        ui.showLoading(true);
        try {
            const loan = state.db.loans.find(l => l.id === loanId);
            if (!loan) return;

            // 1. Atualizar status do empréstimo e registrar data real
            const { error: error1 } = await dbClient.from('emprestimos').update({
                status: 'returned',
                data_devolucao: new Date().toISOString()
            }).eq('id', loanId);
            if (error1) throw error1;

            // 2. Liberar equipamentos
            const itemsList = typeof loan.itens === 'string' ? JSON.parse(loan.itens) : loan.itens;
            for (const item of (itemsList || [])) {
                const { error: error2 } = await dbClient.from('equipamentos').update({ status: 'available' }).eq('id', item.id);
                if (error2) throw error2;
            }

            ui.notify('Itens devolvidos com sucesso!');
            await storage.loadAll();
            ui.renderHistory();
            ui.renderAdmin();
            ui.renderDashboard(); // Garantir que os contadores no dashboard atualizem
            ui.showPage('history');
        } catch (err) {
            console.error(err);
            ui.notify('Erro ao devolver itens', 'error');
        }
        ui.showLoading(false);
    },

    async saveEquip(data) {
        ui.showLoading(true);
        const eqData = {
            nome: data.name,
            codigo: data.code,
            categoria: data.cat,
            descricao: data.desc,
            foto_base64: state.equipPhotoData || null,
            icone: data.cat === 'Notebook' ? '💻' : data.cat === 'Projetor' ? '📽️' : data.cat === 'Microfone' ? '🎤' : '📸'
        };

        try {
            if (data.id) {
                // Update
                const { error } = await dbClient.from('equipamentos').update(eqData).eq('id', data.id);
                if (error) throw error;
                ui.notify('Equipamento atualizado');
            } else {
                // Insert
                eqData.status = 'available';
                const { error } = await dbClient.from('equipamentos').insert([eqData]);
                if (error) throw error;
                ui.notify('Equipamento cadastrado');
            }
            ui.clearEquipForm();
            await storage.loadAll();
            ui.renderInventory();
            ui.renderDashboard();
            ui.renderLoanItems(); // Atualizar grid de seleção
        } catch (err) {
            console.error(err);
            ui.notify('Erro ao salvar equipamento', 'error');
        }
        ui.showLoading(false);
    },

    async deleteItem(id) {
        if (!confirm('Remover este item do inventário?')) return;

        ui.showLoading(true);
        try {
            await dbClient.from('equipamentos').delete().eq('id', id);
            ui.notify('Item removido');
            ui.showPage('admin');
        } catch (err) {
            ui.notify('Erro ao remover', 'error');
        }
        ui.showLoading(false);
    },

    viewTerm(id) {
        const loan = state.db.loans.find(l => l.id === id);
        if (loan) ui.openModal(loan);
    },

    async updateUserCargo(userId, newCargo) {
        if (!confirm(`Deseja alterar o cargo deste usuário para ${newCargo.toUpperCase()}?`)) return;

        ui.showLoading(true);
        try {
            const { error } = await dbClient
                .from('usuarios')
                .update({ cargo: newCargo })
                .eq('id', userId);

            if (error) throw error;

            ui.notify(`Usuário atualizado para ${newCargo.toUpperCase()} `);

            // Se o próprio admin mudar o cargo dele (raro, mas possível), avisa
            if (state.currentUser.id === userId) {
                ui.notify('Suas permissões mudaram. Re-logue para aplicar.', 'warning');
            }

            await storage.loadAll();
            ui.renderAdmin();
        } catch (err) {
            console.error(err);
            ui.notify('Erro ao atualizar cargo', 'error');
        }
        ui.showLoading(false);
    },

    async deleteUser(userId) {
        if (userId === state.currentUser.id) return ui.notify('Você não pode excluir a si mesmo!', 'error');
        if (!confirm('Deseja remover este usuário? Ele perderá acesso ao sistema imediatamente.')) return;

        ui.showLoading(true);
        try {
            const { error } = await dbClient.from('usuarios').delete().eq('id', userId);
            if (error) throw error;
            ui.notify('Usuário removido da base');
            await storage.loadAll();
            ui.renderAdmin();
        } catch (err) {
            ui.notify('Erro ao remover usuário', 'error');
        }
        ui.showLoading(false);
    },

    async saveUser(data) {
        ui.showLoading(true);
        try {
            if (data.id) {
                const { error } = await dbClient.from('usuarios').update({
                    nome: data.name,
                    email: data.email,
                    usuario_id: data.cpf,
                    cargo: data.cargo
                }).eq('id', data.id);
                if (error) throw error;
                ui.notify('Perfil atualizado');
            } else {
                const { data: authData, error: authError } = await dbClient.auth.signUp({
                    email: data.email,
                    password: data.pass,
                    options: { data: { nome: data.name } }
                });
                if (authError) throw authError;

                await dbClient.from('usuarios').insert([{
                    id: authData.user.id,
                    email: data.email,
                    nome: data.name,
                    usuario_id: data.cpf,
                    cargo: data.cargo
                }]);
                ui.notify('Usuário criado com sucesso');
            }
            ui.closeUserModal();
            await storage.loadAll();
            ui.renderAdmin();
        } catch (err) {
            ui.notify('Erro ao salvar: ' + (err.message || 'Erro desconhecido'), 'error');
        }
        ui.showLoading(false);
    }
};

// --- Event Listeners ---
document.getElementById('loginForm')?.addEventListener('submit', e => {
    e.preventDefault();
    auth.login(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
});

document.getElementById('registerForm')?.addEventListener('submit', e => {
    e.preventDefault();
    auth.register(
        document.getElementById('regName').value,
        document.getElementById('regEmail').value,
        document.getElementById('regId').value,
        document.getElementById('regPassword').value
    );
});

document.querySelectorAll('.nav-link').forEach(l => {
    l.addEventListener('click', () => ui.showPage(l.dataset.page));
});

document.getElementById('loanForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (state.selectedItems.length === 0) return ui.notify('Selecione ao menos um equipamento', 'error');

    const isThird = document.getElementById('loan-is-third-party').checked;
    const loanData = {
        usuario_id: state.currentUser.usuario_id || '', // Apenas o CPF ou vazio
        usuario_nome: state.currentUser.nome,
        email: state.currentUser.email,
        depto: document.getElementById('loan-dept').value,
        data: new Date().toISOString(),
        data_retirada: document.getElementById('loan-date-start').value,
        data_prevista: document.getElementById('loan-date-end').value,
        finalidade: document.getElementById('loan-purpose').value,
        itens: state.selectedItems.map(id => state.db.equipment.find(e => e.id === id)),
        terceiro_nome: isThird ? document.getElementById('loan-third-name').value : null,
        terceiro_cpf: isThird ? document.getElementById('loan-third-cpf').value : null,
        status: 'active'
    };

    // Dados básicos para fallback se colunas novas não existirem
    const basicData = {
        usuario_nome: state.currentUser.nome,
        usuario_id: loanData.usuario_id,
        email: loanData.email,
        depto: loanData.depto,
        data: loanData.data,
        data_prevista: loanData.data_prevista,
        finalidade: loanData.finalidade,
        itens: loanData.itens,
        status: 'active'
    };

    ui.showLoading(true);
    try {
        console.log('--- INICIANDO RETIRADA ATÔMICA (RPC) ---');
        // Chamada Atômica via RPC (Garante que ninguém pegue o item ao mesmo tempo)
        const { data, error } = await dbClient.rpc('realizar_emprestimo', {
            p_usuario_id: loanData.usuario_id,
            p_usuario_nome: loanData.usuario_nome,
            p_email: loanData.email,
            p_depto: loanData.depto,
            p_data: loanData.data,
            p_data_retirada: loanData.data_retirada,
            p_data_prevista: loanData.data_prevista,
            p_finalidade: loanData.finalidade,
            p_itens: loanData.itens,
            p_terceiro_nome: loanData.terceiro_nome,
            p_terceiro_cpf: loanData.terceiro_cpf
        });

        if (error) {
            // Se o erro vier da nossa função (RAISE EXCEPTION), mostramos a mensagem amigável
            if (error.message.includes('não está mais disponível')) {
                ui.notify(error.message, 'error');
            } else {
                throw error;
            }
            ui.showLoading(false);
            return;
        }

        ui.notify('Retirada registrada com sucesso! (V2 - Protegido)');
        state.selectedItems = [];
        state.photoData = null;
        await storage.loadAll();

        // Abrir modal com os dados retornados pela RPC
        ui.openModal(data);
        ui.showPage('dashboard');
    } catch (err) {
        console.error(err);
        ui.notify('Erro ao registrar retirada: ' + (err.message || 'Erro desconhecido'), 'error');
    }
    ui.showLoading(false);

    // Sync to GitHub automatically after success
    try {
        console.log('--- AUTO-SYNC GITHUB ---');
        // Usando o PowerShell para rodar o script de sincronização
    } catch (e) {
        console.warn('Sync failed', e);
    }
});

document.getElementById('addEquipForm')?.addEventListener('submit', e => {
    e.preventDefault();
    actions.saveEquip({
        id: document.getElementById('eq-edit-id').value,
        name: document.getElementById('eq-name').value,
        code: document.getElementById('eq-code').value,
        cat: document.getElementById('eq-cat').value,
        desc: document.getElementById('eq-desc').value
    });
});

document.getElementById('userForm')?.addEventListener('submit', e => {
    e.preventDefault();
    actions.saveUser({
        id: document.getElementById('user-edit-id').value,
        name: document.getElementById('user-name').value,
        email: document.getElementById('user-email').value,
        cpf: document.getElementById('user-cpf').value,
        cargo: document.getElementById('user-cargo').value,
        pass: document.getElementById('user-pass').value
    });
});

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    ui.initCanvas();
    if (dbClient) {
        storage.loadAll();
        auth.checkSession(); // Verifica se já está logado
    }
});
