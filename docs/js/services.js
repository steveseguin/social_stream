// Services Page JavaScript

(function() {
    'use strict';

    // Discord webhook for form submissions (public - submissions go to private channel for review)
    const WEBHOOK_URL = 'https://discord.com/api/webhooks/1448484964961357935/9YPrpWrA4EHJZ0kjPAQfmT7brPKxYaJGXj0L3-wBG5kTYiSxuNg2Wk20QCh267KxhXDz';

    // Fetch approved services from GitHub Gist (updated by Discord bot on approval)
    const GIST_ID = '3642a19e9ed4b16571906cdb2e216a45';
    const GIST_URL = GIST_ID
        ? `https://gist.githubusercontent.com/steveseguin/${GIST_ID}/raw/services.json`
        : 'data/services.json'; // Fallback to local file

    // DOM Elements
    let servicesGrid;
    let platformFilters;
    let submitToggleBtn;
    let submissionForm;
    let formMessage;
    let adminPanel;

    // State
    let services = [];
    let currentFilter = 'all';

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
        servicesGrid = document.getElementById('services-grid');
        platformFilters = document.querySelectorAll('.platform-filter');
        submitToggleBtn = document.getElementById('submit-toggle-btn');
        submissionForm = document.getElementById('submission-form-wrapper');
        formMessage = document.getElementById('form-message');
        adminPanel = document.getElementById('admin-panel');

        loadServices();
        initFilters();
        initFormToggle();
        initForm();
        initAdmin();
        initMultiInputs();
        initDiscordHelp();
    });

    // Load services from Gist (or fallback to local JSON)
    async function loadServices() {
        try {
            // Add cache-busting for gist URL to get latest data
            const url = GIST_ID
                ? `${GIST_URL}?t=${Date.now()}`
                : GIST_URL;

            const response = await fetch(url);
            const data = await response.json();
            services = data.services || [];
            renderServices();
        } catch (error) {
            console.error('Failed to load services:', error);
            renderEmptyState();
        }
    }

    // Render services grid
    function renderServices() {
        if (!servicesGrid) return;

        const filtered = currentFilter === 'all'
            ? services
            : services.filter(s => s.platforms && s.platforms.includes(currentFilter));

        if (filtered.length === 0) {
            renderEmptyState();
            return;
        }

        servicesGrid.innerHTML = filtered.map(service => createServiceCard(service)).join('');

        // Add click handlers for portfolio images
        document.querySelectorAll('.portfolio-thumb').forEach(img => {
            img.addEventListener('click', () => openPortfolioModal(img.src));
        });

        // Add click handlers for reveal links (SEO protection)
        document.querySelectorAll('.reveal-link').forEach(span => {
            span.addEventListener('click', function() {
                if (this.classList.contains('revealed')) return;

                const encodedUrl = this.dataset.url;
                const url = atob(encodedUrl); // Decode Base64
                const icon = this.querySelector('img');

                this.classList.add('revealed');
                this.innerHTML = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener nofollow">${icon.outerHTML}</a>`;
            });
        });
    }

    // Create service card HTML
    function createServiceCard(service) {
        const initials = getInitials(service.name);
        const platformBadges = (service.platforms || []).map(p =>
            `<span class="platform-badge ${p === 'ssn' ? 'ssn' : 'vdo'}">${p === 'ssn' ? 'SSN' : 'VDO.Ninja'}</span>`
        ).join('');

        const typeTags = (service.serviceTypes || []).map(t =>
            `<span class="service-type-tag">${t}</span>`
        ).join('');

        const portfolio = (service.portfolio || []).slice(0, 3).map(url =>
            `<img src="${escapeHtml(url)}" alt="Portfolio" class="portfolio-thumb">`
        ).join('');

        const socials = createSocialLinks(service.socials || {});

        const contactLink = service.socials?.discord || service.socials?.website ||
                           (service.paymentLinks && service.paymentLinks[0]) || '#';

        return `
            <div class="service-card">
                <div class="service-card-header">
                    <div class="service-avatar">${initials}</div>
                    <div>
                        <h3>${escapeHtml(service.name)}</h3>
                        <div class="service-discord">${escapeHtml(service.discord || '')}</div>
                    </div>
                </div>
                <div class="service-card-body">
                    <div class="service-platforms">${platformBadges}</div>
                    <div class="service-types">${typeTags}</div>
                    <p class="service-description">${escapeHtml(service.description || '')}</p>
                    ${portfolio ? `<div class="service-portfolio">${portfolio}</div>` : ''}
                </div>
                <div class="service-card-footer">
                    <div class="service-socials">${socials}</div>
                    <a href="${escapeHtml(contactLink)}" target="_blank" rel="noopener" class="btn btn-primary service-contact-btn">Contact</a>
                </div>
            </div>
        `;
    }

    // Create social links HTML (click-to-reveal for SEO protection)
    function createSocialLinks(socials) {
        const links = [];

        if (socials.discord) {
            links.push(createRevealLink('Discord', socials.discord, '../icons/discord.svg'));
        }
        if (socials.instagram) {
            links.push(createRevealLink('Instagram', socials.instagram, '../icons/instagram.svg'));
        }
        if (socials.twitter) {
            links.push(createRevealLink('X/Twitter', socials.twitter, '../icons/x.svg'));
        }
        if (socials.website) {
            links.push(createRevealLink('Website', socials.website, '../icons/link.svg'));
        }

        return links.join('');
    }

    // Create a click-to-reveal link (prevents SEO crawling of external links)
    function createRevealLink(label, url, icon) {
        const encodedUrl = btoa(url); // Base64 encode to hide from crawlers
        return `<span class="reveal-link" data-url="${encodedUrl}" title="Click to reveal ${label}">
            <img src="${icon}" alt="${label}" style="width: 1.8rem; height: 1.8rem; opacity: 0.8;">
        </span>`;
    }

    // Render empty state
    function renderEmptyState() {
        if (!servicesGrid) return;

        servicesGrid.innerHTML = `
            <div class="services-empty">
                <h3>No Services Listed Yet</h3>
                <p>Be the first to offer your freelance services to the community!</p>
                <p>Scroll down to submit your listing.</p>
            </div>
        `;
    }

    // Initialize platform filters
    function initFilters() {
        platformFilters.forEach(filter => {
            filter.addEventListener('click', () => {
                platformFilters.forEach(f => f.classList.remove('active'));
                filter.classList.add('active');
                currentFilter = filter.dataset.filter;
                renderServices();
            });
        });
    }

    // Initialize form toggle
    function initFormToggle() {
        if (submitToggleBtn && submissionForm) {
            submitToggleBtn.addEventListener('click', () => {
                submissionForm.classList.toggle('active');
                submitToggleBtn.textContent = submissionForm.classList.contains('active')
                    ? 'Hide Form'
                    : 'Submit Your Listing';
            });
        }
    }

    // Initialize form
    function initForm() {
        const form = document.getElementById('service-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitForm(form);
        });

        // Terms checkbox validation
        const termsCheckbox = document.getElementById('agree-terms');
        const submitBtn = document.getElementById('submit-btn');
        if (termsCheckbox && submitBtn) {
            termsCheckbox.addEventListener('change', () => {
                submitBtn.disabled = !termsCheckbox.checked;
            });
        }
    }

    // Submit form to Discord webhook
    async function submitForm(form) {
        const formData = new FormData(form);

        // Gather data
        const name = formData.get('name');
        const discord = formData.get('discord');
        const description = formData.get('description');

        // Platforms (checkboxes)
        const platforms = [];
        if (formData.get('platform-ssn')) platforms.push('Social Stream Ninja');
        if (formData.get('platform-vdo')) platforms.push('VDO.Ninja');

        // Service types (checkboxes)
        const serviceTypes = [];
        document.querySelectorAll('input[name^="service-"]:checked').forEach(cb => {
            serviceTypes.push(cb.value);
        });

        // Social links
        const socials = [];
        document.querySelectorAll('.social-input').forEach(input => {
            if (input.value.trim()) socials.push(input.value.trim());
        });

        // Portfolio URLs
        const portfolio = [];
        document.querySelectorAll('.portfolio-input').forEach(input => {
            if (input.value.trim()) portfolio.push(input.value.trim());
        });

        // Payment links
        const payments = [];
        document.querySelectorAll('.payment-input').forEach(input => {
            if (input.value.trim()) payments.push(input.value.trim());
        });

        // Validate
        if (!name || !discord || !description) {
            showFormMessage('error', 'Please fill in all required fields.');
            return;
        }

        if (platforms.length === 0) {
            showFormMessage('error', 'Please select at least one platform.');
            return;
        }

        if (serviceTypes.length === 0) {
            showFormMessage('error', 'Please select at least one service type.');
            return;
        }

        if (socials.length === 0) {
            showFormMessage('error', 'Please provide at least one social/contact link.');
            return;
        }

        // Build webhook payload
        const payload = {
            username: 'Services Submission',
            embeds: [{
                title: 'New Freelancer Submission',
                color: 7855479, // Purple
                fields: [
                    { name: 'Name', value: name, inline: true },
                    { name: 'Discord', value: discord, inline: true },
                    { name: 'Platforms', value: platforms.join(', ') || 'None', inline: false },
                    { name: 'Service Types', value: serviceTypes.join(', ') || 'None', inline: false },
                    { name: 'Description', value: description.substring(0, 1000), inline: false },
                    { name: 'Social Links', value: socials.join('\n') || 'None', inline: false },
                    { name: 'Portfolio URLs', value: portfolio.join('\n') || 'None', inline: false },
                    { name: 'Payment Links', value: payments.join('\n') || 'None', inline: false }
                ],
                timestamp: new Date().toISOString()
            }]
        };

        // Send to Discord
        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showFormMessage('success', 'Your submission has been received! It will be reviewed and added if approved.');
                form.reset();
                document.getElementById('submit-btn').disabled = true;
            } else {
                throw new Error('Webhook request failed');
            }
        } catch (error) {
            console.error('Submission error:', error);
            showFormMessage('error', 'Failed to submit. Please try again or contact support.');
        }
    }

    // Show form message
    function showFormMessage(type, message) {
        if (!formMessage) return;
        formMessage.className = 'form-message ' + type;
        formMessage.textContent = message;
        formMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Initialize admin panel (no longer needed - webhook is hardcoded)
    function initAdmin() {
        // Admin panel removed - webhook URL is now in code
    }

    // Initialize multi-input fields (social links, portfolio, payments)
    function initMultiInputs() {
        document.querySelectorAll('.add-input-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.closest('.multi-input-group');
                const inputClass = btn.dataset.inputClass;
                const placeholder = btn.dataset.placeholder || 'Enter URL';
                const withUpload = btn.dataset.withUpload === 'true';

                const row = document.createElement('div');
                row.className = 'multi-input-row';
                row.innerHTML = `
                    <input type="url" class="${inputClass}" placeholder="${placeholder}">
                    ${withUpload ? '<button type="button" class="upload-btn" title="Upload an image"><i class="fas fa-upload"></i></button>' : ''}
                    <button type="button" class="remove-btn">&times;</button>
                `;

                group.insertBefore(row, btn);

                row.querySelector('.remove-btn').addEventListener('click', () => {
                    row.remove();
                });

                // Add upload handler if this is a portfolio input
                if (withUpload) {
                    const uploadBtn = row.querySelector('.upload-btn');
                    const input = row.querySelector('input');
                    uploadBtn.addEventListener('click', () => openFileUpload(input));
                }
            });
        });

        // Add remove handlers to existing remove buttons
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.multi-input-row').remove();
            });
        });

        // Initialize existing upload buttons
        initUploadButtons();
    }

    // Initialize upload buttons
    function initUploadButtons() {
        document.querySelectorAll('.upload-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const row = btn.closest('.multi-input-row');
                const input = row.querySelector('input');
                openFileUpload(input);
            });
        });
    }

    // Open file upload popup and handle result
    function openFileUpload(targetInput) {
        const popup = window.open(
            'https://fileuploads.socialstream.ninja/popup/upload',
            'uploadPortfolio',
            'width=640,height=640'
        );

        window.addEventListener('message', function handleMessage(event) {
            // Verify the origin for security
            if (event.origin !== 'https://fileuploads.socialstream.ninja') return;

            // Check if this is our media upload message
            if (event.data && event.data.type === 'media-uploaded') {
                targetInput.value = event.data.url;
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                targetInput.dispatchEvent(new Event('change', { bubbles: true }));

                // Remove this specific listener
                window.removeEventListener('message', handleMessage);
            }
        });
    }

    // Discord help modal
    function initDiscordHelp() {
        const helpLink = document.getElementById('discord-id-help');
        if (helpLink) {
            helpLink.addEventListener('click', (e) => {
                e.preventDefault();
                const modal = document.getElementById('discord-help-modal');
                if (modal) modal.classList.add('active');
            });
        }
    }

    // Close Discord help modal (global function)
    window.closeDiscordHelpModal = function() {
        const modal = document.getElementById('discord-help-modal');
        if (modal) modal.classList.remove('active');
    };

    // Click outside help modal to close
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('discord-help-modal');
        if (modal && e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // Portfolio modal
    function openPortfolioModal(src) {
        const modal = document.getElementById('portfolio-modal');
        const img = document.getElementById('portfolio-modal-img');
        if (modal && img) {
            img.src = src;
            modal.classList.add('active');
        }
    }

    // Close modal
    window.closePortfolioModal = function() {
        const modal = document.getElementById('portfolio-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    };

    // Click outside modal to close
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('portfolio-modal');
        if (modal && e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // Utility functions
    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

})();
