// webauthn-lock.js
//
// Uses the browser's WebAuthn API to trigger the device's real biometric prompt
// (Face ID on iPhone/iPad, Touch ID on Mac, fingerprint on Android Chrome).
// This is a client-only pattern meant for personal app-locking, not a full
// server-verified login system — good enough to gate your own device's app,
// not meant to protect against a sophisticated attacker.
//
// IMPORTANT: This requires being served over HTTPS (or localhost). It will NOT
// work if you just open index.html as a local file:// page — you must host it
// (see the iPad setup guide) for Face ID to actually trigger.

const WebAuthnLock = (() => {
  const CRED_ID_KEY = "heart_webauthn_cred_id";

  function supported() {
    return !!(window.PublicKeyCredential && navigator.credentials);
  }

  function randomBytes(len) {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return arr;
  }

  function hasEnrollment() {
    return !!localStorage.getItem(CRED_ID_KEY);
  }

  // One-time setup: registers a platform credential (prompts Face ID/Touch ID)
  async function enroll() {
    const challenge = randomBytes(32);
    const userId = randomBytes(16);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Heart" },
        user: {
          id: userId,
          name: "heart-user",
          displayName: "Heart User"
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },   // ES256
          { type: "public-key", alg: -257 }  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // forces Face ID/Touch ID, not a security key
          userVerification: "required"
        },
        timeout: 60000
      }
    });

    if (!credential) throw new Error("No credential created");
    const idB64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    localStorage.setItem(CRED_ID_KEY, idB64);
    return true;
  }

  // Prompts Face ID/Touch ID and resolves true if it succeeds
  async function unlock() {
    const idB64 = localStorage.getItem(CRED_ID_KEY);
    if (!idB64) return false;

    const rawId = Uint8Array.from(atob(idB64), c => c.charCodeAt(0));
    const challenge = randomBytes(32);

    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ id: rawId, type: "public-key" }],
          userVerification: "required",
          timeout: 60000
        }
      });
      return !!assertion;
    } catch (e) {
      return false;
    }
  }

  function clearEnrollment() {
    localStorage.removeItem(CRED_ID_KEY);
  }

  return { supported, hasEnrollment, enroll, unlock, clearEnrollment };
})();
