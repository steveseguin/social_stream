(function () {
  function pushMessage(data) {
    try {
      chrome.runtime.sendMessage(
        chrome.runtime.id,
        { message: data },
        function (e) {}
      );
    } catch (e) {}
  }

  function errorlog(e) {
    //console.error(e);
  }

  function processMessage(ele) {
    var chatimg = "";
    var chatname = "";
    var chatmessage = "";

    // Get the chat message
    try {
      chatmessage = ele.querySelector('[data-qa="message-text"]').innerText;
    } catch (e) {
      errorlog(e);
    }
    if (!chatmessage) {
      return;
    }

    // Get the sender  name
    try {
      chatname = ele.querySelector('[data-qa="message_sender"]').innerText;
    } catch (e) {
      errorlog(e);
    }
    if (!chatname) {
      // Sender name not found? Try in previous siblings
      var prev = ele;
      var count = 0;
      while (chatname == "" && count < 10) {
        try {
          count++;
          prev = prev.previousElementSibling;
          chatname = prev.querySelector('[data-qa="message_sender"]').innerText;
        } catch (e) {
          chatname = "";
        }
      }
    }
    // Get the sender avatar
    try {
      chatimg = ele.querySelector(".c-avatar").querySelector("img").src;
    } catch (e) {
      errorlog(e);
    }
    if (!chatimg) {
      // Sender avatar not found? Try in previous siblings
      var prev = ele;
      var count = 0;
      while (chatimg == "" && count < 10) {
        try {
          count++;
          prev = prev.previousElementSibling;
          chatimg = prev.querySelector(".c-avatar").querySelector("img").src;
        } catch (e) {
          chatimg = "";
        }
      }
    }

    if (chatimg) {
      // Use higher resolution image by replacing last digits with 128
      chatimg = chatimg.replace(/-\d+$/g, "-128");
    }
    var data = {};
    data.chatname = chatname;
    data.chatbadges = "";
    data.backgroundColor = "";
    data.textColor = "";
    data.chatmessage = chatmessage;
    data.chatimg = chatimg;
    data.hasDonation = "";
    data.hasMembership = "";
    data.contentimg = "";
    data.type = "slack";

    pushMessage(data);
    return;
  }

  setInterval(function () {
    var xxx = document.querySelectorAll('[data-qa="virtual-list-item"]');
    for (var j = 0; j < xxx.length; j++) {
      if (xxx[j].marked) {
        continue;
      }
      xxx[j].marked = true;
      processMessage(xxx[j]);
    }
  }, 3000);

  // Does not support sending messages in Slack
})();
