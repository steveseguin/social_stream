let usingElectron = false;
(() => {
  console.log("Initializing Whatnot source");
  const badgeIcons = {
    BRONZE: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="height: 16px; width: 16px;"><g filter="url(#filter0_ii_2347_181606)"><circle cx="32" cy="32" r="30" fill="url(#paint0_linear_2347_181606)"></circle></g><circle opacity="0.5" cx="32" cy="32" r="20" fill="url(#paint1_linear_2347_181606)"></circle><circle cx="32" cy="32" r="18.5" stroke="url(#paint2_linear_2347_181606)" stroke-width="3"></circle><g mix-blend-mode="multiply" opacity="0.7" clip-path="url(#clip0_2347_181606)"><path fill-rule="evenodd" clip-rule="evenodd" d="M35.4998 24.5C35.4998 25.9108 34.6651 27.1266 33.4626 27.6806C34.0448 27.8707 34.592 28.1978 35.0538 28.662L35.8459 29.4583L37.6125 27.6823C37.8138 27.4798 38.0403 27.3182 38.2817 27.1971C38.1008 26.8111 37.9998 26.3802 37.9998 25.9258C37.9998 24.2689 39.3429 22.9258 40.9998 22.9258C42.6566 22.9258 43.9998 24.2689 43.9998 25.9258C43.9998 27.269 43.117 28.406 41.9 28.7884C41.9839 29.0827 42.0154 29.3927 41.9896 29.7042L41.5506 35H22.4475L22.0085 29.7042C21.9827 29.3925 22.0142 29.0824 22.0983 28.788C20.8819 28.4052 19.9998 27.2685 19.9998 25.9258C19.9998 24.2689 21.3429 22.9258 22.9998 22.9258C24.6566 22.9258 25.9998 24.2689 25.9998 25.9258C25.9998 26.3805 25.8986 26.8115 25.7176 27.1977C25.9586 27.3187 26.1846 27.4801 26.3857 27.6823L28.1523 29.4583L28.9443 28.662C29.4063 28.1976 29.9538 27.8704 30.5364 27.6803C29.3342 27.1262 28.4998 25.9106 28.4998 24.5C28.4998 22.567 30.0668 21 31.9998 21C33.9328 21 35.4998 22.567 35.4998 24.5ZM22.6133 37L22.7235 38.3296C22.8954 40.4035 24.6288 41.9992 26.7098 41.9992H32.0499H32.05H37.2883C39.3693 41.9992 41.1027 40.4035 41.2746 38.3296L41.3848 37H22.6133Z" fill="#873400"></path></g><defs><filter id="filter0_ii_2347_181606" x="2" y="-1" width="60" height="66" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"></feBlend><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"></feColorMatrix><feOffset dy="3"></feOffset><feGaussianBlur stdDeviation="2"></feGaussianBlur><feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"></feComposite><feColorMatrix type="matrix" values="0 0 0 0 0.972549 0 0 0 0 0.717647 0 0 0 0 0.0862745 0 0 0 0.5 0"></feColorMatrix><feBlend mode="screen" in2="shape" result="effect1_innerShadow_2347_181606"></feBlend><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"></feColorMatrix><feOffset dy="-3"></feOffset><feGaussianBlur stdDeviation="2"></feGaussianBlur><feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"></feComposite><feColorMatrix type="matrix" values="0 0 0 0 0.760784 0 0 0 0 0.356863 0 0 0 0 0.0666667 0 0 0 0.6 0"></feColorMatrix><feBlend mode="multiply" in2="effect1_innerShadow_2347_181606" result="effect2_innerShadow_2347_181606"></feBlend></filter><linearGradient id="paint0_linear_2347_181606" x1="31.9312" y1="55.0006" x2="31.9295" y2="2.76892" gradientUnits="userSpaceOnUse"><stop stop-color="#BB650C"></stop><stop offset="1" stop-color="#FFB659"></stop></linearGradient><linearGradient id="paint1_linear_2347_181606" x1="32" y1="12" x2="32" y2="51.0476" gradientUnits="userSpaceOnUse"><stop offset="0.609756" stop-color="white" stop-opacity="0"></stop><stop offset="0.95" stop-color="#943E0F"></stop></linearGradient><linearGradient id="paint2_linear_2347_181606" x1="32" y1="52" x2="32" y2="12" gradientUnits="userSpaceOnUse"><stop stop-color="#FECD78"></stop><stop offset="1" stop-color="#923D0E"></stop></linearGradient><clipPath id="clip0_2347_181606"><rect width="24" height="24" fill="white" transform="translate(20 20)"></rect></clipPath></defs></svg>`,
    SILVER: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="height: 16px; width: 16px;"><path d="M5.14124 19.0805C1.57841 21.6567 0.116202 26.2578 1.53817 30.4181L9.3369 53.2356C10.72 57.2821 14.5231 60.0014 18.7995 60.0014H45.1998C49.4762 60.0014 53.2793 57.2821 54.6624 53.2356L62.4611 30.4181C63.8831 26.2578 62.4209 21.6567 58.858 19.0805L37.8591 3.89652C34.362 1.36783 29.6372 1.36783 26.1402 3.89652L5.14124 19.0805Z" fill="url(#paint0_linear_2347_181605)"></path><circle opacity="0.6" cx="31.9998" cy="33" r="20" fill="url(#paint1_linear_2347_181605)"></circle><circle cx="31.9998" cy="33" r="18.5" stroke="url(#paint2_linear_2347_181605)" stroke-width="3"></circle><g mix-blend-mode="multiply" opacity="0.9" clip-path="url(#clip0_2347_181605)"><path fill-rule="evenodd" clip-rule="evenodd" d="M35.4998 25.5C35.4998 26.9108 34.6651 28.1266 33.4626 28.6806C34.0448 28.8707 34.592 29.1978 35.0538 29.662L35.8459 30.4583L37.6125 28.6823C37.8138 28.4798 38.0403 28.3182 38.2817 28.1971C38.1008 27.8111 37.9998 27.3802 37.9998 26.9258C37.9998 25.2689 39.3429 23.9258 40.9998 23.9258C42.6566 23.9258 43.9998 25.2689 43.9998 26.9258C43.9998 28.269 43.117 29.406 41.9 29.7884C41.9839 30.0827 42.0154 30.3927 41.9896 30.7042L41.5506 36H22.4475L22.0085 30.7042C21.9827 30.3925 22.0142 30.0824 22.0983 29.788C20.8819 29.4052 19.9998 28.2685 19.9998 26.9258C19.9998 25.2689 21.3429 23.9258 22.9998 23.9258C24.6566 23.9258 25.9998 25.2689 25.9998 26.9258C25.9998 27.3805 25.8986 27.8115 25.7176 28.1977C25.9586 28.3187 26.1846 28.4801 26.3857 28.6823L28.1523 30.4583L28.9443 29.662C29.4063 29.1976 29.9538 28.8704 30.5364 28.6803C29.3342 28.1262 28.4998 26.9106 28.4998 25.5C28.4998 23.567 30.0668 22 31.9998 22C33.9328 22 35.4998 23.567 35.4998 25.5ZM22.6133 38L22.7235 39.3296C22.8954 41.4035 24.6288 42.9992 26.7098 42.9992H32.0499H32.05H37.2883C39.3693 42.9992 41.1027 41.4035 41.2746 39.3296L41.3848 38H22.6133Z" fill="#787878"></path></g><defs><linearGradient id="paint0_linear_2347_181605" x1="31.9286" y1="2" x2="31.9991" y2="60" gradientUnits="userSpaceOnUse"><stop stop-color="#EDEDED"></stop><stop offset="0.189423" stop-color="#D5D5D5"></stop><stop offset="0.637804" stop-color="#BEBEBE"></stop><stop offset="1" stop-color="#686868"></stop></linearGradient><linearGradient id="paint1_linear_2347_181605" x1="31.9998" y1="13" x2="31.9998" y2="52.0476" gradientUnits="userSpaceOnUse"><stop stop-color="white"></stop><stop offset="0.95" stop-color="#7B7B7B"></stop></linearGradient><linearGradient id="paint2_linear_2347_181605" x1="31.9998" y1="53" x2="31.9998" y2="13" gradientUnits="userSpaceOnUse"><stop stop-color="#F1F1F1"></stop><stop offset="1" stop-color="#676767"></stop></linearGradient><clipPath id="clip0_2347_181605"><rect width="24" height="24" fill="white" transform="translate(20 21)"></rect></clipPath></defs></svg>`,
    GOLD: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="height: 16px; width: 16px;"><path fill-rule="evenodd" clip-rule="evenodd" d="M4 31.0664V31.9967L4.00016 41.8689C4.00022 45.3484 5.87253 48.5588 8.90102 50.2722L27.2957 60.6791C30.2511 62.3511 33.8675 62.3478 36.8198 60.6703L55.1146 50.2754C58.1345 48.5596 60 45.3539 60 41.8807L60 31.9967L60 31.0664L60 22.1195C60 18.6463 58.1345 15.4406 55.1146 13.7248L36.8198 3.3299C33.8675 1.65244 30.2511 1.64911 27.2957 3.32113L8.90102 13.728C5.87252 15.4414 4.00021 18.6518 4.00016 22.1314L4 31.0664Z" fill="url(#paint0_linear_2347_181604)"></path><circle cx="32" cy="32.0001" r="18.5" stroke="url(#paint1_linear_2347_181604)" stroke-width="3"></circle><g mix-blend-mode="multiply" opacity="0.9"><path fill-rule="evenodd" clip-rule="evenodd" d="M35.5 24.5C35.5 25.9108 34.6653 27.1266 33.4628 27.6806C34.0451 27.8707 34.5923 28.1978 35.054 28.662L35.8461 29.4583L37.6127 27.6823C37.8141 27.4798 38.0405 27.3182 38.2819 27.1971C38.1011 26.8111 38 26.3802 38 25.9258C38 24.2689 39.3431 22.9258 41 22.9258C42.6569 22.9258 44 24.2689 44 25.9258C44 27.269 43.1172 28.406 41.9002 28.7884C41.9842 29.0827 42.0157 29.3927 41.9898 29.7042L41.5509 35H22.4478L22.0088 29.7042C21.9829 29.3925 22.0145 29.0824 22.0985 28.788C20.8821 28.4052 20 27.2685 20 25.9258C20 24.2689 21.3431 22.9258 23 22.9258C24.6569 22.9258 26 24.2689 26 25.9258C26 26.3805 25.8989 26.8115 25.7178 27.1977C25.9588 27.3187 26.1849 27.4801 26.3859 27.6823L28.1525 29.4583L28.9446 28.662C29.4066 28.1976 29.9541 27.8704 30.5366 27.6803C29.3344 27.1262 28.5 25.9106 28.5 24.5C28.5 22.567 30.067 21 32 21C33.933 21 35.5 22.567 35.5 24.5ZM22.6135 37L22.7238 38.3296C22.8957 40.4035 24.6291 41.9992 26.7101 41.9992H32.0502H32.0503H37.2885C39.3696 41.9992 41.103 40.4035 41.2749 38.3296L41.3851 37H22.6135Z" fill="#8F6F43"></path></g><defs><linearGradient id="paint0_linear_2347_181604" x1="32" y1="62" x2="31.9337" y2="2.8366" gradientUnits="userSpaceOnUse"><stop stop-color="#937500"></stop><stop offset="0.358238" stop-color="#DAC263"></stop><stop offset="0.709939" stop-color="#E8D88B"></stop><stop offset="1" stop-color="#FFF6C1"></stop></linearGradient><linearGradient id="paint1_linear_2347_181604" x1="32" y1="52.0001" x2="32" y2="12.0001" gradientUnits="userSpaceOnUse"><stop stop-color="#F4EAAC"></stop><stop offset="1" stop-color="#BB9E38"></stop></linearGradient></defs></svg>`,
    PLATINUM: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="height: 16px; width: 16px;"><path fill-rule="evenodd" clip-rule="evenodd" d="M39.0687 3.92893C35.1635 0.023689 28.8318 0.0236896 24.9266 3.92893L21.7056 7.14994H17.1501C11.6272 7.14994 7.15006 11.6271 7.15006 17.1499V21.7055L3.92893 24.9266C0.023689 28.8318 0.0236896 35.1635 3.92893 39.0687L7.15006 42.2899V46.8451C7.15006 52.368 11.6272 56.8451 17.1501 56.8451H21.7053L24.9266 60.0664C28.8318 63.9717 35.1635 63.9717 39.0687 60.0664L42.29 56.8451H46.8453C52.3681 56.8451 56.8453 52.368 56.8453 46.8451V42.2899L60.0664 39.0687C63.9717 35.1635 63.9717 28.8318 60.0664 24.9266L56.8453 21.7054V17.1499C56.8453 11.6271 52.3681 7.14994 46.8452 7.14994H42.2897L39.0687 3.92893Z" fill="url(#paint0_linear_2347_181603)"></path><circle opacity="0.6" cx="32" cy="33" r="20" fill="url(#paint1_linear_2347_181603)"></circle><circle cx="32" cy="33" r="18.5" stroke="url(#paint2_linear_2347_181603)" stroke-width="3"></circle><g mix-blend-mode="multiply" opacity="0.9" clip-path="url(#clip0_2347_181603)"><path fill-rule="evenodd" clip-rule="evenodd" d="M35.5017 25.5023C35.5017 26.9131 34.667 28.1289 33.4645 28.6829C34.0468 28.873 34.594 29.2001 35.0557 29.6643L35.8478 30.4606L37.6144 28.6846C37.8158 28.4822 38.0422 28.3205 38.2836 28.1994C38.1028 27.8134 38.0017 27.3826 38.0017 26.9281C38.0017 25.2712 39.3449 23.9281 41.0017 23.9281C42.6586 23.9281 44.0017 25.2712 44.0017 26.9281C44.0017 28.2713 43.119 29.4083 41.9019 29.7907C41.9859 30.085 42.0174 30.395 41.9916 30.7065L41.5526 36.0023H22.4495L22.0105 30.7065C21.9847 30.3949 22.0162 30.0847 22.1002 29.7903C20.8839 29.4076 20.0017 28.2708 20.0017 26.9281C20.0017 25.2712 21.3449 23.9281 23.0017 23.9281C24.6586 23.9281 26.0017 25.2712 26.0017 26.9281C26.0017 27.3828 25.9006 27.8138 25.7195 28.2C25.9605 28.321 26.1866 28.4825 26.3876 28.6846L28.1542 30.4606L28.9463 29.6643C29.4083 29.1999 29.9558 28.8727 30.5383 28.6826C29.3361 28.1286 28.5017 26.9129 28.5017 25.5023C28.5017 23.5693 30.0687 22.0023 32.0017 22.0023C33.9347 22.0023 35.5017 23.5693 35.5017 25.5023ZM22.6153 38.0023L22.7255 39.3319C22.8974 41.4059 24.6308 43.0015 26.7118 43.0015H32.0519H32.052H37.2903C39.3713 43.0015 41.1047 41.4059 41.2766 39.3319L41.3868 38.0023H22.6153Z" fill="#759192" mix-blend-mode="multiply"></path></g><defs><linearGradient id="paint0_linear_2347_181603" x1="32" y1="63" x2="31.9246" y2="1.79449" gradientUnits="userSpaceOnUse"><stop stop-color="#7D7D7D"></stop><stop offset="0.335113" stop-color="#D0D0D0"></stop><stop offset="0.784409" stop-color="#F0F0F0"></stop><stop offset="1" stop-color="white"></stop></linearGradient><linearGradient id="paint1_linear_2347_181603" x1="32" y1="13" x2="32" y2="52.0476" gradientUnits="userSpaceOnUse"><stop offset="0.0640244" stop-color="white" stop-opacity="0"></stop><stop offset="0.95" stop-color="white"></stop></linearGradient><linearGradient id="paint2_linear_2347_181603" x1="32" y1="53" x2="32" y2="13" gradientUnits="userSpaceOnUse"><stop stop-color="white"></stop><stop offset="1" stop-color="#96A4A5"></stop></linearGradient><clipPath id="clip0_2347_181603"><rect width="24" height="24" fill="white" transform="translate(20.002 21.0023)"></rect></clipPath></defs></svg>`,
    DIAMOND: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.17316 38.9988C1.14608 36.0711 0.277638 31.5606 2.00119 27.7182L9.9903 9.9074C11.6026 6.31298 15.175 4.00008 19.1144 4.00008H44.8843C48.8237 4.00008 52.3961 6.31297 54.0084 9.90739L61.9975 27.7182C63.7211 31.5606 62.8526 36.0711 59.8255 38.9988L38.9515 59.188C35.075 62.9373 28.9237 62.9373 25.0472 59.188L4.17316 38.9988Z" fill="url(#paint0_linear_2347_181602)"/><circle opacity="0.5" cx="31.9998" cy="30" r="20" fill="url(#paint1_linear_2347_181602)"/><circle cx="31.9998" cy="30" r="18.5" stroke="url(#paint2_linear_2347_181602)" stroke-width="3"/><g mix-blend-mode="multiply" opacity="0.9" clip-path="url(#clip0_2347_181602)"><path fill-rule="evenodd" clip-rule="evenodd" d="M35.4998 22.5C35.4998 23.9108 34.6651 25.1266 33.4626 25.6806C34.0448 25.8707 34.592 26.1978 35.0538 26.662L35.8459 27.4583L37.6125 25.6823C37.8138 25.4798 38.0403 25.3182 38.2817 25.1971C38.1008 24.8111 37.9998 24.3802 37.9998 23.9258C37.9998 22.2689 39.3429 20.9258 40.9998 20.9258C42.6566 20.9258 43.9998 22.2689 43.9998 23.9258C43.9998 25.269 43.117 26.406 41.9 26.7884C41.9839 27.0827 42.0154 27.3927 41.9896 27.7042L41.5506 33H22.4475L22.0085 27.7042C21.9827 27.3925 22.0142 27.0824 22.0983 26.788C20.8819 26.4052 19.9998 25.2685 19.9998 23.9258C19.9998 22.2689 21.3429 20.9258 22.9998 20.9258C24.6566 20.9258 25.9998 22.2689 25.9998 23.9258C25.9998 24.3805 25.8986 24.8115 25.7176 25.1977C25.9586 25.3187 26.1846 25.4801 26.3857 25.6823L28.1523 27.4583L28.9443 26.662C29.4063 26.1976 29.9538 25.8704 30.5364 25.6803C29.3342 25.1262 28.4998 23.9106 28.4998 22.5C28.4998 20.567 30.0668 19 31.9998 19C33.9328 19 35.4998 20.567 35.4998 22.5ZM22.6133 35L22.7235 36.3296C22.8954 38.4035 24.6288 39.9992 26.7098 39.9992H32.0499H32.05H37.2883C39.3693 39.9992 41.1027 38.4035 41.2746 36.3296L41.3848 35H22.6133Z" fill="#0B8DB3" mix-blend-mode="multiply"/></g><defs><linearGradient id="paint0_linear_2347_181602" x1="32" y1="4" x2="31.9982" y2="62" gradientUnits="userSpaceOnUse"><stop stop-color="#CAFFFF"/><stop offset="0.191589" stop-color="#90F4FB"/><stop offset="0.603924" stop-color="#43D3EE"/><stop offset="1" stop-color="#1895B1"/></linearGradient><linearGradient id="paint1_linear_2347_181602" x1="31.9998" y1="10" x2="31.9998" y2="49.0476" gradientUnits="userSpaceOnUse"><stop offset="0.609756" stop-color="white" stop-opacity="0"/><stop offset="0.95" stop-color="#35B9C9"/></linearGradient><linearGradient id="paint2_linear_2347_181602" x1="31.9998" y1="50" x2="31.9998" y2="10" gradientUnits="userSpaceOnUse"><stop stop-color="#B4FFFF"/><stop offset="1" stop-color="#149AC7"/></linearGradient><clipPath id="clip0_2347_181602"><rect width="24" height="24" fill="white" transform="translate(20 18)"/></clipPath></defs></svg>`,
  };


  /**
   * @typedef {{ type: typeof WSEventType.RECEIVE | typeof WSEventType.SEND, data: string }} WSEventPayload
   */

  const WSEventType = /** @type {const} */ ({
    /** When a message is received from the Whatnot WS */
    RECEIVE: "receive",
    /** When a message is sent through the Whatnot WS */
    SEND: "send"
  });

  /**
   * Ensures that the given data is a string.
   * @param {string|ArrayBuffer|ArrayBufferView} data 
   * @returns {string}
   */
  function normalizeToString(data) {
    if (typeof data === "string") return data;
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      return new TextDecoder().decode(data);
    }
    throw new Error("Unsupported data type");
    //return String(data);
  }

  /**
   * Checks that the runtime environment is available and functional.
   * @returns {boolean}
   */
  function checkRuntime() {
    if (usingElectron) return true;
    if (!chrome?.runtime?.id) return false;
    if (chrome.runtime.lastError) return false;

    return true;
  }
  const isElectron = window.ninjafy !== undefined || !!(typeof process !== "undefined" && process.versions?.electron);
  console.log("Detected environment:", isElectron ? "Electron (ninjafy)" : "Web (injected WS)");
  //const isElectron = false;
  if (isElectron) {
    setupElectron();
  } else {
    injectWebSocketInterceptor();
    setupWeb();
  }

  /**
   * 
   * @param {number} ms Time in milliseconds to sleep
   * @returns {Promise<void>}
   */
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  /**
   * Intercepts WS connections via ninjafy
   * @returns {Promise<void>}
   */
  async function setupElectron() {
    console.log("Checking for ninjafy WebSocket interception:", !!window.ninjafy?.onWebSocketMessage);
    for (let i = 0; i < 20 && !window.ninjafy?.onWebSocketMessage; i++) {
      await sleep(100);
    }

    if (!window.ninjafy?.onWebSocketMessage) {
      console.log("Failed to set up ninjafy WebSocket interception. Forcing WS injection.");

      await injectWebSocketInterceptor();

      return setupWeb();
    }

    console.log("Setting up ninjafy WebSocket interception");
    usingElectron = true;

    const handler = createMessageHandler(cleanUp);
    // Currently no cleanup mechanism for ninjafy
    function cleanUp() { }

    const NinjafyPayloadType = /** @type {const} */ ({
      SEND: "send",
      RECEIVE: "message",
      OPEN: "open",
      CLOSE: "close",
    });


    const NinjafyPayloadTypeToWSEventTypeMap = /** @satisfies {Record<(typeof NinjafyPayloadType)[keyof typeof NinjafyPayloadType], typeof WSEventType[keyof typeof WSEventType]>} */ ({
      [NinjafyPayloadType.SEND]: WSEventType.SEND,
      [NinjafyPayloadType.RECEIVE]: WSEventType.RECEIVE,
    });

    /**
     * @typedef {Object} NinjafyPayload
     * @property {string | ArrayBuffer | ArrayBufferView} data - The raw WebSocket message data, either as a string or binary.
     * @property {NinjafyPayloadType} type - The type of WebSocket event.
     * @property {string} url - The URL of the WebSocket connection.
     * @property {number} timestamp - The timestamp when the event occurred.
     */
    window.ninjafy.onWebSocketMessage((/** @type {NinjafyPayload} */ payload) => {
      const type = NinjafyPayloadTypeToWSEventTypeMap[payload.type];
      if (type === undefined) return;
      try {
        handler({
          type,
          data: normalizeToString(payload.data),
        });
      } catch (e) {
        console.log("Failed to process ninjafy WS message:", e);
      }
    });

    console.log("Ninjafy WebSocket interception set up successfully");
  }

  async function injectWebSocketInterceptor() {
    if (typeof runWS === "function") {
      console.log("Running WebSocket interceptor in page context");
      return runWS();
    }

    console.log("Injecting WebSocket interceptor script into page context");
    return await chrome.runtime.sendMessage({ type: "injectCustomSource", source: "inject/whatnot-ws.js" });
  }

  /**
   * @typedef {Object} Money
   * @property {number} amount - The amount of money in cents (e.g., 500 for $5.00).
   * @property {string} currency - The ISO 4217 currency code (e.g., "USD", "EUR").
   */

  /**
   * @param {Money} money 
   * @param {number} [magnitude=0.01] - The factor to convert the amount to standard units (e.g., 0.01 to convert cents to dollars).
   * @returns {string}
   */
  function formatMoney({ amount, currency }, magnitude = 0.01) {
    const formattedAmount = new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount * magnitude);

    return `${formattedAmount} ${currency}`;
  }

  /**
   * 
   * @param {(...args: any[]) => void} cleanUp 
   * @returns {(wsEvent: WSEventPayload) => void}
   */
  function createMessageHandler(cleanUp) {
    return async function onMessage(wsEvent) {
      if (!checkRuntime()) return cleanUp();
      if (!isIncomingPayload(wsEvent)) return;

      // Handle the incoming message from the page
      //console.log("Received posted message:", wsEvent);
      // Only handle incoming messages for now
      if (wsEvent.type !== WSEventType.RECEIVE) return console.log("Not receive type");

      // Parse Phoenix WS message
      const parsedArray = JSON.parse(wsEvent.data);

      // Must be a properly sized array
      if (!Array.isArray(parsedArray) || parsedArray.length < 5) return console.log("Invalid message format: Array too short");

      const [eventId, _, wsChannel, eventType, payload] = parsedArray;

      switch (eventType) {
        case "raid_selected": {
          return await createAndPushMessage({
            chatname: payload.fromUser.username,
            chatmessage: "has started a raid",
          }, payload.fromUser);
        }

        case "has_been_raided": {
          return await createAndPushMessage({
            chatname: payload.fromUser.username,
            chatmessage: `is raiding with a party of ${payload.numRaiders}`,
            event: "raid",
          }, payload.fromUser);
        }

        case "new_msg": {
          // Booster message "Ads Community Boost"
          // {amount: number (cents), currency: string}
          if (payload.properties.adscb) {
            return createAndPushMessage({
              chatname: payload.user.username,
              chatmessage: payload.message,
              event: "boost",
              hasDonation: formatMoney(payload.properties.adscb),
            });
          }

          return await createAndPushMessage({
            chatname: payload.user.username,
            chatmessage: payload.message,
          }, payload.user);
        }

        case "tip_sent": {
          return await createAndPushMessage({
            event: "donation",
            hasDonation: formatMoney(payload.tip.tipValue, payload.tip.magnitude),
            donoValue: payload.tip.tipValue * (payload.tip.magnitude || 0.01),

          }, payload.tip.senderUser);
        }

        case "presence_diff": {
          const joins = payload.joins[wsChannel]?.metas;

          // Likely only contains leaves
          if (!Array.isArray(joins)) return;

          if (!settings.capturejoinedevents) return;
          for (const join of joins) {
            await createAndPushMessage({
              chatname: join.username,
              chatmessage: "has joined the stream",
              event: "join",
            }, join);
          }
        }
      }
    };
  }

  /**
   * Intercepts WS connections by script injections
   */
  function setupWeb() {
    const handler = createMessageHandler(cleanUp);
    const onMessage = (/** @type {MessageEvent<WSEventPayload>} */ event) => handler(event.data);

    function cleanUp() {
      window.removeEventListener("message", onMessage);
      console.log("Cleaned up injected script message listener");
    }

    window.addEventListener("message", onMessage);
  }
  /**
   * 
   * @param {any} data 
   * @returns {data is WSEventPayload}
   */
  function isIncomingPayload(data) {
    if (typeof data !== "object" || data === null) return false;
    if (typeof data.data !== "string") return false;
    switch (data.type) {
      case WSEventType.RECEIVE:
      case WSEventType.SEND:
        return true;

      default:
        return false;
    }
  }


  /**
   * @typedef {BadgeDescriptorSVG | BadgeDescriptorImg} BadgeDescriptor
   */

  /**
   * @typedef {Object} BadgeDescriptorSVG
   * @prop {"svg"} type Indicates that the badge is provided as raw SVG markup.
   * @prop {string} [text]
   * @prop {string} html The raw SVG markup to be rendered directly in the overlay.
   */

  /**
   * @typedef {Object} BadgeDescriptorImg
   * @prop {"img"} type Indicates that the badge is provided as an image URL.
   * @property {string} [text]
   * @property {string} src The URL of the badge image.
   */


  /**
   * @typedef {Object} SourceEventData
   * @property {string} chatname Display name that will be rendered in overlays.
   * @property {(string | BadgeDescriptor)[]} [chatbadges=[]] Badge icons shown beside the author. Strings are image URLs; `BadgeDescriptor` objects can include `{ type, text, src }` for richer badges.
   * @property {string} [backgroundColor] Overrides the background color for highlighted message cards.
   * @property {string} [textColor] Overrides the rendered message text color.
   * @property {string} [nameColor] Overrides the rendered display-name color.
   * @property {string} [chatmessage] Message body; can contain sanitized HTML/emote markup when `textonly` is false.
   * @property {string} [chatimg] Author avatar. Absolute URLs preferred; legacy data URIs remain supported.
   * @property {string} [backupChatimg] Fallback avatar if `chatimg` fails to load.
   * @property {string} [hasDonation] Donation amount with units, e.g., "3 roses" or "$50 USD".
   * @property {number} [donoValue] Numeric donation value in standard currency units (e.g., `5` for $5.00), used for integrations that consume raw donation totals.
   * @property {string} [membership] Short description of a membership/subscription state or label (e.g., "Member" or "Tier 3 Upgrade").
   * @property {string} [contentimg] Optional media attachment for the message (image/gif/mp4/webm).
   * @property {string} type Primary source identifier such as `twitch`, `youtube`, `kick`.
   * @property {string|false} [event=false] Identifies structured events ("follow", "raid", etc.) or false/omitted when the message is standard chat.
   * @property {string} [sourceImg] Optional alternate icon representing a sub-source (ex: channel avatar, Restream origin). 
   * @property {string} [sourceName] Channel title, profile name, or host identifier associated with the source feed.
   * @property {boolean} [textonly] Indicates whether `chatmessage` should be treated as plain text (`true`) or may contain markup (`false`).
   * @property {string} [title] Display title for donations or other highlighted events.
   * @property {string} [subtitle] Additional detail for memberships or donations.
   * @property {boolean} [moderator] Marks the author as a moderator for the source platform.
   * @property {boolean} [admin] Flags elevated/privileged accounts.
   * @property {boolean} [bot] Flags automated or host-generated messages.
   * @property {boolean} [question] Indicates the message has been classified as a question.
   * @property {string} [userid] Stable user identifier from the source platform.
   * @property {number} [karma] Sentiment score; `1.0` positive, `0.0` negative. Provided by AI heuristics when available.
   * @property {number} [id] Internal message identifier assigned by SSN for de-duplication/routing.
   * @property {boolean} [private] Marks direct/private messages that should not be surfaced publicly by default.
   * @property {object} [meta] Extra structured data that doesn't fit elsewhere (viewer counts, membership details, `eventTypeMapping`, etc.).
   */

  /**
   * @param {Omit<SourceEventData, "type" | "question" | "chatname" | "membership" | "userid"> & { chatname?: string }} data
   * @param {any} [user]
   * @returns {Promise<void>}
   */
  async function createAndPushMessage(data, user) {
    /** @type {SourceEventData & {chatbadges: (string | BadgeDescriptor)[]}} */
    const message = {
      chatname: user?.username,
      userid: user?.id,
      question: !data.event && data.chatmessage?.includes("?"),
      chatimg: user?.profileImage?.url ?? generateDefaultAvatar(user.username),
      chatbadges: [],
      // Stream moderators (appointed by host)
      moderator: user?.isNominatedModerator,
      // Whatnot employees
      admin: user?.isModerator || user?.isEmployee,
      ...data,
      type: "whatnot",
    };
    if (user?.loyaltyVisibilityStatusEnabled && user.loyaltyTierForSeller && user.loyaltyTierForSeller !== "NO_TIER") {
      message.membership = user.loyaltyTierForSeller;
      if (badgeIcons[user.loyaltyTierForSeller]) {
        message.chatbadges.push({
          type: "svg",
          text: user.loyaltyTierForSeller,
          html: badgeIcons[user.loyaltyTierForSeller],
        });
        //console.log("Added loyalty badge for tier:", user.loyaltyTierForSeller);
        //console.log("Badge descriptor:", message.chatbadges[message.chatbadges.length - 1]);
      }
    }


    console.log("Pushing message", message);
    await sendMessage(message);
  }

  /**
   * 
   * @param {any} data
   * @returns {Promise<any>} 
   */
  async function sendMessage(data) {
    try {
      return await chrome.runtime.sendMessage({ message: data });
    } catch (e) {
      console.log(e);
    }
  }
  /**
   * @typedef {Object} ExtensionSettings
   * @property {boolean} [bttv] - Whether BTTV emotes are enabled.
   * @property {boolean} [seventv] - Whether 7TV emotes are enabled.
   * @property {boolean} [ffz] - Whether FFZ emotes are enabled.
   * @property {boolean} [delayyoutube] - Whether to delay YouTube capture.
   * @property {boolean} [youtubeLargerFont] - Whether to apply a larger font on YouTube.
   * @property {boolean} [textonlymode] - Whether text-only mode is enabled.
   * @property {boolean} [captureevents] - Whether to capture events.
   * @property {boolean} [capturejoinedevents] - Whether to capture joined events.
   */
  /**
   * @typedef {Object} GetSettingsResponse
   * @property {boolean} state - The current on/off state of the extension.
   * @property {string} [streamID] - The stream ID for WebRTC/transport connection.
   * @property {string} [password] - The password for WebRTC/transport connection.
   * @property {ExtensionSettings} [settings] - The current configuration settings of the extension.
   * @property {any} [documents] - RAG documents if generated/available.
   * @property {any} [handleStatus] - A snapshot of current UI/handle states.
   */
  /**
   * Requests the current settings from the extension.
   * @returns {Promise<GetSettingsResponse?>} A promise that resolves with the settings response from the extension.
   */
  async function requestSettings() {
    if (!checkRuntime()) return null;

    try {
      return await sendMessage({ "getSettings": true });
    } catch (e) {
      return null;
    }
  }

  /** @type {ExtensionSettings} */
  let settings = {};
  requestSettings().then(response => {
    if (response?.settings && typeof response.settings === "object") {
      settings = response.settings;
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      if (request === "getSource") return sendResponse("whatnot");
      if (request === "focusChat") {
        /** @type {HTMLInputElement?} */
        const chatInput = document.querySelector("input.chatInput")
          // New design, currently used when a user that isn't the host is viewing the stream
          || document.querySelector("input[data-testid='chat-input']");

        if (!chatInput) return sendResponse(false);
        try {
          chatInput.focus();
        } catch (e) {
          return sendResponse(false);
        }

        return sendResponse(true);
      }
      if (typeof request?.settings === "object") {
        settings = request.settings;
        return sendResponse(true);
      }
    } catch (e) { }

    return sendResponse(true);
  });
})();