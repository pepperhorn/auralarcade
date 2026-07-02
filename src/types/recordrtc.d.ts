declare module "recordrtc" {
  type RecordRTCOptions = {
    type?: "audio" | "video" | "canvas" | "gif";
    mimeType?: string;
  };

  export default class RecordRTC {
    constructor(stream: MediaStream, options?: RecordRTCOptions);
    startRecording(): void;
    stopRecording(callback?: () => void): void;
    getBlob(): Blob;
  }
}
