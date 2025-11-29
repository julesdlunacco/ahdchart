/// <reference types="vite/client" />

interface Window {
  ahdSettings?: {
    pluginUrl: string;
    ajaxUrl: string;
    epheUrl: string;
    theme?: {
        centerColor?: string;
        strokeColor?: string;
        designColor?: string;
        personalityColor?: string;
        textColor?: string;
        arrowColor?: string;
        fontFamily?: string;
    };
  }
  
  ahdAdminSettings?: {
      settings: any;
      nonce: string;
      ajaxUrl: string;
      epheUrl: string;
  }
}
