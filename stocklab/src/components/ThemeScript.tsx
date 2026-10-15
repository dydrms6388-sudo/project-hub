/** FOUC 방지: 저장된 테마 또는 OS 선호를 <html class="dark"> 로 즉시 반영 */
export function ThemeScript() {
  const code = `try{var t=localStorage.getItem('sl-theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
