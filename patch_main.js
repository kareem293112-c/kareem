const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf-8');
const interceptor = `
// Intercept and suppress Firebase Quota errors to prevent them from crashing the AI Studio preview
const originalConsoleError = console.error;
console.error = (...args) => {
  const hasQuotaError = args.some(arg => {
    if (typeof arg === 'string') {
      return arg.includes('resource-exhausted') || arg.includes('Quota limit exceeded') || arg.includes('Quota');
    }
    if (arg instanceof Error) {
      return arg.message.includes('resource-exhausted') || arg.message.includes('Quota limit exceeded') || arg.message.includes('Quota');
    }
    if (arg && typeof arg === 'object' && arg.code === 'resource-exhausted') {
      return true;
    }
    return false;
  });

  if (hasQuotaError) {
    if (!(window as any).__quotaAlertShown) {
      alert("عذراً، تم الوصول إلى الحد الأقصى المجاني لقاعدة البيانات (Quota Exceeded). بعض الميزات قد لا تعمل حالياً حتى يتم تجديد الباقة غداً.");
      (window as any).__quotaAlertShown = true;
    }
    return;
  }
  originalConsoleError(...args);
};
`;

if (!code.includes('originalConsoleError')) {
  code = code.replace("import './index.css';", "import './index.css';\n" + interceptor);
  fs.writeFileSync('src/main.tsx', code);
  console.log("Patched main.tsx");
} else {
  console.log("Already patched");
}
