// Public portfolio — direct links to projects, no customer access gate.
const toggle = document.getElementById('menuToggle');
const mobileNav = document.getElementById('mobileNav');
if (toggle && mobileNav) {
  toggle.addEventListener('click', () => {
    mobileNav.hidden = !mobileNav.hidden;
    toggle.setAttribute('aria-expanded', String(!mobileNav.hidden));
  });
  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobileNav.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }));
}
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();