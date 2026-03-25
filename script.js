let currentMasterKey = null;
const VAULT_ID = "global-vault-v1";

async function deriveKey(password) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: enc.encode("permanent-salt-v1"), iterations: 100000, hash: "SHA-256" },
        baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
}

async function pushToCloud() {
    const status = document.getElementById('syncStatus');
    if (!window.db) return;
    
    const vault = localStorage.getItem('vault');
    try {
        await window.dbSet(window.dbDoc(window.db, "vaults", VAULT_ID), {
            encryptedData: vault,
            updatedAt: new Date().toISOString()
        });
        status.innerText = "Synced to Cloud";
        status.classList.add('sync-online');
    } catch (e) {
        console.error("Cloud Error:", e);
        status.innerText = "Sync Failed";
    }
}

async function pullFromCloud() {
    if (!window.db) return;
    try {
        const docSnap = await window.dbGet(window.dbDoc(window.db, "vaults", VAULT_ID));
        if (docSnap.exists()) {
            localStorage.setItem('vault', docSnap.data().encryptedData);
            return true;
        }
    } catch (e) { console.error("Pull Error:", e); }
    return false;
}

async function unlockVault() {
    const pass = document.getElementById('masterPass').value;
    if (!pass) return alert("Enter Master Password");

    currentMasterKey = await deriveKey(pass);
    
    const status = document.getElementById('syncStatus');
    status.innerText = "Syncing...";
    await pullFromCloud();

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    loadVault();
}

async function saveSecret() {
    const site = document.getElementById('siteName').value;
    const user = document.getElementById('siteUser').value;
    const pass = document.getElementById('sitePass').value;
    const editIndex = parseInt(document.getElementById('editIndex').value);

    if (!site || !user || !pass) return alert("All fields required");

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sensitiveData = JSON.stringify({ user, pass });
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, currentMasterKey, new TextEncoder().encode(sensitiveData));

    const entry = {
        site: site,
        iv: btoa(String.fromCharCode(...iv)),
        data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
    };

    let vault = JSON.parse(localStorage.getItem('vault') || "[]");
    if (editIndex > -1) vault[editIndex] = entry;
    else vault.push(entry);

    localStorage.setItem('vault', JSON.stringify(vault));
    resetForm();
    loadVault();
    await pushToCloud();
}

async function loadVault() {
    const vault = JSON.parse(localStorage.getItem('vault') || "[]");
    const list = document.getElementById('vaultList');
    list.innerHTML = "";

    for (let i = 0; i < vault.length; i++) {
        const item = vault[i];
        try {
            const iv = new Uint8Array(atob(item.iv).split("").map(c => c.charCodeAt(0)));
            const data = new Uint8Array(atob(item.data).split("").map(c => c.charCodeAt(0)));
            const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, currentMasterKey, data);
            const { user, pass } = JSON.parse(new TextDecoder().decode(decrypted));

            list.innerHTML += `
                <div class="vault-item">
                    <div class="item-info">
                        <span class="item-site">${item.site}</span>
                        <span class="item-user">${user}</span>
                        <span class="item-pass">${pass}</span>
                    </div>
                    <div class="actions">
                        <button class="icon-btn" onclick="editItem(${i}, '${item.site}', '${user}', '${pass}')">✏️</button>
                        <button class="icon-btn" onclick="deleteItem(${i})">🗑️</button>
                    </div>
                </div>`;
        } catch (e) {
            list.innerHTML = "<p style='color:red; text-align:center;'>Decryption Error. Wrong password?</p>";
            break;
        }
    }
}

function editItem(index, site, user, pass) {
    document.getElementById('siteName').value = site;
    document.getElementById('siteUser').value = user;
    document.getElementById('sitePass').value = pass;
    document.getElementById('editIndex').value = index;
    document.getElementById('formTitle').innerText = "Edit Account";
    document.getElementById('saveBtn').innerText = "Update & Sync";
    document.getElementById('cancelBtn').classList.remove('hidden');
    window.scrollTo(0,0);
}

function resetForm() {
    document.getElementById('siteName').value = '';
    document.getElementById('siteUser').value = '';
    document.getElementById('sitePass').value = '';
    document.getElementById('editIndex').value = "-1";
    document.getElementById('formTitle').innerText = "Add Account";
    document.getElementById('saveBtn').innerText = "Save & Sync";
    document.getElementById('cancelBtn').classList.add('hidden');
}

async function deleteItem(index) {
    if (!confirm("Delete this entry?")) return;
    let vault = JSON.parse(localStorage.getItem('vault') || "[]");
    vault.splice(index, 1);
    localStorage.setItem('vault', JSON.stringify(vault));
    loadVault();
    await pushToCloud();
}

function exportVault() {
    const data = localStorage.getItem('vault') || "[]";
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vault_export.json`;
    a.click();
}

function triggerImport() { document.getElementById('fileInput').click(); }

function importVault(event) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        localStorage.setItem('vault', e.target.result);
        alert("Imported! Unlock to sync.");
    };
    reader.readAsText(event.target.files[0]);
}

function clearAll() {
    if (confirm("Wipe all local data?")) {
        localStorage.clear();
        location.reload();
    }
}
