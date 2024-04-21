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
      const socialIconUrl =
        newMessage.querySelector(".sc-1f9oe74-2.gYhLbq img")?.src ||
        "URL de ícono no disponible";

      const data = {
        chatname: escapeHtml(username),
        chatimg: profileImageUrl,
        chatmessage: escapeHtml(messageText),
        chatIconUrl: socialIconUrl,
        type: "wavevideo",
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
