// ******************************* DETECTA LOS NUEVOS CHATS Y MENSAJES, USERNAME, IMAGEN DE PERFIL, IMAGEN RED SOCIAL *******************************
(function () {
  const chatContainer = document.querySelector(".ydm0hk-1.fdPmo");

  let messageCount = 0;

  const callback = function (mutationsList, observer) {
    for (let mutation of mutationsList) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        messageCount++;
        je;
        const newMessage = mutation.addedNodes[0];
        const messageTextElement = newMessage.querySelector(
          ".jclrku-5.gsJWBK span"
        );
        const messageText = messageTextElement
          ? messageTextElement.textContent
          : "Mensaje no encontrado";
        const usernameElement = newMessage.querySelector(".jclrku-2.dpJNMF");
        const username = usernameElement
          ? usernameElement.textContent
          : "Usuario no identificado";
        const profileImageElement = newMessage.querySelector(
          ".sc-1f9oe74-3.cJigXz img"
        );
        const profileImageUrl = profileImageElement
          ? profileImageElement.src
          : "URL de imagen no disponible";
        const socialIconElement = newMessage.querySelector(
          ".sc-1f9oe74-2.gYhLbq img"
        );
        const socialIconUrl = socialIconElement
          ? socialIconElement.src
          : "URL de ícono no disponible";

        console.log(`Se ha añadido un nuevo mensaje: ${messageCount}`);
        console.log(`Usuario: ${username}`);
        console.log(`URL de la imagen de perfil: ${profileImageUrl}`);
        console.log(`URL del ícono de la red social: ${socialIconUrl}`);
        console.log(`Mensaje: ${messageText}`);
      }
    }
  };

  const observer = new MutationObserver(callback);

  const config = { attributes: false, childList: true, subtree: true };

  // Inicia la observación
  observer.observe(chatContainer, config);

  // Detener observación con observer.disconnect();
})();
