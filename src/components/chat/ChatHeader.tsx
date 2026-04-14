import React, { useEffect, useState } from 'react';
import { ChevronLeft, Video, Phone, MoreVertical } from 'lucide-react';
import { getSetting } from '../../services/settings';

interface HeaderProps {
  status: string;
}

export const ChatHeader: React.FC<HeaderProps> = ({ status }) => {
  const [profileName, setProfileName] = useState(localStorage.getItem('chat_profile_name') || 'Thaisinha');
  const [imageUrl, setImageUrl] = useState(localStorage.getItem('chat_profile_photo') || "https://midia.jdfnu287h7dujn2jndjsifd.com/perfil.webp");

  useEffect(() => {
    const loadSettings = async () => {
      const [name, photo] = await Promise.all([
        getSetting('chat_profile_name'),
        getSetting('chat_profile_photo'),
      ]);
      if (name) { setProfileName(name); localStorage.setItem('chat_profile_name', name); }
      if (photo) { setImageUrl(photo); localStorage.setItem('chat_profile_photo', photo); }
    };
    loadSettings();
  }, []);

  return (
    <div className="bg-[#005E54] text-white p-2.5 flex items-center justify-between z-20 shadow-sm shrink-0">
      <div className="flex items-center gap-2">
        <button className="sm:hidden text-white">
          <ChevronLeft size={24} />
        </button>
        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-300 cursor-pointer">
          <img src={imageUrl} alt="Thaisinha" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col ml-1 justify-center">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[17px] leading-tight">{profileName}</span>
            <img
              src="https://i.imgur.com/BwSw5kR.png"
              alt="Verificado"
              className="w-4 h-4"
            />
          </div>
          <span className={`text-[13px] leading-tight ${status !== 'online' ? 'text-[#25d366]' : 'text-[#d1d1d1]'}`}>
            {status}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-5 text-white">
        <Video size={22} />
        <Phone size={20} />
        <MoreVertical size={20} />
      </div>
    </div>
  );
};
