(function () {
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const chatContainerSelector = ".ydm0hk-1.fdPmo";

  let lastMessage = {};

  // Function to get the type of stream based on the alt attribute of the icon
  function getTypeFromAlt(altText) {
    if (altText.includes("YOUTUBE")) {
      return "youtube";
    } else if (altText.includes("TWITCH")) {
      return "twitch";
    } else if (altText.includes("FACEBOOK")) {
      return "facebook";
    } else if (altText.includes("INSTAGRAM")) {
      return "instagram";
    } else if (altText.includes("LINKEDIN")) {
      return "linkedin";
    } else if (altText.includes("AMAZON")) {
      return "amazon";
    } else {
      return "wavevideo"; // You could also use "generic", if you wanted something that was brandless.
    }
  }

  // Process individual messages
  function processMessage(newMessage) {
    try {
      const messageText =
        newMessage.querySelector(".jclrku-5.gsJWBK span")?.textContent || ""; // Message not found
      const username =
        newMessage.querySelector(".jclrku-2.dpJNMF")?.textContent || ""; // Unidentified user
      const profileImageUrl =
        newMessage.querySelector(".sc-1f9oe74-3.cJigXz img")?.src || ""; // Image URL not available
      const socialIconElement = newMessage.querySelector(
        ".sc-1f9oe74-2.gYhLbq img"
      );
      const socialIconUrl = socialIconElement?.src || ""; // Icon URL not available
      const socialIconAlt = socialIconElement?.alt || "wavevideo";
	  
	  if (!newMessage || !username){
		  return; // we require a name and content for a message to be valid; either a message, donation, content-image, event, etc.
	  }
      
      const data = {
        chatname: escapeHtml(username),
        chatimg: profileImageUrl,
        chatmessage: escapeHtml(messageText),
        sourceImg: socialIconUrl,
		// chatIconUrl: socialIconUrl,
		textonly: false,
        type: getTypeFromAlt(socialIconAlt), // Determine the type of stream from the alt.
      };

      if (lastMessage === JSON.stringify(data)) {
        return; // Avoid duplicates
      }
      lastMessage = JSON.stringify(data);
      pushMessage(data);
    } catch (e) {
      console.error("Error processing message:", e);
    }
  }

  function pushMessage(data) {
    try {
      chrome.runtime.sendMessage(
        chrome.runtime.id,
        { message: data },
        function () {}
      );
    } catch (e) {
      console.error("Error sending message:", e);
    }
  }

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.addedNodes.length) {
        Array.from(mutation.addedNodes).forEach(processMessage);
      }
    });
  });

  const config = { childList: true, subtree: true };

  // Iniciar observación
  const startObserving = () => {
    const chatContainer = document.querySelector(chatContainerSelector);
    if (chatContainer) {
      observer.observe(chatContainer, config);
      console.log("Observador activated.");
    } else {
      console.log(
        "Chat container not found, retry in 1 second..."
      );
      setTimeout(startObserving, 1000);
    }
  };

  startObserving();

  // Stop observation function
  window.stopMessageObserver = () => observer.disconnect();
})();
