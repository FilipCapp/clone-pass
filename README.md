**ClonePass** is a lightweight, web-based password manager. It allows you to store your credentials securely in the cloud without ever compromising your Master Password. 

---

## ✨ Features

* **Zero-Knowledge Architecture:** Encryption happens locally in your browser. Your Master Password is never sent to a server or stored anywhere.
* **Cloud Sync:** Automatically synchronizes your encrypted vault across devices using Firebase Firestore.
* **AES-256-GCM Encryption:** Industry-standard authenticated encryption for maximum security.
* **Portable Backups:** Export your vault to a `.json` file or import existing backups instantly.
* **Proton-Inspired UI:** A clean, dark-mode interface optimized for both desktop and mobile use.

---

## 🛠️ Technical Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | HTML5, CSS3 (Inter Font Family) |
| **Logic** | Vanilla JavaScript (ES6+) |
| **Encryption** | Web Crypto API (PBKDF2 & AES-GCM) |
| **Database** | Firebase Firestore |
| **Hosting** | GitHub Pages |

---

## 🚀 Getting Started

1.  **Firebase Setup:**
    * Create a project in the [Firebase Console](https://console.firebase.google.com/).
    * Enable **Firestore Database** in "Test Mode".
    * Copy your Web Config into the `index.html` file.
2.  **Configuration:**
    * Open `script.js` and set your unique `VAULT_ID`.
    * **CRITICAL:** Change the salt string in the `deriveKey` function to something unique to you.
3.  **Deployment:**
    * Push the code to a GitHub repository named `ClonePass`.
    * Go to **Settings > Pages** and enable deployment from the `main` branch.

---

## 🔒 Security Principles

> [!CAUTION]
> **Master Password Warning:** Your Master Password is the ONLY key to your data. If you lose it, your data is mathematically unrecoverable. There is no "Forgot Password" feature by design.

1.  **Key Derivation:** We use **PBKDF2** with 100,000 iterations and a fixed salt to transform your password into a 256-bit cryptographic key.
2.  **Encryption:** Each entry is bundled as a JSON object and encrypted using **AES-GCM**.
3.  **Sync:** Only the resulting base64-encoded encrypted strings are sent to the cloud.

---

## 🛠️ Development

If you'd like to run this locally for testing:
1. Clone the repo.
2. Run a local server (e.g., `npx serve` or VS Code Live Server).
3. Ensure you are using `localhost` or `https`, as the Web Crypto API will not function on an insecure connection.

---
