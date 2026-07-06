import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, addDoc,
} from "firebase/firestore";

export function listenAuth(cb) { return onAuthStateChanged(auth, cb); }

export async function signUp(email, password, displayName, inviteToken) {
  const invite = await validateInviteToken(inviteToken);
  if (!invite) throw { code: "auth/invalid-invite", message: "Invalid or expired invite link." };
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await setDoc(doc(db, "users", cred.user.uid), {
    email, displayName, role: "user",
    createdAt: serverTimestamp(), invitedBy: invite.createdBy,
  });
  await updateDoc(doc(db, "invites", invite.id), { usedAt: serverTimestamp(), usedBy: email });
  return cred.user;
}

export async function logIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logOut() { await signOut(auth); }

export async function resetPassword(email) { await sendPasswordResetEmail(auth, email); }

// ── Invites ───────────────────────────────────────────────────────────────────

export async function createInvite(adminUid, adminEmail) {
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const ref = await addDoc(collection(db, "invites"), {
    token, createdBy: adminEmail, createdByUid: adminUid,
    createdAt: serverTimestamp(), expiresAt, usedAt: null, usedBy: null,
  });
  return { id: ref.id, token };
}

export async function validateInviteToken(token) {
  if (!token) return null;
  const q = query(collection(db, "invites"), where("token", "==", token));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const invite = { id: snap.docs[0].id, ...snap.docs[0].data() };
  if (invite.usedAt) return null;
  const exp = invite.expiresAt?.toDate ? invite.expiresAt.toDate() : new Date(invite.expiresAt);
  if (exp < new Date()) return null;
  return invite;
}

export async function getInvites(adminUid) {
  // No orderBy — avoids requiring a composite index
  const q = query(collection(db, "invites"), where("createdByUid", "==", adminUid));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export async function deleteInvite(inviteId) { await deleteDoc(doc(db, "invites", inviteId)); }

export function getInviteUrl(token) { return `${window.location.origin}?invite=${token}`; }

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllUsers() {
  // No orderBy — avoids requiring a composite index
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function setUserRole(uid, role) { await updateDoc(doc(db, "users", uid), { role }); }

export async function deleteUser(uid) { await deleteDoc(doc(db, "users", uid)); }

// ── Scenarios ─────────────────────────────────────────────────────────────────

export async function saveScenario(uid, userInfo, scenarioId, name, data, permission = "private") {
  const payload = {
    ownerId: uid, ownerEmail: userInfo.email,
    ownerName: userInfo.displayName || userInfo.email,
    name, permission, updatedAt: serverTimestamp(), data,
  };
  if (scenarioId) {
    await updateDoc(doc(db, "scenarios", scenarioId), payload);
    return scenarioId;
  } else {
    payload.createdAt = serverTimestamp();
    payload.shareToken = Math.random().toString(36).slice(2, 10);
    const ref = await addDoc(collection(db, "scenarios"), payload);
    return ref.id;
  }
}

export async function getScenario(scenarioId) {
  const snap = await getDoc(doc(db, "scenarios", scenarioId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getMyScenarios(uid) {
  const q = query(collection(db, "scenarios"), where("ownerId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));
}

export async function getSharedScenarios(uid) {
  const q = query(collection(db, "scenarios"), where("permission", "in", ["view", "edit"]));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => s.ownerId !== uid)
    .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));
}

export async function updateScenarioPermission(scenarioId, permission) {
  await updateDoc(doc(db, "scenarios", scenarioId), { permission });
}

export async function deleteScenario(scenarioId) { await deleteDoc(doc(db, "scenarios", scenarioId)); }

export function getShareUrl(scenarioId, token) {
  return `${window.location.origin}?scenario=${scenarioId}&token=${token}`;
}
