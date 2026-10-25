import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Check, ChartNoAxesCombined, LoaderCircle, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import type { User } from '../types';

export function Auth({ onSuccess }: { onSuccess: (user: User) => void }) {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const email = String(form.get('email'));
      const password = String(form.get('password'));
      const user = register
        ? await api.register({ name: String(form.get('name')), email, password, currency: String(form.get('currency')) })
        : await api.login(email, password);
      onSuccess(user);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to sign in.');
    } finally { setBusy(false); }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <a className="brand" href="/"><span className="brand-mark"><Wallet size={22} strokeWidth={2.3} /></span>daybook<span className="brand-dot">.</span></a>
        <div className="auth-story-content"><span className="eyebrow"><Sparkles size={14} /> SMALL HABITS. BIG CLARITY.</span><h1>Make sense of<br />your everyday<br /><span>spending.</span></h1><p>A little coffee. A night out. The weekly shop.<br />Bring it all together, one day at a time.</p>
          <div className="auth-feature"><span><ChartNoAxesCombined size={19} /></span><div><strong>Your money, in perspective</strong><p>Simple insights. No spreadsheets required.</p></div></div>
          <div className="auth-feature"><span><ShieldCheck size={19} /></span><div><strong>Private by design</strong><p>Your expenses belong to you, and only you.</p></div></div>
        </div>
        <span className="auth-footer">A little clarity goes a long way.</span>
        <div className="auth-decoration" aria-hidden="true"><div /><div /><div /><div /><div /><div /><div /></div>
      </section>
      <section className="auth-form-side">
        <div className="auth-card"><span className="welcome-icon"><Wallet size={27} /></span><h2>{register ? 'Your fresh start.' : 'Welcome back.'}</h2><p>{register ? 'Start building a better picture of your spending.' : 'Let’s see how your day is adding up.'}</p>
          <form onSubmit={submit} className="auth-form" key={String(register)}>
            {error && <div className="error-message" role="alert">{error}</div>}
            {register && <label>Your name<input name="name" placeholder="Alex Morgan" autoComplete="name" required maxLength={80} /></label>}
            <label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required maxLength={254} /></label>
            <label>Password<input name="password" type="password" placeholder={register ? 'At least 10 characters' : 'Enter your password'} autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 10 : 1} maxLength={128} /></label>
            {register && <label>Your currency<select name="currency" defaultValue="USD"><option value="USD">USD · US Dollar</option><option value="EUR">EUR · Euro</option><option value="GBP">GBP · British Pound</option><option value="INR">INR · Indian Rupee</option><option value="CAD">CAD · Canadian Dollar</option><option value="AUD">AUD · Australian Dollar</option></select><small>One currency per account. No currency conversion.</small></label>}
            <button className="button primary" disabled={busy}>{busy ? <LoaderCircle size={18} className="animate-spin" /> : <>{register ? 'Create your account' : 'Sign in'}<ArrowRight size={18} /></>}</button>
          </form>
          <p className="auth-switch">{register ? 'Already have an account?' : 'New to Daybook?'} <button disabled={busy} onClick={() => { setRegister(!register); setError(''); }}>{register ? 'Sign in' : 'Create an account'}</button></p>
          <div className="auth-reassurance"><Check size={14} />No bank connections. Just you and your expenses.</div>
        </div>
      </section>
    </main>
  );
}
