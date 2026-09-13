// Load the shared documentation-to-Markdown exporter on every standard docs page.
(function () {
    if (document.querySelector('script[data-ssn-copy-markdown]')) {
        return;
    }
    var copyMarkdownScript = document.createElement('script');
    var mainScript = document.currentScript;
    copyMarkdownScript.src = mainScript && mainScript.src
        ? new URL('copy-markdown.js', mainScript.src).href
        : 'js/copy-markdown.js';
    copyMarkdownScript.async = true;
    copyMarkdownScript.setAttribute('data-ssn-copy-markdown', '');
    document.head.appendChild(copyMarkdownScript);
})();

// Header navigation and theme controls are owned by site-shell.js.
document.addEventListener('DOMContentLoaded', function() {
	const dots = document.querySelectorAll('.dot');
	const testimonials = document.querySelectorAll('.testimonial');
	const testimonialSlider = document.querySelector('.testimonials-slider');

	if (dots.length > 0 && testimonials.length > 0) {
		let currentIndex = 0;
		let autoRotateInterval;

		// Function to show testimonial at given index
		const showTestimonial = (index) => {
			// Update active dot
			dots.forEach(d => d.classList.remove('active'));
			dots[index].classList.add('active');

			// Slide to the selected testimonial
			testimonialSlider.style.transform = `translateX(-${index * 100}%)`;

			// Update current index
			currentIndex = index;
		};

		// Function to start auto rotation
		const startAutoRotate = () => {
			autoRotateInterval = setInterval(() => {
				const nextIndex = (currentIndex + 1) % testimonials.length;
				showTestimonial(nextIndex);
			}, 5000);
		};

		// Add click event to each dot
		dots.forEach((dot, index) => {
			dot.addEventListener('click', () => {
				showTestimonial(index);

				// Reset the auto rotation timer
				clearInterval(autoRotateInterval);
				startAutoRotate();
			});
		});

		// Pause auto-rotation when hovering over testimonials
		testimonialSlider.addEventListener('mouseenter', () => {
			clearInterval(autoRotateInterval);
		});

		// Resume auto-rotation when mouse leaves
		testimonialSlider.addEventListener('mouseleave', () => {
			startAutoRotate();
		});

		// Initialize auto rotation
		startAutoRotate();
	}

    // Header scroll effect
    const header = document.querySelector('header');

    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 100) {
                header.style.boxShadow = 'var(--shadow-md)';
            } else {
                header.style.boxShadow = 'var(--shadow-sm)';
            }
        });
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');

            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                const headerHeight = header.offsetHeight;
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Close mobile nav if open
                nav.classList.remove('active');
                mobileNavToggle.classList.remove('active');
            }
        });
    });

	document.querySelectorAll('img').forEach(img => {

		if (window.location.protocol === 'file:') {
			return;
		}

		if (img.complete && img.naturalHeight === 0) {
		  img.style.display = 'none';
		}

		img.addEventListener('error', function() {
		  this.style.display = 'none';
		});
	});
});
