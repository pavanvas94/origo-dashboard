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

    // ─── Manual Refresh and GitHub Actions Trigger ───
    const OWNER = 'pavanvas94';
    const REPO = 'origo-dashboard';
    const WORKFLOW_FILE = 'scrape.yml';

    const refreshBtn = document.getElementById('refresh-btn');
    const refreshModal = document.getElementById('refresh-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalStepToken = document.getElementById('modal-step-token');
    const githubTokenInput = document.getElementById('github-token-input');
    const tokenSubmitBtn = document.getElementById('token-submit-btn');
    const modalStepProgress = document.getElementById('modal-step-progress');
    const refreshProgressBar = document.getElementById('refresh-progress-bar');
    const refreshStatusBadge = document.getElementById('refresh-status-badge');
    const refreshConsole = document.getElementById('refresh-console');
    const tokenClearBtn = document.getElementById('token-clear-btn');

    let pollInterval = null;
    let runId = null;
    let lastLoggedStatus = '';

    function addLog(text, type = '') {
        if (!refreshConsole) return;
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        line.innerHTML = `<span class="log-line timestamp">[${timeStr}]</span> ${text}`;
        refreshConsole.appendChild(line);
        refreshConsole.scrollTop = refreshConsole.scrollHeight;
    }

    function showStep(step) {
        if (step === 'token') {
            modalStepToken.classList.remove('hidden');
            modalStepProgress.classList.add('hidden');
        } else {
            modalStepToken.classList.add('hidden');
            modalStepProgress.classList.remove('hidden');
        }
    }

    function setProgressBar(percentage, statusText, badgeClass) {
        if (refreshProgressBar) refreshProgressBar.style.width = `${percentage}%`;
        if (refreshStatusBadge) {
            refreshStatusBadge.textContent = statusText;
            refreshStatusBadge.className = `status-badge ${badgeClass}`;
        }
    }

    // Modal open
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (refreshModal) refreshModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Prevent bg scroll
            
            const savedToken = localStorage.getItem('github_pat');
            if (savedToken) {
                showStep('progress');
                triggerRefresh(savedToken);
            } else {
                showStep('token');
                if (githubTokenInput) githubTokenInput.focus();
            }
        });
    }

    // Modal close
    function closeModal() {
        if (refreshModal) refreshModal.classList.add('hidden');
        document.body.style.overflow = '';
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        if (refreshBtn) refreshBtn.classList.remove('loading');
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }

    if (refreshModal) {
        refreshModal.addEventListener('click', (e) => {
            if (e.target === refreshModal) closeModal();
        });
    }

    // Token Submit
    if (tokenSubmitBtn) {
        tokenSubmitBtn.addEventListener('click', () => {
            const token = githubTokenInput.value.trim();
            if (!token) {
                alert('Please enter a valid GitHub token.');
                return;
            }
            localStorage.setItem('github_pat', token);
            showStep('progress');
            triggerRefresh(token);
        });
    }

    // Token Clear
    if (tokenClearBtn) {
        tokenClearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear your saved GitHub token?')) {
                localStorage.removeItem('github_pat');
                if (githubTokenInput) githubTokenInput.value = '';
                addLog('Token cleared. Please close and reopen to re-authenticate.', 'error');
                showStep('token');
            }
        });
    }

    async function triggerRefresh(token) {
        if (refreshConsole) refreshConsole.innerHTML = '';
        runId = null;
        lastLoggedStatus = '';
        addLog('Initializing update sequence...');
        setProgressBar(5, 'Initializing', 'in_progress');
        if (refreshBtn) refreshBtn.classList.add('loading');

        try {
            addLog('Sending request to GitHub Actions API...');
            const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ref: 'main' })
            });

            if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed. The token is invalid or lacks repository access permissions.');
            } else if (!response.ok) {
                throw new Error(`API returned status ${response.status}: ${response.statusText}`);
            }

            addLog('GitHub Actions workflow triggered successfully! (HTTP 204)', 'success');
            addLog('Waiting for run to appear in queue (approx. 5-10s)...');
            setProgressBar(15, 'Triggered', 'in_progress');

            const triggerTime = new Date();
            let attempts = 0;

            pollInterval = setInterval(async () => {
                attempts++;
                try {
                    if (!runId) {
                        // Find the run
                        const runsResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&limit=5`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Accept': 'application/vnd.github+json',
                                'X-GitHub-Api-Version': '2022-11-28'
                            }
                        });

                        if (!runsResponse.ok) return;

                        const data = await runsResponse.json();
                        const latestRun = data.workflow_runs?.[0];

                        if (latestRun) {
                            const runCreatedAt = new Date(latestRun.created_at);
                            // Verify this run was triggered within 60s of our trigger action
                            if (runCreatedAt >= new Date(triggerTime.getTime() - 60000)) {
                                runId = latestRun.id;
                                addLog(`Identified GitHub Action Run #${runId}. Monitoring progress...`, 'success');
                            }
                        }

                        if (!runId && attempts > 6) { // 30 seconds wait
                            addLog('Workflow trigger is taking longer than usual to register. Still waiting...', 'timestamp');
                            attempts = 0; // reset wait log interval
                        }
                    } else {
                        // Poll specific run
                        const runResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${runId}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Accept': 'application/vnd.github+json',
                                'X-GitHub-Api-Version': '2022-11-28'
                            }
                        });

                        if (!runResponse.ok) return;

                        const run = await runResponse.json();
                        const status = run.status;
                        const conclusion = run.conclusion;

                        if (status !== lastLoggedStatus) {
                            addLog(`GitHub Actions run status changed to: <strong>${status}</strong>`, 'timestamp');
                            lastLoggedStatus = status;
                        }

                        if (status === 'queued') {
                            setProgressBar(30, 'Queued', 'in_progress');
                        } else if (status === 'in_progress') {
                            setProgressBar(60, 'Running Scraper', 'in_progress');
                            // Add periodic message if running to reassure user
                            if (Math.random() > 0.7) {
                                const scrapingMsgs = [
                                    'Executing update_prices.py script...',
                                    'Scraping prices from Anveshan Store...',
                                    'Scraping prices from Gramiyaa Store...',
                                    'Scraping prices from Two Brothers Farms...',
                                    'Regenerating static HTML dashboard...'
                                ];
                                addLog(scrapingMsgs[Math.floor(Math.random() * scrapingMsgs.length)]);
                            }
                        } else if (status === 'completed') {
                            clearInterval(pollInterval);
                            pollInterval = null;

                            if (conclusion === 'success') {
                                setProgressBar(100, 'Success', 'completed');
                                addLog('Scraper finished successfully!', 'success');
                                addLog('New prices generated and dashboard HTML committed.', 'success');
                                addLog('Reloading page to display the latest data in 3 seconds...', 'success');
                                setTimeout(() => {
                                    window.location.reload();
                                }, 3000);
                            } else {
                                setProgressBar(100, 'Failed', 'failed');
                                addLog(`Scraper execution failed with conclusion: <strong>${conclusion}</strong>`, 'error');
                                addLog(`Please check the GitHub logs: <a href="${run.html_url}" target="_blank" style="color: #60a5fa; text-decoration: underline;">View Workflow Run</a>`, 'error');
                                if (refreshBtn) refreshBtn.classList.remove('loading');
                            }
                        }
                    }
                } catch (pollErr) {
                    console.error('Polling error:', pollErr);
                }
            }, 5000);

        } catch (err) {
            addLog(err.message, 'error');
            setProgressBar(100, 'Error', 'failed');
            if (refreshBtn) refreshBtn.classList.remove('loading');
            
            // If authentication failed, clear the bad token so they can re-enter it
            if (err.message.includes('Authentication failed')) {
                localStorage.removeItem('github_pat');
                setTimeout(() => {
                    showStep('token');
                }, 3000);
            }
        }
    }
});
