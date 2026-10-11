// IMPORTANT: A customer's passcode is verified by the M&M server, NEVER by public frontend code.
// When the M&M server is deployed, configure the subdomain mandm.chaimh.com to point to it.
const MANDM_ORIGIN = 'https://mandm.chaimh.com';
const modal = document.getElementById('accessModal');
const form = document.getElementById('accessForm');
const codeField = document.getElementById('accessCode');
const errorBox = document.getElementById('accessError');
const submit = document.getElementById('accessSubmit');
let opener = null;
function openModal() {
  opener = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  errorBox.textContent = '';
  codeField.value = '';
  codeField.focus();
}
function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = '';
  if (opener && typeof opener.focus === 'function') opener.focus();
}
document.getElementById('openMm').addEventListener('click', openModal);
document.getElementById('closeMm').addEventListener('click', closeModal);
modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';
  submit.disabled = true;
  try {
    const response = await fetch(`${MANDM_ORIGIN}/api/customer/access`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeField.value })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to verify your access code.');
    window.location.assign(`${MANDM_ORIGIN}/`);
  } catch (error) {
    if (error instanceof TypeError) {
      errorBox.textContent = 'The private catalog is not online yet. Please try again later.';
    } else {
      errorBox.textContent = error.message || 'Could not unlock the catalog.';
    }
    submit.disabled = false;
  }
});
const toggle = document.getElementById('menuToggle');
const mobileNav = document.getElementById('mobileNav');
toggle.addEventListener('click', () => {
  mobileNav.hidden = !mobileNav.hidden;
  toggle.setAttribute('aria-expanded', String(!mobileNav.hidden));
});
mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  mobileNav.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
}));
document.getElementById('year').textContent = new Date().getFullYear();