import { useState, useEffect } from "react";
import { saveScenario, getMyScenarios, getSharedScenarios, deleteScenario, updateScenarioPermission, getShareUrl } from "./firebaseHelpers.js";

const SF_BLUE = "#0176D3";
const SF_NAVY = "#032D60";
const PERM_LABELS = {
  private: { label:"Private",   color:"#888",    bg:"#f0f0f0",  icon:"🔒" },
  view:    { label:"View link", color:"#0176D3", bg:"#E8F4FD",  icon:"👁" },
  edit:    { label:"Edit link", color:"#2e7d32", bg:"#e8f5e9",  icon:"✏️" },
};

export default function ScenarioManager({ user, userRole, currentState, onLoad, onClose }) {
  const [tab, setTab]           = useState("mine");
  const [mine, setMine]         = useState([]);
  const [shared, setShared]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savePerm, setSavePerm] = useState("private");
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [m, s] = await Promise.all([getMyScenarios(user.uid), getSharedScenarios(user.uid)]);
    setMine(m); setShared(s); setLoading(false);
  };

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      await saveScenario(user.uid, user, null, saveName.trim(), currentState, savePerm);
      setSaveName(""); setSavePerm("private");
      await loadAll();
    } finally { setSaving(false); }
  };

  const handleOverwrite = async (s) => {
    if (!confirm(`Overwrite "${s.name}" with current scenario?`)) return;
    await saveScenario(user.uid, user, s.id, s.name, currentState, s.permission);
    await loadAll();
  };

  const handleDelete = async (s) => {
    if (!confirm(`Delete "${s.name}"?`)) return;
    await deleteScenario(s.id); await loadAll();
  };

  const handlePermChange = async (s, perm) => {
    await updateScenarioPermission(s.id, perm); await loadAll();
  };

  const handleCopyLink = (s) => {
    navigator.clipboard.writeText(getShareUrl(s.id, s.shareToken));
    setCopiedId(s.id); setTimeout(() => setCopiedId(null), 2000);
  };

  const iStyle = { width:"100%", padding:"9px 12px", border:"1px solid #ddd", borderRadius:8, fontSize:13, color:SF_NAVY, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };

  const ScenarioRow = ({ s, canEdit }) => {
    const perm = PERM_LABELS[s.permission] ?? PERM_LABELS.private;
    const ts = s.updatedAt?.toDate ? s.updatedAt.toDate().toLocaleDateString() : "—";
    return (
      <div style={{background:"#fafafa",border:"1px solid #eee",borderRadius:10,padding:"12px 16px",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,color:SF_NAVY,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
            <div style={{fontSize:11,color:"#aaa",marginTop:2}}>{canEdit?`Updated ${ts}`:`By ${s.ownerName} · ${ts}`}</div>
          </div>
          <span style={{fontSize:11,fontWeight:700,color:perm.color,background:perm.bg,padding:"2px 8px",borderRadius:4,whiteSpace:"nowrap",flexShrink:0}}>{perm.icon} {perm.label}</span>
        </div>
        <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
          <button onClick={()=>{onLoad(s.data);onClose();}} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${SF_BLUE}`,background:SF_BLUE,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Load</button>
          {canEdit && <>
            <button onClick={()=>handleOverwrite(s)} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",color:"#555"}}>Save current →</button>
            <select value={s.permission} onChange={e=>handlePermChange(s,e.target.value)} style={{padding:"5px 8px",borderRadius:6,border:"1px solid #ddd",fontSize:12,cursor:"pointer",color:"#555"}}>
              <option value="private">🔒 Private</option>
              <option value="view">👁 View link</option>
              <option value="edit">✏️ Edit link</option>
            </select>
            {s.permission!=="private" && (
              <button onClick={()=>handleCopyLink(s)} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:copiedId===s.id?"#e8f5e9":"#fff",fontSize:12,fontWeight:600,cursor:"pointer",color:copiedId===s.id?"#2e7d32":"#555"}}>
                {copiedId===s.id?"✓ Copied!":"🔗 Copy link"}
              </button>
            )}
            <button onClick={()=>handleDelete(s)} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #fca5a5",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",color:"#c62828",marginLeft:"auto"}}>Delete</button>
          </>}
        </div>
      </div>
    );
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:580,maxHeight:"85vh",background:"#fff",borderRadius:16,display:"flex",flexDirection:"column",boxShadow:"0 8px 48px rgba(0,0,0,0.18)"}}>
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #eee",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:"Inter, 'Salesforce Sans', Arial, sans-serif",fontSize:20,color:SF_NAVY}}>Scenarios</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#aaa"}}>✕</button>
        </div>
        <div style={{padding:"16px 24px",borderBottom:"1px solid #eee",background:"#fafeff"}}>
          <div style={{fontSize:12,fontWeight:700,color:SF_BLUE,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Save Current Scenario</div>
          <div style={{display:"flex",gap:8}}>
            <input style={{...iStyle,flex:1}} placeholder="Scenario name…" value={saveName} onChange={e=>setSaveName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSave()} />
            <select value={savePerm} onChange={e=>setSavePerm(e.target.value)} style={{padding:"9px 10px",borderRadius:8,border:"1px solid #ddd",fontSize:12,cursor:"pointer",color:"#555"}}>
              <option value="private">🔒 Private</option>
              <option value="view">👁 View link</option>
              <option value="edit">✏️ Edit link</option>
            </select>
            <button onClick={handleSave} disabled={saving||!saveName.trim()} style={{padding:"9px 18px",borderRadius:8,border:"none",background:saveName.trim()?SF_BLUE:"#ccc",color:"#fff",fontSize:13,fontWeight:700,cursor:saveName.trim()?"pointer":"not-allowed",whiteSpace:"nowrap"}}>
              {saving?"Saving…":"Save"}
            </button>
          </div>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid #eee"}}>
          {[["mine",`My Scenarios (${mine.length})`],["shared",`Shared with me (${shared.length})`]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:"12px 20px",border:"none",background:"none",cursor:"pointer",fontSize:13,fontWeight:600,color:tab===id?SF_BLUE:"#888",borderBottom:tab===id?`2px solid ${SF_BLUE}`:"2px solid transparent"}}>
              {label}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 24px"}}>
          {loading ? <div style={{textAlign:"center",color:"#aaa",padding:40}}>Loading…</div>
          : tab==="mine" ? (mine.length===0 ? <div style={{textAlign:"center",color:"#aaa",padding:40}}>No saved scenarios yet.</div> : mine.map(s=><ScenarioRow key={s.id} s={s} canEdit={true}/>))
          : (shared.length===0 ? <div style={{textAlign:"center",color:"#aaa",padding:40}}>No shared scenarios yet.</div> : shared.map(s=><ScenarioRow key={s.id} s={s} canEdit={s.permission==="edit"}/>))}
        </div>
      </div>
    </div>
  );
}
