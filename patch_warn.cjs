const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf-8');

const warnPatch = `
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const hasQuotaError = args.some(arg => {
    if (typeof arg === 'string') {
      return arg.includes('resource-exhausted') || arg.includes('Quota limit exceeded') || arg.includes('Quota') || arg.includes('maximum backoff delay');
    }
    if (arg instanceof Error) {
      return arg.message.includes('resource-exhausted') || arg.message.includes('Quota limit exceeded') || arg.message.includes('Quota') || arg.message.includes('maximum backoff delay');
    }
    if (arg && typeof arg === 'object' && arg.code === 'resource-exhausted') {
      return true;
    }
    return false;
  });

  if (hasQuotaError) {
    return;
  }
  originalConsoleWarn(...args);
};
`;

if (!code.includes('originalConsoleWarn')) {
  code = code.replace("const originalConsoleError = console.error;", warnPatch + "\nconst originalConsoleError = console.error;");
  
  // also add maximum backoff delay to error interceptor
  code = code.replace(/arg\.includes\('Quota'\)/g, "arg.includes('Quota') || arg.includes('maximum backoff delay')");
  fs.writeFileSync('src/main.tsx', code);
  console.log("Patched main.tsx with warn");
} else {
  console.log("Already patched warn");
}
