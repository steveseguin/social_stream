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

  let messageCount = 0;

  // Procesar mutaciones en el DOM
  const processMutations = function (mutationsList, observer) {
    mutationsList.forEach((mutation) => {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        Array.from(mutation.addedNodes).forEach((newMessage) => {
          if (newMessage.nodeType === Node.ELEMENT_NODE) {
            // Asegura que es un elemento DOM
            try {
              const messageText =
                newMessage.querySelector(".jclrku-5.gsJWBK span")
                  ?.textContent || "Mensaje no encontrado";
              const username =
                newMessage.querySelector(".jclrku-2.dpJNMF")?.textContent ||
                "Usuario no identificado";
              const profileImageUrl =
                newMessage.querySelector(".sc-1f9oe74-3.cJigXz img")?.src ||
                "URL de imagen no disponible";
              const socialIconUrl =
                newMessage.querySelector(".sc-1f9oe74-2.gYhLbq img")?.src ||
                "URL de ícono no disponible";

              messageCount++;
              a;
              console.log(`Se ha añadido un nuevo mensaje: ${messageCount}`);
              console.log(`Usuario: ${escapeHtml(username)}`);
              console.log(`URL de la imagen de perfil: ${profileImageUrl}`);
              console.log(`URL del ícono de la red social: ${socialIconUrl}`);
              console.log(`Mensaje: ${escapeHtml(messageText)}`);
            } catch (e) {
              console.error("Error procesando el mensaje:", e);
            }
          }
        });
      }
    });
  };

  const observer = new MutationObserver(processMutations);

  const config = { attributes: false, childList: true, subtree: true };

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

  window.stopMessageObserver = () => observer.disconnect();
})();
