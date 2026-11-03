(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('contact-status');
  let token = '', pending = false, completed = false;
  async function prepare() {
    const response = await fetch('/api/contact', { cache:'no-store' });
    const data = await response.json();
    if (!response.ok || !data.token) throw new Error();
    token = data.token;
    button.disabled = false;
  }
  prepare().catch(() => { status.textContent = 'The form is temporarily unavailable. Please email info@qwarter.com.'; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || completed || !token || !form.reportValidity()) return;
    pending = true; button.disabled = true; status.textContent = 'Sending…';
    try {
      const response = await fetch('/api/contact', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...Object.fromEntries(new FormData(form)), token}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We could not send your message. Please try again or email info@qwarter.com.');
      completed = true;
      form.reset();
      button.textContent = 'Message sent';
      status.textContent = 'Thanks for your message. We’ll be in touch shortly.';
    } catch (error) {
      status.textContent = error.message || 'We could not confirm delivery. Please email info@qwarter.com.';
    } finally { pending = false; button.disabled = completed; }
  });
})();
