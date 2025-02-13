(() => {
  if (!window.electronApi) return;
  
  console.log("Disable autogain, echo cancellation and noise reduction code injected");
  const setMediaConstraint = (constraint, name, value) => {
    if (!constraint) return;
    
    if (constraint.advanced?.find(opt => name in opt)) {
      constraint.advanced.find(opt => name in opt)[name] = value;
      return;
    }
    if (constraint.mandatory?.[name]) {
      constraint.mandatory[name] = value;
      return;
    }
    if (constraint.optional?.find(opt => name in opt)) {
      constraint.optional.find(opt => name in opt)[name] = value;
      return;
    }
    constraint.optional = constraint.optional || [];
    constraint.optional.push({ [name]: value });
  };
  const disableAudioProcessing = constraints => {
    if (!constraints?.audio || typeof constraints.audio !== 'object') return constraints;
    const audio = constraints.audio;
    const audioSettings = {
      autoGainControl: false,
      googAutoGainControl: false,
      googAutoGainControl2: false,
      echoCancellation: false,
      googEchoCancellation: false,
      googEchoCancellation2: false,
      noiseSuppression: false,
      googNoiseSuppression: false,
      googNoiseSuppression2: false
    };
    if (audio.optional || audio.mandatory) {
      Object.entries(audioSettings).forEach(([key, value]) => 
        setMediaConstraint(audio, key, value)
      );
    } else {
      Object.assign(audio, audioSettings);
    }
    return constraints;
  };
  const patchMediaFunction = (object, name, wrapper) => {
    if (!(name in object)) return;
    const original = object[name];
    object[name] = wrapper(original);
  };
  patchMediaFunction(navigator.mediaDevices, 'getUserMedia', original => 
    async function getUserMedia(constraints) {
      return original.call(this, disableAudioProcessing({ ...constraints }));
    }
  );
  const patchLegacyGetUserMedia = original =>
    function getUserMedia(constraints, success, error) {
      return original.call(this, disableAudioProcessing({ ...constraints }), success, error);
    };
  ['getUserMedia', 'mozGetUserMedia', 'webkitGetUserMedia'].forEach(method => 
    patchMediaFunction(navigator, method, patchLegacyGetUserMedia)
  );
  patchMediaFunction(MediaStreamTrack.prototype, 'applyConstraints', original =>
    function applyConstraints(constraints) {
      return original.call(this, disableAudioProcessing({ ...constraints }));
    }
  );
})();