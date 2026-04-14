export type MessageType = 'audio' | 'image' | 'image_with_location' | 'text' | 'gif';

export interface DialogueMessage {
  type: MessageType;
  content: string | Record<string, unknown>;
  delay: number;
}

export interface ButtonOption {
  text: string;
  payload: string;
  next: string;
}

export interface DialogueResponse {
  type: 'text' | 'buttons' | 'continue';
  next?: string;
  options?: ButtonOption[];
  action?: {
    type: 'redirect' | 'open_payment';
    url?: string;
  };
}

export interface DialogueStep {
  messages?: DialogueMessage[];
  response?: DialogueResponse;
  action?: {
    type: 'redirect' | 'open_payment';
    url?: string;
  };
}

export type DialogueMap = Record<string, DialogueStep>;

export interface ChatMessage {
  id: string;
  isUser: boolean;
  type: MessageType;
  content: string;
  timestamp: string;
}

