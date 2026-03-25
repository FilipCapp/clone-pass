let currentMasterKey = null;

// Generate encryption key from Master Password
async function deriveKey(password) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: enc.encode("github-vault-salt"), iterations: 100000, hash: "SHA-256" },
        baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
}

async function unlockVault() {
    const pass = document.getElementById('masterPass').value;
    if (!pass) return alert("Please enter your password");
    
    currentMasterKey = await deriveKey(pass);
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    loadVault();
}

async function saveSecret() {
    const site = document.getElementById('siteName').value;
    const user = document.getElementById('siteUser').value;
    const pass = document.getElementById('sitePass').value;
    const editIndex = parseInt(document.getElementById('editIndex').value);

    if (!site || !user || !pass) return alert("All fields are required");

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const dataObj = JSON.stringify({ user, pass });
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, currentMasterKey, new TextEncoder().encode(dataObj));

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
                    <div>
                        <span class="item-site">${item.site}</span>
                        <span class="item-user">${user}</span><br>
                        <span class="item-pass">${pass}</span>
                    </div>
                    <div class="actions">
                        <button class="icon-btn" onclick="editItem(${i},'${item.site}','${user}','${pass}')">✏️</button>
                        <button class="icon-btn" onclick="deleteItem(${i})">🗑️</button>
                    </div>
                </div>`;
        } catch (e) {
            list.innerHTML = "<p style='color:red;text-align:center;'>Encryption error. Reload and try again.</p>";
            break;
        }
    }
}

function exportVault() {
    const data = localStorage.getItem('vault') || "[]";
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_vault_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function triggerImport() { document.getElementById('fileInput').click(); }

function importVault(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        localStorage.setItem('vault', e.target.result);
        alert("Imported! Unlock with the password used for that file.");
    };
    reader.readAsText(file);
}

function editItem(i, s, u, p) {
    document.getElementById('siteName').value = s;
    document.getElementById('siteUser').value = u;
    document.getElementById('sitePass').value = p;
    document.getElementById('editIndex').value = i;
    document.getElementById('formTitle').innerText = "Edit Account";
    document.getElementById('saveBtn').innerText = "Update";
    document.getElementById('cancelBtn').classList.remove('hidden');
    window.scrollTo(0,0);
}

function resetForm() {
    document.getElementById('siteName').value = '';
    document.getElementById('siteUser').value = '';
    document.getElementById('sitePass').value = '';
    document.getElementById('editIndex').value = "-1";
    document.getElementById('formTitle').innerText = "Add New Account";
    document.getElementById('saveBtn').innerText = "Save Account";
    document.getElementById('cancelBtn').classList.add('hidden');
}

function deleteItem(i) {
    if (!confirm("Delete this?")) return;
    let vault = JSON.parse(localStorage.getItem('vault'));
    vault.splice(i, 1);
    localStorage.setItem('vault', JSON.stringify(vault));
    loadVault();
}

function clearAll() {
    if (confirm("This wipes the browser storage. Make sure you have an export!")) {
        localStorage.removeItem('vault');
        location.reload();
    }
}