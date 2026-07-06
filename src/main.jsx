import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import LoginScreen from './LoginScreen.jsx'
import { listenAuth } from './firebaseHelpers.js'

function Root() {
  const [user, setUser] = useState(undefined);
  useEffect(() => { return listenAuth(u => setUser(u ?? null)); }, []);
  if (user === undefined) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#aaa",fontFamily:"Inter, 'Salesforce Sans', Arial, sans-serif",fontSize:14}}>Loading…</div>;
  if (!user) return <LoginScreen onLogin={setUser} />;
  return <App user={user} />;
}

createRoot(document.getElementById('root')).render(<StrictMode><Root /></StrictMode>)
