const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `                    <button
                      onClick={async () => {
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
                      }}
                      disabled={authLoading}`;

const replacement = `                    <button
                      onClick={async () => {
                        setAuthLoading(true);
                        setAuthError('');
                        try {
                          const provider = new GoogleAuthProvider();
                          await signInWithPopup(auth, provider);
                          // Keep loading true while onAuthStateChanged handles the transition
                          setIsAuthChecking(true);
                        } catch (err: any) {
                          setAuthError(err.message || 'فشل تسجيل الدخول عبر Google');
                        } finally {
                          setAuthLoading(false);
                        }
                      }}
                      disabled={authLoading}`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched Google button loading behavior!");
} else {
  console.log("Target not found");
}
