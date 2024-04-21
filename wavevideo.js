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

  // Función para obtener el tipo de stream basado en el atributo alt del icono
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
      return "discord"; // Devuelve 'discord' si no se reconoce el tipo... no se me ocurrió mas
    }
  }

  // Procesar mensajes individuales
  function processMessage(newMessage) {
    try {
      const messageText =
        newMessage.querySelector(".jclrku-5.gsJWBK span")?.textContent ||
        "Mensaje no encontrado";
      const username =
        newMessage.querySelector(".jclrku-2.dpJNMF")?.textContent ||
        "Usuario no identificado";
      const profileImageUrl =
        newMessage.querySelector(".sc-1f9oe74-3.cJigXz img")?.src ||
        "URL de imagen no disponible";
      const socialIconElement = newMessage.querySelector(
        ".sc-1f9oe74-2.gYhLbq img"
      );
      const socialIconUrl =
        socialIconElement?.src || "URL de ícono no disponible";
      const socialIconAlt = socialIconElement?.alt || "";

      const data = {
        chatname: escapeHtml(username),
        chatimg: profileImageUrl,
        chatmessage: escapeHtml(messageText),
        chatIconUrl: socialIconUrl,
        //type: "wavevideo",
        type: getTypeFromAlt(socialIconAlt), // Determina el tipo de stream desde el alt
      };

      if (lastMessage === JSON.stringify(data)) {
        return; // Evita duplicados
      }
      lastMessage = JSON.stringify(data);
      pushMessage(data);
    } catch (e) {
      console.error("Error procesando el mensaje:", e);
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
      console.error("Error al enviar el mensaje:", e);
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
      console.log("Observador de mensajes activado.");
    } else {
      console.log(
        "Contenedor de chat no encontrado, reintento en 1 segundo..."
      );
      setTimeout(startObserving, 1000);
    }
  };

  startObserving();

  // Función para detener la observación
  window.stopMessageObserver = () => observer.disconnect();
})();
