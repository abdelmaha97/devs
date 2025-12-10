import { LangData } from "./LangData.js";

export const lang = (locale, dataString) => {
// console.log('dataString', dataString)
const englishKeys = Object.keys(LangData.en).find((e,idx )=> e == dataString);
const arabicKeys = Object.keys(LangData.ar).find((e,idx )=> e == dataString);
  if(locale == 'en'){
    return englishKeys ? Object.values(LangData.en[englishKeys]).join('') : dataString
  } else {
    return arabicKeys ? Object.values(LangData.ar[arabicKeys]).join('') : dataString
  }
};
