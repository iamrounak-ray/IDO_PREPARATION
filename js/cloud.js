// Firebase sync layer. Loaded as an ES module. Exposes window.CLOUD and fires "cloud-ready".
// Only runs when js/config.js provides window.FIREBASE_CONFIG.
const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const cfg = window.FIREBASE_CONFIG;

async function boot() {
  if (!cfg || !cfg.apiKey) { window.CLOUD = { enabled: false }; return; }
  const [{ initializeApp }, A, F] = await Promise.all([
    import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js")
  ]);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  await A.setPersistence(auth, A.browserLocalPersistence);
  const PENDING = "ido:pendingSignIn";
  const pending = {
    get() { try { return JSON.parse(localStorage.getItem(PENDING) || "null"); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(PENDING, JSON.stringify(v)); } catch (e) {} },
    clear() { try { localStorage.removeItem(PENDING); } catch (e) {} }
  };
  const hashCode = async (code) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ido-practice-room:" + code));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  };
  const returnUrl = () => location.origin + location.pathname;

  const CLOUD = {
    enabled: true,
    user: null,
    pending,
    hasLink: () => A.isSignInWithEmailLink(auth, location.href),
    async sendLink(email, info) {
      await A.sendSignInLinkToEmail(auth, email, { url: returnUrl(), handleCodeInApp: true });
      pending.set({ ...info, email, at: Date.now() });
    },
    async completeLink(email) {
      const cred = await A.signInWithEmailLink(auth, email, location.href);
      try { history.replaceState(null, "", returnUrl()); } catch (e) {}
      CLOUD.user = cred.user; return cred.user;
    },
    async register(email, password) {
      const cred = await A.createUserWithEmailAndPassword(auth, email, password);
      CLOUD.user = cred.user; return cred.user;
    },
    async login(email, password) {
      const cred = await A.signInWithEmailAndPassword(auth, email, password);
      CLOUD.user = cred.user; return cred.user;
    },
    async resetPassword(email) { await A.sendPasswordResetEmail(auth, email); },
    async getProfile() {
      if (!CLOUD.user) return null;
      const s = await F.getDoc(F.doc(db, "users", CLOUD.user.uid));
      return s.exists() ? s.data() : null;
    },
    async createProfile(name, code) {
      const u = CLOUD.user; if (!u) throw new Error("not signed in");
      const h = await hashCode(code);
      const b = F.writeBatch(db);
      b.set(F.doc(db, "redemptions", h), { uid: u.uid, at: F.serverTimestamp() });
      b.set(F.doc(db, "users", u.uid), { name, email: u.email, codeHash: h, created: F.serverTimestamp() });
      try { await b.commit(); return { ok: true }; }
      catch (e) {
        if (e && e.code === "permission-denied") {
          let used = false;
          try { used = (await F.getDoc(F.doc(db, "redemptions", h))).exists(); } catch (x) {}
          return { ok: false, reason: used ? "used" : "invalid" };
        }
        return { ok: false, reason: "network", message: e && e.message };
      }
    },
    async renameProfile(name) { await F.updateDoc(F.doc(db, "users", CLOUD.user.uid), { name }); },
    async loadStore() {
      const out = {}; const snap = await F.getDocs(F.collection(db, "users", CLOUD.user.uid, "store"));
      snap.forEach(d => { try { out[d.id] = JSON.parse(d.data().v); } catch (e) {} });
      return out;
    },
    async saveKey(k, v) {
      if (!CLOUD.user) return;
      const ref = F.doc(db, "users", CLOUD.user.uid, "store", k);
      if (v === null || v === undefined) return F.deleteDoc(ref);
      return F.setDoc(ref, { v: JSON.stringify(v), at: F.serverTimestamp() });
    },
    async deleteProfile() {
      const uid = CLOUD.user.uid;
      const snap = await F.getDocs(F.collection(db, "users", uid, "store"));
      for (const d of snap.docs) await F.deleteDoc(d.ref);
      await F.deleteDoc(F.doc(db, "users", uid));
    },
    async signOut() { await A.signOut(auth); CLOUD.user = null; }
  };
  window.CLOUD = CLOUD;
  await new Promise(res => { const off = A.onAuthStateChanged(auth, u => { CLOUD.user = u; off(); res(); }); });
}

boot().catch(e => { console.error("Firebase failed to start", e); window.CLOUD = { enabled: true, failed: true, error: String(e && e.message || e) }; })
  .finally(() => window.dispatchEvent(new Event("cloud-ready")));
