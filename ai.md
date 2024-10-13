
# Adding you own self-hosted AI bot to Social Stream Ninja

In this guide we will do a VERY basic setup of the Llama3 LLM, using Ollama, on Windows. It should work well on a variety of systems, including modern Nvidia GPUs and newer MacOS systems.

## Installing Ollama

https://ollama.com

![image](https://github.com/user-attachments/assets/b6a0b236-f550-4a5a-a2a7-2b5063bd2a7a)

### Installing an LLM model

There's many choices available; go to https://ollama.com/library for a list of options.

Social Stream Ninja targets Llama3.2 by default, but you can specify the model to use the Social Stream Ninja menu. For now though, let's just use `llama3.2`

To install the model, lets open Command Prompt (or Terminal)
`> ollama pull llama3.2`

![image](https://github.com/user-attachments/assets/4852506e-7761-47d1-99ce-8b2b01f34bac)

![image](https://github.com/user-attachments/assets/b7eee74f-b2f4-47c0-8f55-80d239a3c3b2)


If you need to remove it, you can run `ollama rm llama3`. 

![image](https://github.com/user-attachments/assets/235ec0fb-aa70-4206-8b8d-98dbe173a096)

It will be available for API access by default at `http://localhost:11434`, which if you open via the browser, it shoudl save Ollama is running. However, there are still issues with CORS we need to deal with if using the Chrome extension. That is, by default, Ollama won't listen to requests made by a Chrome extension.

To get around this CORS issue, for windows, you can try close Ollama.exe from the taskbar, and then run the following:
```
ollama serve stop
taskkill /F /IM ollama.exe
set OLLAMA_ORIGINS=chrome-extension://*
ollama serve
```

To make this CORS permission permanant on Windows, you need to add OLLAMA_ORIGINS=chrome-extension://* to the Windows user enviromental system variables. Then start/restart ollma; `ollama serve`.

![image](https://github.com/user-attachments/assets/065d69a6-2773-4ddd-a290-1b57660955af)

This allows us to access Ollama from our Social Stream Ninja extension.

I don't believe you need to worry about CORS if using the Social Stream Ninja standalone app, HOWEVER, if you are using the standalone app, and are running into issues, you can set the `OLLAMA_ORIGINS` to `*`.  If you're comfortable, you can set do this via the "Edit the system environment variables" in Windows, instead of via command line. Be sure to close and re-open Ollama if you do this however. Below is how I have it setup, and it works with both extension AND standalone app.

![image](https://github.com/user-attachments/assets/7587ed12-aa85-498c-8cd4-25fdb56a6543)

If you want to access Ollama directly via the dock.html page, with custom.js commands, you may need to host Ollama behind a reverse proxy service. Refer to their documentation for info on this.

## Using

Just make sure the toggle is on, and that you have Ollama /w Llama3 installed/running locally, and you should be good to go now.


![image](https://github.com/user-attachments/assets/f4195658-85d4-4b6c-9481-e0fcbb9d4f05)

The Bot will respond automatically to chat if it thinks it's a good idea. There is a 5-second timeout per source site.

![image](https://github.com/user-attachments/assets/ed5d417e-4b1e-4f69-a81b-0a6380b8c2f3)

- Steve
 ps. BLARGH!


