import { useState, useEffect } from "react";
import { getAllUsers, setUserRole, deleteUser, createInvite, getInvites, deleteInvite, getInviteUrl } from "./firebaseHelpers.js";

const SF_BLUE = "#0176D3";
const SF_NAVY = "#032D60";

export default function AdminPanel({ currentUser, onClose }) {
  const [tab, setTab]           = useState("users");
  const [users, setUsers]       = useState([]);
  const [invites, setInvites]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [u, i] = await Promise.all([getAllUsers(), getInvites(currentUser.uid)]);
    setUsers(u.sort((a,b)=>a.email>b.email?1:-1));
    setInvites(i);
    setLoading(false);
  };

  const handleCreateInvite = async () => {
    setCreating(true);
    const { token } = await createInvite(currentUser.uid, currentUser.email);
    await loadAll();
    setCreating(false);
    navigator.clipboard.writeText(getInviteUrl(token));
  };

  const handleCopyInvite = (invite) => {
    navigator.clipboard.writeText(getInviteUrl(invite.token));
    setCopiedId(invite.id);
    setTimeout(()=>setCopiedId(null), 2000);
  };

  const handleDeleteInvite = async (id) => { await deleteInvite(id); setInvites(i=>i.filter(x=>x.id!==id)); };

  const handleRoleChange = async (uid, role) => {
    await setUserRole(uid, role);
    setUsers(u=>u.map(x=>x.id===uid?{...x,role}:x));
  };

  const handleDeleteUser = async (uid, email) => {
    if (!confirm(`Remove ${email}?\n\nNote: removes their Firestore record. Use Firebase Console → Authentication to fully delete their login.`)) return;
    await deleteUser(uid);
    setUsers(u=>u.filter(x=>x.id!==uid));
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString();
  };

  const isExpired = (invite) => {
    const exp = invite.expiresAt?.toDate ? invite.expiresAt.toDate() : new Date(invite.expiresAt);
    return exp < new Date();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:660,maxHeight:"85vh",background:"#fff",borderRadius:16,display:"flex",flexDirection:"column",boxShadow:"0 8px 48px rgba(0,0,0,0.18)"}}>
        <div style={{padding:"20px 24px 0",borderBottom:"1px solid #eee"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontFamily:"Inter, 'Salesforce Sans', Arial, sans-serif",fontSize:20,color:SF_NAVY}}>Admin Panel</div>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#aaa"}}>✕</button>
          </div>
          <div style={{display:"flex"}}>
            {[["users",`Users (${users.length})`],["invites",`Invites (${invites.filter(i=>!i.usedAt&&!isExpired(i)).length} active)`]].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)} style={{padding:"10px 20px",border:"none",background:"none",cursor:"pointer",fontSize:13,fontWeight:600,color:tab===id?SF_BLUE:"#888",borderBottom:tab===id?`2px solid ${SF_BLUE}`:"2px solid transparent"}}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
          {loading ? <div style={{textAlign:"center",color:"#aaa",padding:40}}>Loading…</div>
          : tab==="users" ? (
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:"#fafafa",borderBottom:"2px solid #eee"}}>
                  {["Name","Email","Role","Joined",""].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:11,color:"#888",fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u=>(
                  <tr key={u.id} style={{borderBottom:"1px solid #f0f0f0"}}>
                    <td style={{padding:"10px 12px",fontWeight:600,color:SF_NAVY}}>
                      {u.displayName||"—"}
                      {u.id===currentUser.uid&&<span style={{fontSize:10,color:SF_BLUE,marginLeft:6,background:"#E8F4FD",padding:"1px 6px",borderRadius:3}}>you</span>}
                    </td>
                    <td style={{padding:"10px 12px",color:"#555"}}>{u.email}</td>
                    <td style={{padding:"10px 12px"}}>
                      <select value={u.role||"user"} disabled={u.id===currentUser.uid} onChange={e=>handleRoleChange(u.id,e.target.value)}
                        style={{padding:"4px 8px",borderRadius:6,border:"1px solid #ddd",fontSize:12,cursor:u.id===currentUser.uid?"not-allowed":"pointer",color:u.role==="admin"?SF_BLUE:"#555",background:u.role==="admin"?"#E8F4FD":"#fff"}}>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td style={{padding:"10px 12px",color:"#aaa",fontSize:12}}>{formatDate(u.createdAt)}</td>
                    <td style={{padding:"10px 12px"}}>
                      {u.id!==currentUser.uid&&<button onClick={()=>handleDeleteUser(u.id,u.email)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid #fca5a5",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",color:"#c62828"}}>Remove</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>
              <div style={{background:"#f0f8ff",border:"1px solid #0176D322",borderRadius:10,padding:"16px",marginBottom:20}}>
                <div style={{fontSize:13,color:"#555",marginBottom:12}}>Generate a one-time invite link. Links expire after 7 days.</div>
                <button onClick={handleCreateInvite} disabled={creating} style={{padding:"9px 20px",borderRadius:8,border:"none",background:creating?"#ccc":SF_BLUE,color:"#fff",fontSize:13,fontWeight:700,cursor:creating?"not-allowed":"pointer"}}>
                  {creating?"Creating…":"✉️ Create Invite Link"}
                </button>
                {!creating&&invites.length>0&&<span style={{fontSize:12,color:"#2e7d32",marginLeft:12}}>✓ Link copied to clipboard!</span>}
              </div>
              {invites.length===0 ? <div style={{textAlign:"center",color:"#aaa",padding:20}}>No invites created yet.</div> : (
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr style={{background:"#fafafa",borderBottom:"2px solid #eee"}}>
                      {["Created","Expires","Status",""].map(h=>(
                        <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:11,color:"#888",fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map(inv=>{
                      const used=!!inv.usedAt, expired=!used&&isExpired(inv), active=!used&&!expired;
                      return (
                        <tr key={inv.id} style={{borderBottom:"1px solid #f0f0f0"}}>
                          <td style={{padding:"10px 12px",color:"#555"}}>{formatDate(inv.createdAt)}</td>
                          <td style={{padding:"10px 12px",color:"#aaa"}}>{formatDate(inv.expiresAt)}</td>
                          <td style={{padding:"10px 12px"}}>
                            {used&&<span style={{fontSize:11,fontWeight:700,color:"#2e7d32",background:"#e8f5e9",padding:"2px 8px",borderRadius:4}}>✓ Used by {inv.usedBy}</span>}
                            {expired&&<span style={{fontSize:11,fontWeight:700,color:"#888",background:"#f0f0f0",padding:"2px 8px",borderRadius:4}}>Expired</span>}
                            {active&&<span style={{fontSize:11,fontWeight:700,color:SF_BLUE,background:"#E8F4FD",padding:"2px 8px",borderRadius:4}}>Active</span>}
                          </td>
                          <td style={{padding:"10px 12px",display:"flex",gap:6}}>
                            {active&&<button onClick={()=>handleCopyInvite(inv)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid #ddd",background:copiedId===inv.id?"#e8f5e9":"#fff",fontSize:12,fontWeight:600,cursor:"pointer",color:copiedId===inv.id?"#2e7d32":"#555"}}>
                              {copiedId===inv.id?"✓ Copied!":"🔗 Copy"}
                            </button>}
                            {!used&&<button onClick={()=>handleDeleteInvite(inv.id)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid #fca5a5",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",color:"#c62828"}}>Delete</button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
