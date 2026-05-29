// ===== THEME MANAGEMENT =====
const ThemeManager = {
    init() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: light)').matches;
        const theme = savedTheme || (prefersDark ? 'light' : 'dark');
        this.setTheme(theme);
        this.updateIcon();
    },

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.updateIcon();
    },

    toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    },

    updateIcon() {
        const theme = document.documentElement.getAttribute('data-theme');
        const sunIcon = document.getElementById('sun-icon');
        const moonIcon = document.getElementById('moon-icon');

        if (sunIcon && moonIcon) {
            if (theme === 'dark') {
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
            } else {
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
            }
        }
    }
};

// ===== MOBILE MENU =====
const MobileMenu = {
    init() {
        this.menuBtn = document.getElementById('mobile-menu-btn');
        this.menu = document.getElementById('mobile-menu');
        this.menuIcon = document.getElementById('menu-icon');
        this.closeIcon = document.getElementById('close-icon');
        this.isOpen = false;

        if (this.menuBtn) {
            this.menuBtn.addEventListener('click', () => this.toggle());
        }
    },

    toggle() {
        this.isOpen = !this.isOpen;

        if (this.menu) {
            this.menu.classList.toggle('active', this.isOpen);
        }

        if (this.menuIcon && this.closeIcon) {
            this.menuIcon.style.display = this.isOpen ? 'none' : 'block';
            this.closeIcon.style.display = this.isOpen ? 'block' : 'none';
        }
    },

    close() {
        this.isOpen = false;
        if (this.menu) {
            this.menu.classList.remove('active');
        }
        if (this.menuIcon && this.closeIcon) {
            this.menuIcon.style.display = 'block';
            this.closeIcon.style.display = 'none';
        }
    }
};

// ===== SMOOTH SCROLL =====
const SmoothScroll = {
    init() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = anchor.getAttribute('href');
                const targetElement = document.querySelector(targetId);

                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });

                    // Close mobile menu if open
                    MobileMenu.close();
                }
            });
        });
    }
};

// ===== ANIMATED COUNTERS =====
const AnimatedCounters = {
    init() {
        const counters = document.querySelectorAll('[data-counter]');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.5,
            rootMargin: '-100px'
        });

        counters.forEach(counter => observer.observe(counter));
    },

    animateCounter(element) {
        const target = parseInt(element.getAttribute('data-counter'), 10);
        const suffix = element.getAttribute('data-suffix') || '';
        const duration = 2000;
        const steps = 60;
        const stepValue = target / steps;
        let current = 0;

        const timer = setInterval(() => {
            current += stepValue;
            if (current >= target) {
                element.textContent = target.toLocaleString() + suffix;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current).toLocaleString() + suffix;
            }
        }, duration / steps);
    }
};

// ===== SCROLL ANIMATIONS =====
const ScrollAnimations = {
    init() {
        const elements = document.querySelectorAll('.scroll-animate');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    // Add staggered delay based on data attribute or index
                    const delay = entry.target.getAttribute('data-delay') || index * 0.1;
                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, delay * 1000);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '-50px'
        });

        elements.forEach(el => observer.observe(el));
    }
};

// ===== FLOATING PARTICLES =====
const FloatingParticles = {
    init() {
        const container = document.querySelector('.hero-bg');
        if (!container) return;

        const particles = [{
                left: '15%',
                top: '20%',
                delay: 0
            },
            {
                left: '30%',
                top: '45%',
                delay: 0.3
            },
            {
                left: '45%',
                top: '20%',
                delay: 0.6
            },
            {
                left: '60%',
                top: '45%',
                delay: 0.9
            },
            {
                left: '75%',
                top: '20%',
                delay: 1.2
            },
            {
                left: '85%',
                top: '45%',
                delay: 1.5
            },
        ];

        particles.forEach((p, i) => {
            const particle = document.createElement('div');
            particle.className = 'floating-particle';
            particle.style.left = p.left;
            particle.style.top = p.top;
            particle.style.animationDelay = `${p.delay}s`;
            particle.style.animationDuration = `${3 + i * 0.5}s`;
            container.appendChild(particle);
        });
    }
};

// ===== HOVER EFFECTS =====
const HoverEffects = {
    init() {
        // Add subtle hover effects to cards
        const cards = document.querySelectorAll('.stat-card, .flow-card, .feature-card');

        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-6px)';
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
            });
        });
    }
};

// ===== INITIALIZE ALL =====
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    MobileMenu.init();
    SmoothScroll.init();
    AnimatedCounters.init();
    ScrollAnimations.init();
    FloatingParticles.init();
    HoverEffects.init();
});

// Expose theme toggle for button
function toggleTheme() {
    ThemeManager.toggle();
}

// ===== STUDENT LOGIN NAVIGATION =====
// Keeps the landing page UI same, but sends Sign In / Get Placed buttons to the existing backend student login page.
const StudentLoginNavigation = {
    loginPageUrl: '/student',

    init() {
        const loginTriggers = document.querySelectorAll('[data-student-login-trigger="true"]');
        loginTriggers.forEach((trigger) => {
            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                window.location.href = this.loginPageUrl;
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    StudentLoginNavigation.init();
});
