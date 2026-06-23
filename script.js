// ============================================
// Oil Price Tracker — Interactive Features
// ============================================

document.addEventListener('DOMContentLoaded', () => {

    // ─── Filter Functionality ───
    const filterButtons = document.querySelectorAll('.filter-btn');
    const oilSections = document.querySelectorAll('.oil-section');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active button
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;

            oilSections.forEach(section => {
                if (filter === 'all' || section.dataset.oil === filter) {
                    section.classList.remove('hidden');
                    // Re-trigger animation
                    section.style.animation = 'none';
                    section.offsetHeight; // force reflow
                    section.style.animation = 'fadeInUp 0.5s ease-out';
                } else {
                    section.classList.add('hidden');
                }
            });
        });
    });

    // ─── Scroll-Based Reveal Animations ───
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all animatable elements
    document.querySelectorAll('.oil-section, .stat-card, .brand-link-card, .channel-brand-block').forEach(el => {
        revealObserver.observe(el);
    });

    // ─── Price Card Hover Tilt Effect ───
    document.querySelectorAll('.price-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const tiltX = (y - centerY) / centerY * 2;
            const tiltY = (centerX - x) / centerX * 2;

            card.style.transform = `translateY(-6px) perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0) perspective(1000px) rotateX(0) rotateY(0)';
        });
    });

    // ─── Dynamic Update Date ───
    // Note: The date is updated statically by the python scraper to reflect the actual scrape time.
    // const updateDateEl = document.getElementById('update-date');
    // if (updateDateEl) {
    //     const now = new Date();
    //     const options = { year: 'numeric', month: 'long', day: 'numeric' };
    //     updateDateEl.textContent = now.toLocaleDateString('en-IN', options);
    // }

    // ─── Table Row Hover Highlight ───
    document.querySelectorAll('#price-table tbody tr').forEach(row => {
        row.addEventListener('mouseenter', () => {
            row.style.transition = 'background 0.2s ease';
        });
    });

    // ─── Smooth Scroll for Filter Buttons ───
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            if (filter !== 'all') {
                const targetSection = document.querySelector(`[data-oil="${filter}"]`);
                if (targetSection) {
                    setTimeout(() => {
                        targetSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                }
            }
        });
    });

    // ─── Coupon Copy to Clipboard ───
    document.querySelectorAll('.coupon-value').forEach(coupon => {
        coupon.style.cursor = 'pointer';
        coupon.title = 'Click to copy';

        coupon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const text = coupon.textContent.trim();
            navigator.clipboard.writeText(text).then(() => {
                const original = coupon.textContent;
                coupon.textContent = 'Copied! ✓';
                coupon.style.color = '#34d399';
                setTimeout(() => {
                    coupon.textContent = original;
                    coupon.style.color = '';
                }, 1500);
            }).catch(() => {
                // Fallback: select the text
                const range = document.createRange();
                range.selectNode(coupon);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
            });
        });
    });
});
