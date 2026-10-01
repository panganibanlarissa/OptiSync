declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.scss' {
  const content: { [className: string]: string };
  export default content;
}

declare module 'qrcode' {
  type QRCodeOptions = {
    errorCorrectionLevel?: string;
    margin?: number;
    width?: number;
    color?: { dark: string; light: string };
  };

  const QRCode: {
    toDataURL: (text: string, options?: QRCodeOptions) => Promise<string>;
  };

  export default QRCode;
}
