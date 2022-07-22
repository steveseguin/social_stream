 var text-to-speech = function(state) {
    const url = 'https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=GOOGLE_API_KEY'
    const data = {
      'input':{
         'text':'Android is a mobile operating system developed by Google, based on the Linux kernel and designed primarily for touchscreen mobile devices such as smartphones and tablets.'
      },
      'voice':{
         'languageCode':'en-gb',
         'name':'en-GB-Standard-A',
         'ssmlGender':'FEMALE'
      },
      'audioConfig':{
      'audioEncoding':'MP3'
      }
     };
     const otherparam={
        headers:{
           "content-type":"application/json; charset=UTF-8"
        },
        body:JSON.stringify(data),
        method:"POST"
     };
    fetch(url,otherparam)
    .then(data=>{return data.json()})
    .then(res=>{console.log(res.audioContent); })
    .catch(error=>{console.log(error);state.onError(error)})
  };