import { useState, useEffect } from "react";
import { logIn, signUp, validateInviteToken, resetPassword } from "./firebaseHelpers.js";

const SF_BLUE = "#0176D3";
const SF_NAVY = "#032D60";

export default function LoginScreen({ onLogin }) {
  const [mode, setMode]               = useState("login");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [name, setName]               = useState("");
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");
  const [loading, setLoading]         = useState(false);
  const [inviteToken, setInviteToken] = useState(null);
  const [inviteValid, setInviteValid] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (token) {
      setMode("signup");
      setInviteToken(token);
      validateInviteToken(token).then(invite => {
        setInviteValid(!!invite);
        if (!invite) setError("This invite link is invalid or has already been used.");
      });
    }
  }, []);

  const handle = async () => {
    setError(""); setSuccess("");
    setLoading(true);
    try {
      if (mode === "reset") {
        if (!email.trim()) { setError("Please enter your email address."); setLoading(false); return; }
        await resetPassword(email.trim());
        setSuccess("Password reset email sent! Check your inbox.");
        setLoading(false);
        return;
      }
      if (mode === "login") {
        const user = await logIn(email, password);
        onLogin(user);
      } else {
        if (!name.trim()) { setError("Please enter your name."); setLoading(false); return; }
        if (!inviteToken) { setError("You need a valid invite link to sign up."); setLoading(false); return; }
        if (inviteValid === false) { setError("This invite link is invalid or has already been used."); setLoading(false); return; }
        const user = await signUp(email, password, name.trim(), inviteToken);
        window.history.replaceState({}, "", window.location.pathname);
        onLogin(user);
      }
    } catch (e) {
      const msgs = {
        "auth/invalid-email": "Invalid email address.",
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/email-already-in-use": "An account already exists with this email.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/invalid-invite": "This invite link is invalid or has already been used.",
      };
      setError(msgs[e.code] || e.message);
    } finally {
      setLoading(false);
    }
  };

  const iStyle = { width:"100%", padding:"10px 14px", border:"1px solid #ddd", borderRadius:8, fontSize:14, color:SF_NAVY, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
  const switchMode = (m) => { setMode(m); setError(""); setSuccess(""); };

  return (
    <div style={{minHeight:"100vh",background:"#f5f7fa",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:400,background:"#fff",borderRadius:16,padding:"40px 40px 36px",boxShadow:"0 4px 24px rgba(0,0,0,0.10)"}}>
        <div style={{marginBottom:32,textAlign:"center"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:8}}>
            <div style={{width:36,height:36,background:SF_BLUE,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{color:"#fff",fontSize:18}}>⬡</span>
            </div>
            <span style={{fontFamily:"Inter, 'Salesforce Sans', Arial, sans-serif",fontSize:20,color:SF_NAVY,fontWeight:700}}>Space Planner</span>
          </div>
          <div style={{fontSize:13,color:"#888"}}>Salesforce Global Design Standards</div>
        </div>
        {mode==="signup" && inviteToken && (
          <div style={{background:inviteValid===false?"#fef2f2":"#e8f5e9",border:`1px solid ${inviteValid===false?"#fca5a5":"#a5d6a7"}`,borderRadius:8,padding:"10px 14px",fontSize:13,color:inviteValid===false?"#c62828":"#2e7d32",marginBottom:16,textAlign:"center"}}>
            {inviteValid===null?"Checking invite link…":inviteValid?"✓ Valid invite — create your account below":"✗ Invalid or expired invite link"}
          </div>
        )}
        <div style={{fontSize:18,fontWeight:700,color:SF_NAVY,marginBottom:24}}>
          {mode==="login"?"Sign in to your account":mode==="signup"?"Create your account":"Reset your password"}
        </div>
        {mode==="signup" && (
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,fontWeight:600,color:"#555",display:"block",marginBottom:5}}>Full Name</label>
            <input style={iStyle} type="text" value={name} placeholder="Jane Smith" onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} />
          </div>
        )}
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:600,color:"#555",display:"block",marginBottom:5}}>Email</label>
          <input style={iStyle} type="email" value={email} placeholder="you@salesforce.com" onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} />
        </div>
        {mode!=="reset" && (
          <div style={{marginBottom:mode==="login"?8:24}}>
            <label style={{fontSize:12,fontWeight:600,color:"#555",display:"block",marginBottom:5}}>Password</label>
            <input style={iStyle} type="password" value={password} placeholder="••••••••" onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} />
          </div>
        )}
        {mode==="login" && (
          <div style={{textAlign:"right",marginBottom:20}}>
            <span onClick={()=>switchMode("reset")} style={{fontSize:12,color:SF_BLUE,cursor:"pointer",fontWeight:600}}>Forgot password?</span>
          </div>
        )}
        {mode==="reset" && <div style={{fontSize:13,color:"#888",marginBottom:20}}>Enter your email and we'll send you a link to reset your password.</div>}
        {error && <div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#c62828",marginBottom:16}}>{error}</div>}
        {success && <div style={{background:"#e8f5e9",border:"1px solid #a5d6a7",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#2e7d32",marginBottom:16}}>{success}</div>}
        <button onClick={handle} disabled={loading||(mode==="signup"&&inviteValid===false)}
          style={{width:"100%",padding:"12px",borderRadius:8,border:"none",background:loading||(mode==="signup"&&inviteValid===false)?"#ccc":SF_BLUE,color:"#fff",fontSize:14,fontWeight:700,cursor:loading||(mode==="signup"&&inviteValid===false)?"not-allowed":"pointer"}}>
          {loading?"Please wait…":mode==="login"?"Sign In":mode==="signup"?"Create Account":"Send Reset Email"}
        </button>
        <div style={{textAlign:"center",marginTop:20,fontSize:13,color:"#888"}}>
          {mode==="login" && <>Don't have an account? Contact your admin for an invite link.</>}
          {mode==="signup" && <>Already have an account?{" "}<span onClick={()=>switchMode("login")} style={{color:SF_BLUE,cursor:"pointer",fontWeight:600}}>Sign in</span></>}
          {mode==="reset" && <>Remember your password?{" "}<span onClick={()=>switchMode("login")} style={{color:SF_BLUE,cursor:"pointer",fontWeight:600}}>Back to sign in</span></>}
        </div>
      </div>
    </div>
  );
}
