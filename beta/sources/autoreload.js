(function () {
	// Add &autoreloadsocialstream to your page to have socialstream auto reload it, every 20 seconds or so.
	// If its best buy, it will look to see if there is a product buy button available, and alert you in that case.
	// works regardless of whether the extension is "enabled" or not; so this is more of an easter egg feature that I use for myself really only
	
    setTimeout(function() {
        var ele = document.querySelector('[data-automation="addToCartButton"]');
        
        // If page failed to load properly, reload
        if (document.readyState !== 'complete') {
            window.location.reload();
            return;
        }
        
        // If element exists but is disabled, reload
        if (ele && ele.disabled) {
            window.location.reload();
            return;
        }
        
        // If element exists and is enabled, alert
        if (ele) {
            alert("HELLO!");
            return;
        }
		
		setTimeout(function(){ // reload the page in 15 seconds, just cause.
			window.location.reload();
		},15000);
			
    }, 5000);
})();