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
      chatmessage = ele.querySelector('[class="Linkify"]').innerText;
    } catch (e) {
      errorlog(e);
    }
    if (!chatmessage) {
      return;
    }

    // Get the sender  name
    try {
      chatname = ele.querySelector('[class="ChatMessage__sender"]').innerText;
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
          chatname = prev.querySelector('[class="ChatMessage__sender"]').innerText;
        } catch (e) {
          chatname = "";
        }
      }
    }
    chatname = chatname.replace(/(‹.*?›)/g, "");

    var data = {};
    data.chatname = chatname;
    data.chatbadges = "";
    data.backgroundColor = "";
    data.textColor = "";
    data.chatmessage = chatmessage;
    data.chatimg = "";
    data.hasDonation = "";
    data.hasMembership = "";
    data.contentimg = "";
    data.type = "chime";

    pushMessage(data);
    return;
  }

  setInterval(function () {
    var xxx = document.querySelectorAll('[class="ChatMessageList__messageContainer"]');
    for (var j = 0; j < xxx.length; j++) {
      if (xxx[j].marked) {
        continue;
      }
      xxx[j].marked = true;
      processMessage(xxx[j]);
    }
  }, 3000);

  // Does not support sending messages in Chime
})();
