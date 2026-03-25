let currentMasterKey = null;
let sessionPassword = "";

async function deriveKey(password) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        "raw", 
        enc.encode(password), 
        "PBKDF2", 
        false, 
        ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        { 
            name: "PBKDF2", 
            salt: enc.encode("clonepass-integrated-salt-v3"), 
            iterations: 100000, 
            hash: "SHA-256" 
        },
        baseKey, 
        { name: "AES-GCM", length: 256 }, 
        false, 
        ["encrypt", "decrypt"]
    );
}

async function handleAuth(type) {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('loginPass').value;
    
    if (!email || !pass) return alert("Enter email and password");
    
    sessionPassword = pass; 

    try {
        if (type === 'signup') {
            await window.signUp(window.auth, email, pass);
            alert("Account created! Opening vault...");
        } else {
            await window.signIn(window.auth, email, pass);
        }
        
        await autoUnlock(); 
    } catch (e) {
        alert("Auth Error: " + e.message);
    }
}

async function autoUnlock() {
    if (!sessionPassword) {
        alert("Session expired. Please log in again.");
        return logout();
    }

    currentMasterKey = await deriveKey(sessionPassword);
    sessionPassword = "";

    const status = document.getElementById('syncStatus');
    status.innerText = "Syncing...";
    await pullFromCloud();

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    
    loadVault();
}

function logout() {
    window.auth.signOut().then(() => {
        localStorage.clear();
        location.reload();
    });
}

async function pushToCloud() {
    if (!window.currentUser || !window.db) return;
    const vaultData = localStorage.getItem('vault');
    try {
        await window.dbSet(window.dbDoc(window.db, "vaults", window.currentUser.uid), {
            encryptedData: vaultData,
            updatedAt: new Date().toISOString()
        });
        document.getElementById('syncStatus').innerText = "Cloud Synced";
    } catch (e) { console.error(e); }
}

async function pullFromCloud() {
    if (!window.currentUser) return;
    try {
        const docSnap = await window.dbGet(window.dbDoc(window.db, "vaults", window.currentUser.uid));
        if (docSnap.exists()) {
            localStorage.setItem('vault', docSnap.data().encryptedData);
        }
    } catch (e) { console.error(e); }
}

async function saveSecret() {
    const site = document.getElementById('siteName').value;
    const user = document.getElementById('siteUser').value;
    const pass = document.getElementById('sitePass').value;
    const editIndex = parseInt(document.getElementById('editIndex').value);

    if (!site || !user || !pass) return alert("Fill all fields");

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sensitiveData = JSON.stringify({ user, pass });
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv }, 
        currentMasterKey, 
        new TextEncoder().encode(sensitiveData)
    );

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
                    <div>
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
            list.innerHTML = `<p style="color:var(--danger)">Encryption error. Data might be from an old version.</p>`;
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
    document.getElementById('cancelBtn').classList.remove('hidden');
}

function resetForm() {
    document.getElementById('siteName').value = '';
    document.getElementById('siteUser').value = '';
    document.getElementById('sitePass').value = '';
    document.getElementById('editIndex').value = "-1";
    document.getElementById('formTitle').innerText = "Add Account";
    document.getElementById('cancelBtn').classList.add('hidden');
}

async function deleteItem(index) {
    if (!confirm("Delete this?")) return;
    let vault = JSON.parse(localStorage.getItem('vault') || "[]");
    vault.splice(index, 1);
    localStorage.setItem('vault', JSON.stringify(vault));
    loadVault();
    await pushToCloud();
}
