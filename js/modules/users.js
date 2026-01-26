
/**
 * 👥 Módulo de Gestión de Empleados (users.js)
 * Permite al Dueño administrar los perfiles de usuarios (Vendedores, Admins).
 * v1.1 - Fixed Scope & Enhanced UI
 */

window.renderUsersView = function (container) {
    if (!container) return;

    container.innerHTML = `
        <div class="users-module animate__animated animate__fadeIn">
            <!-- Header -->
            <div class="module-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h2 class="text-2xl font-bold" style="color: var(--text-main);">Gestión de Equipo</h2>
                    <p style="color: var(--text-muted);">Administra los perfiles de acceso y roles de tu negocio.</p>
                </div>
                <button onclick="window.showCreateUserModal()" class="btn-primary" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; border-radius: 8px;">
                    <i class="ph ph-user-plus" style="font-size: 1.2rem;"></i>
                    <span>Nuevo Miembro</span>
                </button>
            </div>

            <!-- Users Grid -->
            <div class="users-grid" id="users-list-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
                <!-- Users will be injected here -->
            </div>
        </div>
    `;

    renderUserList();
};

window.renderUserList = function () {
    const listContainer = document.getElementById('users-list-container');
    if (!listContainer) return;

    const users = (window.db.users || []).filter(u => u.status !== 'inactive');

    if (users.length === 0) {
        listContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; background: var(--bg-card); border-radius: 12px; border: 2px dashed var(--border);">
                <div style="width: 60px; height: 60px; background: rgba(59, 130, 246, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                    <i class="ph ph-users-three" style="font-size: 2rem; color: var(--primary);"></i>
                </div>
                <h3 style="color: var(--text-main); margin-bottom: 0.5rem;">Aún no tienes equipo</h3>
                <p style="color: var(--text-muted);">Agrega vendedores o administradores para comenzar.</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = users.map(user => {
        const isOwner = user.role === 'owner';
        // const isCurrentUser = window.currentUser && window.currentUser.id === user.id;

        let roleBadgeColor = 'var(--text-muted)';
        let roleLabel = 'Sin Rol';

        switch (user.role) {
            case 'owner':
                roleBadgeColor = 'var(--primary)';
                roleLabel = '👑 Dueño';
                break;
            case 'admin':
                roleBadgeColor = '#10b981'; // Green
                roleLabel = '🛡️ Admin';
                break;
            case 'seller':
                roleBadgeColor = '#8b5cf6'; // Purple
                roleLabel = '🛒 Vendedor';
                break;
        }

        return `
            <div class="user-card" onclick="window.showEditUserModal('${user.id}')" style="cursor: pointer; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; position: relative; overflow: hidden; transition: transform 0.2s;">
                <div style="display: flex; align-items: start; gap: 1rem; margin-bottom: 1rem;">
                    <div style="width: 50px; height: 50px; background: linear-gradient(135deg, ${roleBadgeColor} 0%, rgba(0,0,0,0.5) 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: white;">
                        ${user.name.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1;">
                        <h4 style="color: var(--text-main); font-weight: 600; font-size: 1.1rem; margin-bottom: 0.25rem;">${user.name}</h4>
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                            <span style="font-size: 0.75rem; background: rgba(255,255,255,0.05); padding: 0.2rem 0.6rem; border-radius: 20px; color: ${roleBadgeColor}; border: 1px solid ${roleBadgeColor}44;">
                                ${roleLabel}
                            </span>
                            <div title="Configurar Permisos" style="display:flex; align-items:center; gap:0.5rem; color: var(--primary); font-size: 0.8rem;">
                                <i class="ph ph-gear"></i> Configurar
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="border-top: 1px solid var(--border); padding-top: 1rem; margin-top: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                        <span style="color: var(--text-muted);">PIN Acceso:</span>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="color: var(--text-main); font-family: monospace; background: var(--bg-main); padding: 0.1rem 0.4rem; border-radius: 4px;">
                                ${'****'}
                            </span>
                            ${!isOwner ? `<i class="ph ph-pencil-simple" style="color: var(--text-muted); cursor: pointer;" title="Editar PIN"></i>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

window.showEditUserModal = function (userId) {
    const user = window.db.users.find(u => u.id == userId);
    if (!user) return;

    // Determine current permissions (custom or role-based default)
    const currentPerms = user.permissions || window.rolePermissions[user.role] || [];
    const isOwner = user.role === 'owner';

    const modulesHtml = window.availableModules.map(mod => {
        const isChecked = currentPerms.includes(mod.id);
        const disabledAttr = isOwner ? 'disabled checked' : ''; // Owner always has all access

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-main); border-radius: 8px; margin-bottom: 0.5rem;">
                <span style="color: var(--text-main); font-size: 0.9rem;">${mod.label}</span>
                <label class="switch">
                    <input type="checkbox" class="perm-toggle" data-mod="${mod.id}" ${isChecked ? 'checked' : ''} ${disabledAttr}>
                    <span class="slider round"></span>
                </label>
            </div>
        `;
    }).join('');

    const modalHtml = `
        <div style="text-align: left; padding: 0.5rem;">
            <p style="color: var(--text-muted); margin-bottom: 1.5rem; font-size: 0.9rem;">Editando perfil de <strong>${user.name}</strong></p>
            
            <div class="form-group" style="margin-bottom: 1.5rem;">
                <label style="display: block; color: var(--text-muted); margin-bottom: 0.5rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Credenciales</label>
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
                    <div>
                        <input type="text" id="edit-user-name" value="${user.name}" class="input-modern" placeholder="Nombre" 
                            style="width: 100%; padding: 0.7rem; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 8px; color: white;">
                    </div>
                    <div>
                        <input type="password" id="edit-user-pin" value="${user.pin || ''}" class="input-modern" placeholder="PIN" maxlength="4" ${isOwner ? 'disabled' : ''}
                            style="width: 100%; padding: 0.7rem; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 8px; color: white; text-align: center; font-family: monospace;">
                    </div>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.5rem;">
                <label style="display: block; color: var(--text-muted); margin-bottom: 0.5rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Permisos del Sistema</label>
                <div style="max-height: 250px; overflow-y: auto; padding-right: 0.5rem;">
                    ${modulesHtml}
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; border-top: 1px solid var(--border); padding-top: 1rem;">
                <button onclick="confirmDeleteUser('${user.id}')" class="btn-icon" style="color: var(--danger); opacity: ${isOwner ? 0.3 : 1}; pointer-events: ${isOwner ? 'none' : 'all'}" title="Eliminar Usuario">
                    <i class="ph ph-trash" style="font-size: 1.5rem;"></i>
                </button>
                <div style="display: flex; gap: 1rem;">
                    <button onclick="Swal.close()" class="btn-ghost">Cancelar</button>
                    <button onclick="saveUserConfig('${user.id}')" class="btn-primary" style="padding: 0.6rem 1.5rem;">Guardar Cambios</button>
                </div>
            </div>
        </div>

        <style>
            /* iOS Style Switch */
            .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--bg-dark); transition: .4s; border-radius: 34px; border: 1px solid var(--border); }
            .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
            input:checked + .slider { background-color: var(--primary); border-color: var(--primary); }
            input:checked + .slider:before { transform: translateX(20px); }
            input:disabled + .slider { opacity: 0.5; cursor: not-allowed; }
        </style>
    `;

    Swal.fire({
        title: null,
        html: modalHtml,
        showConfirmButton: false,
        background: 'var(--bg-card)',
        color: 'var(--text-main)',
        width: '500px',
        padding: '0'
    });
};

window.saveUserConfig = function (userId) {
    const user = window.db.users.find(u => u.id == userId);
    if (!user) return;

    const newName = document.getElementById('edit-user-name').value.trim();
    const newPin = document.getElementById('edit-user-pin').value.trim();

    if (!newName || newPin.length !== 4) {
        window.showToast('⚠️ Nombre y PIN (4 dígitos) son requeridos', 'warning');
        return;
    }

    // Update Basic Info
    user.name = Security.sanitize(newName);
    if (user.role !== 'owner') {
        // [REQUESTED] Allow duplicate PINs (e.g. 0000 for everyone)
        user.pin = newPin;
    }

    // Update Permissions
    const toggles = document.querySelectorAll('.perm-toggle');
    const newPerms = [];
    toggles.forEach(t => {
        if (t.checked) newPerms.push(t.dataset.mod);
    });

    user.permissions = newPerms; // Save custom permissions

    window.saveData();
    window.showToast('✅ Perfil actualizado correctamente', 'success');
    Swal.close();
    renderUserList();
};

window.confirmDeleteUser = function (userId) {
    const user = window.db.users.find(u => u.id == userId);
    if (!user) return;

    Swal.fire({
        title: '¿Eliminar Usuario?',
        text: `Esta acción no se puede deshacer. ${user.name} perderá el acceso.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: 'var(--bg-hover)',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        background: 'var(--bg-card)',
        color: 'var(--text-main)'
    }).then((result) => {
        if (result.isConfirmed) {
            // [SOFT DELETE] Mark as inactive instead of removing
            user.status = 'inactive';
            window.saveData();
            renderUserList();
            window.showToast('🗑️ Usuario eliminado (archivado)', 'info');
        }
    });
};

window.showCreateUserModal = function () {
    const modalHtml = `
    <div style="padding: 1rem;">
        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Crea un nuevo perfil para tu equipo.</p>
        
        <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; color: var(--text-muted); margin-bottom: 0.5rem;">Tipo de Rol</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <label class="role-option" style="cursor: pointer; position: relative;">
                    <input type="radio" name="new-user-role" value="seller" checked style="display: none;">
                    <div class="option-card" style="padding: 1rem; border: 1px solid var(--border); border-radius: 8px; text-align: center; transition: all 0.2s;">
                        <i class="ph ph-shopping-cart" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
                        <span style="font-weight: 600;">Vendedor</span>
                    </div>
                </label>
                <label class="role-option" style="cursor: pointer;">
                    <input type="radio" name="new-user-role" value="admin" style="display: none;">
                    <div class="option-card" style="padding: 1rem; border: 1px solid var(--border); border-radius: 8px; text-align: center; transition: all 0.2s;">
                        <i class="ph ph-shield-check" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
                        <span style="font-weight: 600;">Admin</span>
                    </div>
                </label>
            </div>
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; color: var(--text-muted); margin-bottom: 0.5rem;">Nombre Completo</label>
            <input type="text" id="new-user-name" class="input-modern" placeholder="Ej. Juan Pérez" style="width: 100%; padding: 0.8rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 8px; color: white;">
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
            <label style="display: block; color: var(--text-muted); margin-bottom: 0.5rem;">PIN de Acceso (4 dígitos)</label>
            <input type="password" id="new-user-pin" class="input-modern" placeholder="****" maxlength="4" style="width: 100%; padding: 0.8rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 8px; color: white;">
        </div>

        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button onclick="Swal.close()" class="btn-ghost" style="padding: 0.8rem 1.5rem; color: var(--text-muted);">Cancelar</button>
            <button onclick="window.confirmCreateUser()" class="btn-primary" style="padding: 0.8rem 2rem; border-radius: 8px; background: var(--primary); color: white; font-weight: 600;">Crear Usuario</button>
        </div>
    </div>
    
    <style>
        .role-option input:checked + .option-card {
            background: var(--primary);
            border-color: var(--primary);
            color: white;
        }
        .role-option .option-card:hover {
            border-color: var(--primary);
        }
    </style>
`;

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Nuevo Usuario',
            html: modalHtml,
            showConfirmButton: false,
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            width: '500px'
        });
    } else {
        alert("Error: Librería de modales no cargada.");
    }
};

window.confirmCreateUser = function () {
    const name = document.getElementById('new-user-name').value.trim();
    const pin = document.getElementById('new-user-pin').value.trim();
    const role = document.querySelector('input[name="new-user-role"]:checked').value;

    if (!name || pin.length !== 4) {
        if (window.showToast) window.showToast('⚠️ Completa el nombre y usa un PIN de 4 dígitos', 'warning');
        return;
    }

    // Check availability
    if (window.db.users.find(u => u.pin === pin)) {
        if (window.showToast) window.showToast('⚠️ Este PIN ya está en uso', 'error');
        return;
    }

    const newUser = {
        id: Date.now().toString(),
        name: Security.sanitize(name),
        pin: pin,
        role: role,
        createdAt: new Date().toISOString()
    };

    window.db.users.push(newUser);
    window.saveData();

    if (window.showToast) window.showToast('✅ Usuario creado con éxito', 'success');
    if (typeof Swal !== 'undefined') Swal.close();

    renderUserList();
};
