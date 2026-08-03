const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `                        onClick={async () => {
                          setAuthLoading(true);
                          setAuthError('');
                          try {
                            const provider = new GoogleAuthProvider();
                            await signInWithPopup(auth, provider);
                          } catch (err: any) {
                            setAuthError(err.message || 'فشل تسجيل الدخول عبر Google');
                          } finally {
                            setAuthLoading(false);
                          }
                        }}`;

const replacement = `                        onClick={async () => {
                          setAuthLoading(true);
                          setAuthError('');
                          try {
                            const provider = new GoogleAuthProvider();
                            await signInWithPopup(auth, provider);
                            // Do not set authLoading(false) immediately on success, let onAuthStateChanged handle the transition.
                            // Just set a loading overlay instead.
                            setIsAuthChecking(true);
                          } catch (err: any) {
                            setAuthError(err.message || 'فشل تسجيل الدخول عبر Google');
                            setAuthLoading(false);
                          }
                        }}`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched auth loading state for Google button!");
} else {
  console.log("Target not found");
}
