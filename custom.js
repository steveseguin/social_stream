function applyCustomActions(data){
	var tid = false;
	if (data.tid){
		 tid = data.tid;
	}
	
	if (urlParams.has("auto1")){
		if (data.chatmessage === "1"){
			if (Date.now() - messageTimeout > 60000){ // respond to "1" with a "1" automatically; at most 1 time per minute.
				messageTimeout = Date.now();
				if (data.chatname.toLowerCase() === "pykamusic"){
					respondP2P("1 <3 <3 <3", tid);
				} else if (data.chatname.toLowerCase() !== "evarate"){
					respondP2P("1", tid);
				}
			}
		}
	}
	
	if (data.chatmessage.includes("BlobDJ")){
		if (Date.now() - messageTimeout > 10000){
			if (data.chatname === "NX01"){
				respondP2P("BlobDJ xar2EDM BlobDJ xar2EDM BlobDJ xar2EDM BlobDJ xar2EDM BlobDJ xar2EDM BlobDJ xar2EDM BlobDJ xar2EDM BlobDJ xar2EDM BlobDJ xar2EDM BlobDJ xar2EDM BlobDJ xar2EDM BlobDJ xar2EDM BlobDJ xar2EDM BlobDJ xar2EDM BlobDJ xar2EDM BlobDJ xar2EDM", tid);
				messageTimeout = Date.now();
			}
		}
		
	}
	
	if (data.chatmessage.includes("djnewgShakennog")){
		if (data.chatname !== "EVARATE"){
			if (Date.now() - messageTimeout > 60000){
				respondP2P("xar2EDM djnewgShakennog xar2EDM djnewgShakennog xar2EDM djnewgShakennog xar2EDM djnewgShakennog xar2EDM djnewgShakennog xar2EDM djnewgShakennog xar2EDM djnewgShakennog ", tid);
				messageTimeout = Date.now();
			}
		}
	}
	
	
	
	if (data.chatmessage.includes("pykamuCoom")){
		if (data.chatname.toLowerCase() === "pykamusic"){
			respondP2P("pykamuCoom <3 pykamuCoom <3 pykamuCoom <3", tid);
			messageTimeout = Date.now();
		} 
	}
	
	if (data.chatmessage.toLowerCase() === "!newgirlmeter"){
			
		var score = parseInt(Math.random()* 9+0.5);
		if (data.chatname.toLowerCase() === "pykamusic"){
			respondP2P("@"+data.chatname+" ain't new, and mostly a girl, so just "+parseInt(score/2+3)+"/10 on the newgirl-o-meter pykamuShook", tid);
		} else if (data.chatname.toLowerCase() === "jessu"){
			respondP2P("@"+data.chatname+" hasn't VIP'd me yet, so 6/10 on the newgirl-o-meter <3", tid);
		} else if (data.chatname.toLowerCase() in {"nx01": true, "e_t_h_o_s": true, "heyitsipo":true, "cconetwo12": true, "alooshua":true, "trauh23":true, "racingmars": true, "bobthedummer1":true, "djryanmelis":true, "ghost3966d":true}){
			respondP2P("@"+data.chatname+" is a "+(score+5)+"/10 on the newgirl-o-meter djnewgPinklolli djnewgPinklolli djnewgPinklolli ", tid);
		} else if (data.chatname.toLowerCase() in {"tig3r_hoods":true}){
			respondP2P("@"+data.chatname+" is a 0/10 on the newgirl-o-meter. Maybe next year LUL", tid);
		} else if (data.chatname.toLowerCase() in {"evarate":true}){
			//
		} else if (data.chatname.toLowerCase() in {"djnewgirl":true}){
			respondP2P("@"+data.chatname+" is a 69/69 on the newgirl-o-meter", tid);
		} else if (Date.now() - messageTimeout > 3000){
			respondP2P("@"+data.chatname+" is a "+score+"/10 on the newgirl-o-meter djnewgPinklolli", tid);
		}
		messageTimeout = Date.now();
	}

	if (data.chatmessage.toLowerCase() === "!pykameter"){
			
		var score = parseInt(Math.random()* 9+0.5);
		if (data.chatname.toLowerCase() === "pykamusic"){
			respondP2P("@"+data.chatname+" is a 69/10 on the Pyka-o-meter", tid);
		} else if (data.chatname.toLowerCase() === "jessu"){
			respondP2P("@"+data.chatname+" is a 13/10 on the Pyka-o-meter", tid);
		} else if (data.chatname.toLowerCase() in {"nx01": true, "e_t_h_o_s": true, "heyitsipo":true, "cconetwo12": true, "alooshua":true, "trauh23":true, "racingmars": true, "bobthedummer1":true, "djryanmelis":true, "ghost3966d":true}){
			respondP2P("@"+data.chatname+" is an 11/10 on the Pyka-o-meter", tid);
		} else if (data.chatname.toLowerCase() in {"tig3r_hoods":true}){
			respondP2P("@"+data.chatname+" is a 0/10 on the Pyka-o-meter", tid);
		} else if (data.chatname.toLowerCase() in {"evarate":true}){
			respondP2P("This song has broken the Pyka-o-meter. Try again later.", tid);
		} else if (Date.now() - messageTimeout > 3000){
			respondP2P("@"+data.chatname+" is a "+score+"/10 on the Pyka-o-meter", tid);
		}
		messageTimeout = Date.now();
	}
	if (data.chatmessage.toLowerCase() === "!jessumeter"){
			
		var score = parseInt(Math.random()* 9+0.5);
		if (data.chatname.toLowerCase() === "pykamusic"){
			respondP2P("@"+data.chatname+" is a 69/69 on the Jessu-o-meter", tid);
		} else if (data.chatname.toLowerCase() === "jessu"){
			respondP2P("@"+data.chatname+" is a 69/10 on the Jessu-o-meter", tid);
		} else if (data.chatname.toLowerCase() in {"nx01": true, "heyitsipo":true, "truah23":true, "alooshua":true, "passi_1479":true, "bobthedummer1":true, "djryanmelis":true, "ghost3966d":true}){
			respondP2P("@"+data.chatname+" is an "+(7+score)+"/10 on the Jessu-o-meter", tid);
		} else if (data.chatname.toLowerCase() in {"tig3r_hoods":true}){
			respondP2P("@"+data.chatname+" is a 0/10 on the Jessu-o-meter", tid);
		} else if (data.chatname.toLowerCase() in {"evarate":true}){
			respondP2P("Evarate be the Jessu-o-meter.", tid);
		} else if (data.chatname.toLowerCase() in {"e_t_h_o_s":true}){
			respondP2P("@"+data.chatname+" is a 10.69/10 on the Jessu-o-meter", tid);
		} else if (data.chatname in {"KawaiiSenpai_TV":true}){
			respondP2P("@"+data.chatname+" is no longer cool enough for the Jessu-o-meter", tid);
		} else if (data.chatname in {"trauh23":true}){
			respondP2P("@"+data.chatname+" subs to Evarate's OnlyFans. LUL", tid);
		} else if (data.chatname in {"RussianSniperr":true}){
			respondP2P("@"+data.chatname+" is Russian. And a sniper. Don't kill me.", tid);	
		} else if (Date.now() - messageTimeout > 3000){
			respondP2P("@"+data.chatname+" is a "+score+"/10 on the Jessu-o-meter", tid);
		}
		messageTimeout = Date.now();
	} // there lack of confidence should lower their score if retrying more than once a day.
	

	if ((data.chatmessage.toLowerCase() === "!steveometer") || (data.chatmessage.toLowerCase() === "!stevemeter")){
		if (Date.now() - messageTimeout > 10000){ // respond to "1" with a "1" automatically; at most 1 time per minute.
			var score = parseInt(Math.random()* 9+0.5);
			if (data.chatname.toLowerCase() === "pykamusic"){
				respondP2P("@"+data.chatname+" is a 6969/10 on the Steve-o-meter", tid);
			} else if (data.chatname.toLowerCase() === "jessu"){
				respondP2P("@"+data.chatname+" is a 26/10 on the Steve-o-meter", tid);
			} else if (data.chatname.toLowerCase() in {"e_t_h_o_s": true, "heyitsipo":true, "alooshua":true, "bobthedummer1":true, "djryanmelis":true}){
				respondP2P("@"+data.chatname+" is a 11/10 on the Steve-o-meter", tid);
			} else if (data.chatname.toLowerCase() in {"tig3r_hoods":true}){
				respondP2P("@"+data.chatname+" is a 0/10 on the Steve-o-meter. damn! LUL", tid);
			} else if (data.chatname.toLowerCase() in {"alooshua":true}){
				respondP2P("@"+data.chatname+", you already know you're a perfect 10 on the steveometer. <3", tid);
			} else if (data.chatname.toLowerCase() in {"evarate":true}){
				respondP2P("Evarate be the Steve-o-meter.", tid);
			} else if (Date.now() - messageTimeout > 3000){
				respondP2P("@"+data.chatname+" is a "+score+"/10 on the Steve-o-meter", tid);
			}
			messageTimeout = Date.now();
		}
	}

	if (data.chatmessage.toLowerCase() === "!sweetmeter"){
		if (Date.now() - messageTimeout > 60000){ // respond to "1" with a "1" automatically; at most 1 time per minute.
			var score = parseInt(Math.random()* 9+0.5);
			if (data.chatname.toLowerCase() === "pykamusic"){
				respondP2P("@"+data.chatname+" is a 69/10 on the Sweetness-o-meter", tid);
			} else if (data.chatname.toLowerCase() === "jessu"){
				respondP2P("@"+data.chatname+" is a 13/10 on the Sweetness-o-meter", tid);
			} else if (data.chatname.toLowerCase() in {"heyitsipo":true, "alooshua":true, "bobthedummer1":true, "djryanmelis":true}){
				respondP2P("@"+data.chatname+" is a 11/10 on the Sweetness-o-meter", tid);
			} else if (data.chatname.toLowerCase() in {"tig3r_hoods":true}){
				respondP2P("@"+data.chatname+" is a 0/10 on the Sweetness-o-meter", tid);
			} else if (data.chatname.toLowerCase() in {"evarate":true}){
				respondP2P("Evarate be the Sweetness-o-meter.", tid);
			} else if (Date.now() - messageTimeout > 3000){
				respondP2P("@"+data.chatname+" is a "+score+"/10 on the Sweetness-o-meter", tid);
			}
			messageTimeout = Date.now();
		}
	}
}