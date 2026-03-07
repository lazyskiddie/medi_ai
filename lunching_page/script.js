// ── Custom Cursor ──
const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursorRing');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

(function animateCursor() {
  rx += (mx - rx) * 0.12;
  ry += (my - ry) * 0.12;
  cursor.style.left = mx + 'px';
  cursor.style.top = my + 'px';
  ring.style.left = rx + 'px';
  ring.style.top = ry + 'px';
  requestAnimationFrame(animateCursor);
})();

// ── Intersection Observer ──
const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

reveals.forEach(el => observer.observe(el));

// ── Parallax orbs ──
document.addEventListener('mousemove', e => {
  const x = (e.clientX / window.innerWidth - 0.5) * 20;
  const y = (e.clientY / window.innerHeight - 0.5) * 20;
  document.querySelector('.orb-1').style.transform = `translate(${x * 0.5}px, ${y * 0.5}px)`;
  document.querySelector('.orb-2').style.transform = `translate(${-x * 0.3}px, ${-y * 0.3}px)`;
  document.querySelector('.orb-3').style.transform = `translate(${x * 0.8}px, ${y * 0.8}px)`;
});