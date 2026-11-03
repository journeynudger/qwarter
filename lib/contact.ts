import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const reply = (body: object, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
const unavailable = () => reply({error:'The form is temporarily unavailable. Please email info@qwarter.com.'},503);
const signature = (value: string, secret: string) => createHmac('sha256',secret).update(`qwarter-contact:${value}`).digest('hex');

export function createContactHandlers(config: {url?: string; enabled?: string; fetcher?: typeof fetch; now?: () => number}) {
  const now = config.now ?? Date.now;
  // A bounded warm-instance guard against accidental repeats, alongside the client submit lock.
  const accepted = new Map<string,number>();
  const sending = new Set<string>();
  const ready = () => config.enabled === '1' && config.url?.startsWith('https://hooks.airtable.com/');
  return {
    GET: async () => {
      if (!ready()) return unavailable();
      const payload = `${randomUUID()}.${now()}`;
      return reply({token:`${payload}.${signature(payload,config.url!)}`});
    },
    POST: async (request: Request) => {
      if (!ready()) return unavailable();
      if (request.headers.get('origin') !== new URL(request.url).origin) return reply({error:'Please submit the form from this website.'},403);
      if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({error:'Invalid form format.'},415);
      if (Number(request.headers.get('content-length')) > 20000) return reply({error:'Your message is too long.'},413);
      let body: Record<string,unknown>;
      try { const raw = await request.text(); if (raw.length > 20000) return reply({error:'Your message is too long.'},413); body = JSON.parse(raw); } catch { return reply({error:'Please check your form.'},400); }
      if (!body || Array.isArray(body)) return reply({error:'Please check your form.'},400);
      if (typeof body.token !== 'string') return reply({error:'Please reload this page before submitting.'},400);
      const [id,time,sig] = body.token.split('.');
      const expected = signature(`${id}.${time}`,config.url!);
      if (!/^[a-f0-9]{64}$/.test(sig || '') || !timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return reply({error:'Please reload this page before submitting.'},400);
      const age = now() - Number(time);
      if (!Number.isFinite(age) || age < 1500 || age > 3600000) return reply({error:age < 1500 ? 'Please wait a moment, then send your message.' : 'This form has expired. Please reload the page; your message has not been sent.'},400);
      if (body.website) return reply({error:'Please check your form.'},400);
      const value = (key: string) => typeof body[key] === 'string' ? body[key].trim() : '';
      const name = value('name'), email = value('email'), message = value('message');
      if (!name || name.length > 120 || /[\r\n]/.test(name) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10 || message.length > 6000) return reply({error:'Please enter your name, a valid email, and a message of 10–6,000 characters.'},400);
      for (const [key,at] of accepted) if (now()-at > 3600000) accepted.delete(key);
      if (accepted.has(id)) return reply({ok:true});
      if (sending.has(id)) return reply({error:'Your message is already being sent. Please wait.'},409);
      sending.add(id);
      try {
        const response = await (config.fetcher ?? fetch)(config.url!, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,message,id,submittedAt:new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}).format(new Date(now()))+' Eastern Time'}),signal:AbortSignal.timeout(12000)});
        const result = await response.json();
        if (!response.ok || result.success !== true) return unavailable();
        if (accepted.size >= 1000) accepted.delete(accepted.keys().next().value!);
        accepted.set(id,now());
        return reply({ok:true});
      } catch { return reply({error:'We could not confirm delivery. Please email info@qwarter.com rather than submitting again.'},502); }
      finally { sending.delete(id); }
    },
  };
}
