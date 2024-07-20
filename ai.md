
# Adding you own self-hosted AI bot to Social Stream Ninja

In this guide we will do a VERY basic setup of the Llama3 LLM, using Ollama, on Windows. It should work well on a variety of systems, including modern Nvidia GPUs and newer MacOS systems.

## Installing Ollama

https://ollama.com

![image](https://github.com/user-attachments/assets/b6a0b236-f550-4a5a-a2a7-2b5063bd2a7a)

### Installing an LLM model

There's many choices available; go to https://ollama.com/library for a list of options.

Social Stream Ninja is currently hard-coded to work with Llama3, so lets use that.

To install the model, lets open Command Prompt (or Terminal)
`> ollama pull llama3`

![image](https://github.com/user-attachments/assets/4852506e-7761-47d1-99ce-8b2b01f34bac)

If you need to remove it, you can run `ollama rm llama3`

![image](https://github.com/user-attachments/assets/235ec0fb-aa70-4206-8b8d-98dbe173a096)

It will be available for API access by default at `http://localhost:11434`, however, there are still issues with CORS we need to deal with if using the Chrome extension.

For windows, you can try close Ollama.exe from the taskbar, and then run the following:
```
ollama serve stop
taskkill /F /IM ollama.exe
set OLLAMA_ORIGINS=chrome-extension://*
ollama serve
```

To make this CORS permission permanant on Windows, you need to add OLLAMA_ORIGINS=chrome-extension://* to the Windows user enviromental system variables. Then start/restart ollma; `ollama serve`.

![image](https://github.com/user-attachments/assets/065d69a6-2773-4ddd-a290-1b57660955af)

This allows us to access Ollama from our Social Stream Ninja extension.  If you want to use it via the dock.html page, with custom.js commands, you may need to host Ollama behind a reverse proxy service. Refer to their documentation for info on this.

## Using

Just make sure the toggle is on, and that you have Ollama /w Llama3 installed/running locally, and you should be good to go now.


![image](https://github.com/user-attachments/assets/f4195658-85d4-4b6c-9481-e0fcbb9d4f05)

The Bot will respond automatically to chat if it thinks it's a good idea. There is a 5-second timeout per source site.

![image](https://github.com/user-attachments/assets/ed5d417e-4b1e-4f69-a81b-0a6380b8c2f3)

- Steve
 ps. BLARGH!


