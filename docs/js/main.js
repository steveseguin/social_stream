// Mobile navigation toggle
document.addEventListener('DOMContentLoaded', function() {
    const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
    const nav = document.querySelector('nav');
    
    if (mobileNavToggle) {
        mobileNavToggle.addEventListener('click', function() {
            this.classList.toggle('active');
            nav.classList.toggle('active');
        });
    }
    
    // Close mobile nav when clicking outside
    document.addEventListener('click', function(e) {
        if (nav.classList.contains('active') && !nav.contains(e.target) && !mobileNavToggle.contains(e.target)) {
            nav.classList.remove('active');
            mobileNavToggle.classList.remove('active');
        }
    });
    
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
                header.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
            } else {
                header.style.boxShadow = 'var(--shadow-sm)';
                header.style.backgroundColor = 'var(--background-light)';
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
		if (img.complete && img.naturalHeight === 0) {
		  img.style.display = 'none';
		}
		
		img.addEventListener('error', function() {
		  this.style.display = 'none';
		});
	});
	  

	
	    // Dark Mode Toggle Logic - Fixed Version
    const themeToggle = document.getElementById('theme-toggle');
    
    // Function to update the theme
    function updateTheme(isDark) {
        if (isDark) {
            document.documentElement.classList.add('dark-mode');
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.documentElement.classList.remove('dark-mode');
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'false');
        }
    }
    
    // Check for saved theme preference or use system preference as fallback
    const savedTheme = localStorage.getItem('darkMode');
    
    if (savedTheme === 'true') {
        updateTheme(true);
    } else if (savedTheme === 'false') {
        updateTheme(false);
    } else {
        // If no saved preference, check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        updateTheme(prefersDark);
    }
    
    // Toggle theme when button is clicked
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            const isDarkMode = document.documentElement.classList.contains('dark-mode');
            updateTheme(!isDarkMode);
        });
    }
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        // Only apply if user hasn't set a preference
        if (!localStorage.getItem('darkMode')) {
            updateTheme(e.matches);
        }
    });
});
