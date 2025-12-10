// Services Page JavaScript

(function() {
    'use strict';

    const STORAGE_KEY = 'ssn_services_webhook';
    const DATA_URL = 'data/services.json';

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
    });

    // Load services from JSON
    async function loadServices() {
        try {
            const response = await fetch(DATA_URL);
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

    // Create social links HTML
    function createSocialLinks(socials) {
        const links = [];

        if (socials.discord) {
            links.push(`<a href="${escapeHtml(socials.discord)}" target="_blank" rel="noopener" class="service-social-link" title="Discord">
                <img src="../icons/discord.svg" alt="Discord">
            </a>`);
        }
        if (socials.instagram) {
            links.push(`<a href="${escapeHtml(socials.instagram)}" target="_blank" rel="noopener" class="service-social-link" title="Instagram">
                <img src="../icons/instagram.svg" alt="Instagram">
            </a>`);
        }
        if (socials.twitter) {
            links.push(`<a href="${escapeHtml(socials.twitter)}" target="_blank" rel="noopener" class="service-social-link" title="X/Twitter">
                <img src="../icons/x.svg" alt="X/Twitter">
            </a>`);
        }
        if (socials.website) {
            links.push(`<a href="${escapeHtml(socials.website)}" target="_blank" rel="noopener" class="service-social-link" title="Website">
                <img src="../icons/link.svg" alt="Website">
            </a>`);
        }

        return links.join('');
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
        const webhookUrl = localStorage.getItem(STORAGE_KEY);

        if (!webhookUrl) {
            showFormMessage('error', 'Webhook not configured. Please contact the site administrator.');
            return;
        }

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
            const response = await fetch(webhookUrl, {
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

    // Initialize admin panel
    function initAdmin() {
        // Check for admin mode
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('admin') === 'true' && adminPanel) {
            adminPanel.classList.add('active');
            updateAdminStatus();
        }

        // Admin form handlers
        const webhookInput = document.getElementById('webhook-url');
        const saveBtn = document.getElementById('save-webhook');
        const testBtn = document.getElementById('test-webhook');
        const clearBtn = document.getElementById('clear-webhook');

        if (saveBtn && webhookInput) {
            // Load existing webhook URL
            const existing = localStorage.getItem(STORAGE_KEY);
            if (existing) {
                webhookInput.value = existing;
            }

            saveBtn.addEventListener('click', () => {
                const url = webhookInput.value.trim();
                if (url && url.includes('discord.com/api/webhooks')) {
                    localStorage.setItem(STORAGE_KEY, url);
                    updateAdminStatus();
                    alert('Webhook URL saved!');
                } else {
                    alert('Please enter a valid Discord webhook URL');
                }
            });
        }

        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                const url = localStorage.getItem(STORAGE_KEY);
                if (!url) {
                    alert('No webhook configured');
                    return;
                }

                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: 'Services Test',
                            content: 'Test message from Services page admin panel.'
                        })
                    });

                    if (response.ok) {
                        alert('Test message sent successfully!');
                    } else {
                        alert('Test failed. Check your webhook URL.');
                    }
                } catch (error) {
                    alert('Test failed: ' + error.message);
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear the webhook URL?')) {
                    localStorage.removeItem(STORAGE_KEY);
                    if (webhookInput) webhookInput.value = '';
                    updateAdminStatus();
                    alert('Webhook URL cleared');
                }
            });
        }
    }

    // Update admin status display
    function updateAdminStatus() {
        const status = document.getElementById('admin-status');
        if (!status) return;

        const hasWebhook = !!localStorage.getItem(STORAGE_KEY);
        status.className = 'admin-status ' + (hasWebhook ? 'configured' : 'not-configured');
        status.textContent = hasWebhook
            ? 'Webhook configured and ready'
            : 'No webhook configured - submissions will fail';
    }

    // Initialize multi-input fields (social links, portfolio, payments)
    function initMultiInputs() {
        document.querySelectorAll('.add-input-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.closest('.multi-input-group');
                const inputClass = btn.dataset.inputClass;
                const placeholder = btn.dataset.placeholder || 'Enter URL';

                const row = document.createElement('div');
                row.className = 'multi-input-row';
                row.innerHTML = `
                    <input type="url" class="${inputClass}" placeholder="${placeholder}">
                    <button type="button" class="remove-btn">&times;</button>
                `;

                group.insertBefore(row, btn);

                row.querySelector('.remove-btn').addEventListener('click', () => {
                    row.remove();
                });
            });
        });

        // Add remove handlers to existing remove buttons
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.multi-input-row').remove();
            });
        });
    }

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
