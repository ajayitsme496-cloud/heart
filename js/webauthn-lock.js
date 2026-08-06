const WebAuthnLock = (() => {
  const CREDENTIAL_ID_KEY = "heart_webauthn_credential_id";

  function supported() {
    return window.PublicKeyCredential !== undefined && navigator.credentials !== undefined;
  }

  async function enroll() {
    if (!supported()) throw new Error("WebAuthn not supported");
    const options = {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Heart" },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: "user@heart.local",
        displayName: "Heart User"
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      attestation: "direct",
      timeout: 60000,
      userVerification: "preferred"
    };

    const credential = await navigator.credentials.create({ publicKey: options });
    if (!credential) throw new Error("Enrollment cancelled");

    localStorage.setItem(CREDENTIAL_ID_KEY, btoa(String.fromCharCode(...new Uint8Array(credential.id))));
    return true;
  }

  async function unlock() {
    if (!supported()) return true;
    const credentialIdB64 = localStorage.getItem(CREDENTIAL_ID_KEY);
    if (!credentialIdB64) return true;

    try {
      const credentialIdBinary = Uint8Array.from(atob(credentialIdB64), c => c.charCodeAt(0));
      const options = {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: credentialIdBinary, type: "public-key" }],
        timeout: 60000,
        userVerification: "preferred"
      };

      const assertion = await navigator.credentials.get({ publicKey: options });
      return !!assertion;
    } catch (e) {
      return false;
    }
  }

  return { supported, enroll, unlock };
})();
