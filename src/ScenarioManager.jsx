import { useState, useEffect } from "react";
import { saveScenario, getScenarios, deleteScenario } from "./scenarioStore.js";

const SF_BLUE = "#0176D3";
const SF_NAVY = "#032D60";

export default function ScenarioManager({ currentState, onLoad, onClose }) {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saveName, setSaveName]   = useState("");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    setScenarios(await getScenarios());
    setLoading(false);
  };

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      await saveScenario(null, saveName.trim(), currentState);
      setSaveName("");
      await loadAll();
    } finally { setSaving(false); }
  };

  const handleOverwrite = async (s) => {
    if (!confirm(`Overwrite "${s.name}" with current scenario?`)) return;
    await saveScenario(s.id, s.name, currentState);
    await loadAll();
  };

  const handleDelete = async (s) => {
    if (!confirm(`Delete "${s.name}"?`)) return;
    await deleteScenario(s.id); await loadAll();
  };

  const iStyle = { width:"100%", padding:"9px 12px", border:"1px solid #ddd", borderRadius:8, fontSize:13, color:SF_NAVY, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };

  const ScenarioRow = ({ s }) => {
    const ts = s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : "—";
    return (
      <div style={{background:"#fafafa",border:"1px solid #eee",borderRadius:10,padding:"12px 16px",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,color:SF_NAVY,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
            <div style={{fontSize:11,color:"#aaa",marginTop:2}}>Updated {ts}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
          <button onClick={()=>{onLoad(s.data);onClose();}} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${SF_BLUE}`,background:SF_BLUE,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Load</button>
          <button onClick={()=>handleOverwrite(s)} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",color:"#555"}}>Save current →</button>
          <button onClick={()=>handleDelete(s)} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #fca5a5",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",color:"#c62828",marginLeft:"auto"}}>Delete</button>
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
            <button onClick={handleSave} disabled={saving||!saveName.trim()} style={{padding:"9px 18px",borderRadius:8,border:"none",background:saveName.trim()?SF_BLUE:"#ccc",color:"#fff",fontSize:13,fontWeight:700,cursor:saveName.trim()?"pointer":"not-allowed",whiteSpace:"nowrap"}}>
              {saving?"Saving…":"Save"}
            </button>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 24px"}}>
          {loading ? <div style={{textAlign:"center",color:"#aaa",padding:40}}>Loading…</div>
          : scenarios.length===0 ? <div style={{textAlign:"center",color:"#aaa",padding:40}}>No saved scenarios yet.</div>
          : scenarios.map(s=><ScenarioRow key={s.id} s={s}/>)}
        </div>
      </div>
    </div>
  );
}
