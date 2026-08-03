const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  return (
    <div className="h-screen h-[100dvh] bg-[#03000a] text-slate-200 flex flex-col items-center justify-center p-0 relative overflow-hidden" id="root-container">`;

const replacement = `  // DEBUG OVERLAY
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const addDebugLog = (msg: string) => {
    setDebugLogs(prev => [...prev, msg].slice(-15));
    console.log("[DEBUG]", msg);
  };
  
  // Attach it to window for global access
  useEffect(() => {
    (window as any).addDebugLog = addDebugLog;
  }, []);

  return (
    <div className="h-screen h-[100dvh] bg-[#03000a] text-slate-200 flex flex-col items-center justify-center p-0 relative overflow-hidden" id="root-container">
      {/* DEBUG UI */}
      <div className="absolute top-10 left-0 z-[9999] bg-black/90 text-green-400 text-[10px] p-2 pointer-events-none w-full max-h-40 overflow-y-auto" dir="ltr" style={{ textAlign: 'left' }}>
        {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
      </div>`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched debug overlay!");
} else {
  console.log("Target not found. Please review the App.tsx file.");
}
