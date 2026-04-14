import { DialogueMap } from './types';

export const BASE_URL = 'https://whatsapp-backend-vott.onrender.com';

export const DIALOGUE: DialogueMap = {
  START: {
    messages: [ { type: 'audio', content: BASE_URL + '/audios/audio01.mp3', delay: 3000 } ],
    response: { type: 'text', next: 'AWAITING_CITY' }
  },
  AWAITING_CITY: {
    messages: [
      { type: 'audio', content: BASE_URL + '/audios/audio02.mp3', delay: 6000 },
      { type: 'image_with_location', content: {}, delay: 4500 },
      { type: 'text', content: 'Sou aqui de {{city}}', delay: 3000 },
      { type: 'text', content: 'Me diz de qual cidade você é amor 🥰😈', delay: 3500 }
    ],
    response: { type: 'text', next: 'AWAITING_ROMANCE_CHOICE' }
  },
  AWAITING_ROMANCE_CHOICE: {
    messages: [
      { type: 'audio', content: BASE_URL + '/audios/audio03.mp3', delay: 7000 },
      { type: 'audio', content: BASE_URL + '/audios/audio04.mp3', delay: 6000 }
    ],
    response: {
      type: 'buttons',
      options: [
        { text: "Sou mais safado", payload: "SELECT_NAUGHTY", next: 'NAUGHTY_PATH' },
        { text: "Sou mais Romântico", payload: "SELECT_CARING", next: 'CARING_PATH' }
      ]
    }
  },
  NAUGHTY_PATH: {
    messages: [ { type: 'audio', content: BASE_URL + '/audios/audio05.mp3', delay: 8000 } ],
    response: { type: 'continue', next: 'POST_CHOICE_AUDIO' }
  },
  CARING_PATH: {
    messages: [ { type: 'audio', content: BASE_URL + '/audios/audio06.mp3', delay: 8000 } ],
    response: { type: 'continue', next: 'POST_CHOICE_AUDIO' }
  },
  POST_CHOICE_AUDIO: {
    messages: [ { type: 'audio', content: BASE_URL + '/audios/audio07.mp3', delay: 9000 } ],
    response: { type: 'continue', next: 'AWAITING_CONFIRM_JOIN' }
  },
  AWAITING_CONFIRM_JOIN: {
    messages: [ { type: 'audio', content: BASE_URL + '/audios/audio08.mp3', delay: 7000 } ],
    response: {
      type: 'buttons',
      options: [ { text: "Entro sim meu amor ❤️", payload: "CONFIRM_JOIN", next: 'AWAITING_NO_OBJECTION' } ]
    }
  },
  AWAITING_NO_OBJECTION: {
    messages: [
      { type: 'audio', content: BASE_URL + '/audios/audio09.mp3', delay: 7000 },
      { type: 'audio', content: BASE_URL + '/audios/audio10.mp3', delay: 6000 },
      { type: 'audio', content: BASE_URL + '/audios/audio13.mp3', delay: 6500 },
      { type: 'image', content: 'https://midia.jdfnu287h7dujn2jndjsifd.com/oi6gtpxvamkpw9g2661pohgv.jpeg', delay: 5000 },
      { type: 'image', content: 'https://dimukzjiyqzdndqrbwkf.supabase.co/storage/v1/object/public/chat-assets/clube-secreto-preview.png', delay: 4000 },
    ],
    response: {
      type: 'buttons',
      options: [ { text: "Combinado❤️", payload: "CONFIRM_COMBINED", next: 'AWAITING_COMBINED' } ]
    }
  },
  AWAITING_COMBINED: {
    messages: [
      { type: 'audio', content: BASE_URL + '/audios/audio15.mp3', delay: 7000 },
      { type: 'audio', content: BASE_URL + '/audios/audio16.mp3', delay: 7000 }
    ],
    response: {
      type: 'buttons',
      options: [ { text: "Entendi meu amor❤️", payload: "CONFIRM_UNDERSTOOD", next: 'AWAITING_ENTER_CLUB' } ]
    }
  },
  AWAITING_ENTER_CLUB: {
    messages: [
      { type: 'audio', content: BASE_URL + '/audios/audio17.mp3', delay: 6000 },
      { type: 'audio', content: BASE_URL + '/audios/audio18.mp3', delay: 8000 },
      { type: 'audio', content: BASE_URL + '/audios/audio19.mp3', delay: 5000 },
      { type: 'gif', content: 'https://midia.jdfnu287h7dujn2jndjsifd.com/ohjlvxht3us81l3l5c6sckxx.gif', delay: 5000 },
      { type: 'audio', content: BASE_URL + '/audios/audio20.mp3', delay: 7000 },
      { type: 'audio', content: BASE_URL + '/audios/audio21.mp3', delay: 7000 },
      { type: 'audio', content: BASE_URL + '/audios/audio22.mp3', delay: 5000 },
      { type: 'audio', content: BASE_URL + '/audios/audio23.mp3', delay: 10000 }
    ],
    response: {
      type: 'buttons',
      options: [ { text: "ENTRAR NO CLUBE SECRETO 🔥", payload: "ENTER_CLUB", next: 'OPEN_PAYMENT_MODAL' } ]
    }
  },
  OPEN_PAYMENT_MODAL: {
    action: {
      type: 'open_payment'
    }
  }
};
