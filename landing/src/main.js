// ChitChatPosts Landing Page JavaScript

// ===== Copy Command to Clipboard =====
window.copyCommand = function (btn) {
  const codeEl = btn.parentElement.querySelector('.command-code') || btn.parentElement.querySelector('code');
  const text = codeEl.getAttribute('data-copy') || codeEl.textContent;

  navigator.clipboard.writeText(text).then(() => {
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');

    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('copied');
    }, 2000);
  });
}

// ===== Smooth Scroll for Navigation =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') return;

    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      const navHeight = document.querySelector('.nav')?.offsetHeight || 80;
      const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    }
  });
});

// ===== Scroll Animations - FAST ===== 
const observerOptions = {
  threshold: 0.05,
  rootMargin: '0px 0px 50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, observerOptions);

// Add animation classes to elements - NO DELAY for fast scrolling
document.querySelectorAll('.feature-card, .step-card, .command-card, .testimonial-card, .install-card, .pricing-card').forEach((el) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(15px)';
  el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  observer.observe(el);
});

// Add visible class styles dynamically
const style = document.createElement('style');
style.textContent = `
  .visible {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }
`;
document.head.appendChild(style);

// ===== Mobile Menu Toggle =====
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');

if (mobileMenuBtn && navLinks) {
  mobileMenuBtn.addEventListener('click', () => {
    navLinks.classList.toggle('mobile-active');
    mobileMenuBtn.classList.toggle('active');
  });
}

// Add mobile menu styles
const mobileStyle = document.createElement('style');
mobileStyle.textContent = `
  @media (max-width: 768px) {
    .nav-links.mobile-active {
      display: flex;
      flex-direction: column;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: rgba(15, 23, 42, 0.98);
      backdrop-filter: blur(20px);
      padding: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      gap: 0.5rem;
    }
    
    .nav-links.mobile-active a {
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
    }
    
    .nav-links.mobile-active a:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .mobile-menu-btn.active span:nth-child(1) {
      transform: rotate(45deg) translate(5px, 5px);
    }
    
    .mobile-menu-btn.active span:nth-child(2) {
      opacity: 0;
    }
    
    .mobile-menu-btn.active span:nth-child(3) {
      transform: rotate(-45deg) translate(5px, -5px);
    }
  }
`;
document.head.appendChild(mobileStyle);

// ===== Navbar Background on Scroll =====
const nav = document.querySelector('.nav');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;

  if (currentScroll > 100) {
    nav.style.background = 'rgba(15, 23, 42, 0.95)';
  } else {
    nav.style.background = 'rgba(15, 23, 42, 0.8)';
  }

  lastScroll = currentScroll;
});

// ===== Typing Animation for Hero =====
const heroTitle = document.querySelector('.hero-title');
if (heroTitle) {
  heroTitle.style.opacity = '0';
  heroTitle.style.transform = 'translateY(20px)';

  setTimeout(() => {
    heroTitle.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    heroTitle.style.opacity = '1';
    heroTitle.style.transform = 'translateY(0)';
  }, 100);
}

// ===== Stats Counter Animation =====
function animateCounter(el, target) {
  const duration = 2000;
  const start = 0;
  const increment = target / (duration / 16);
  let current = start;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }

    if (target >= 1000) {
      el.textContent = Math.floor(current / 1000) + 'K+';
    } else if (target < 10) {
      el.textContent = current.toFixed(1) + '★';
    } else {
      el.textContent = Math.floor(current) + '+';
    }
  }, 16);
}

// Trigger counter animation when stats are visible
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const stats = entry.target.querySelectorAll('.stat-number');
      stats.forEach(stat => {
        const text = stat.textContent;
        let target;
        if (text.includes('K')) {
          target = parseInt(text) * 1000;
        } else if (text.includes('★')) {
          target = parseFloat(text);
        } else {
          target = parseInt(text);
        }
        animateCounter(stat, target);
      });
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
  statsObserver.observe(heroStats);
}

console.log('🚀 ChitChatPosts landing page loaded');
