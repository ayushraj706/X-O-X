// src/components/common/ProfileDropdown.js
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '../../context/AuthContext';

export default function ProfileDropdown() {
  const { profile, logout, logoutAll } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!profile) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-10 w-10 rounded-full overflow-hidden ring-2 ring-wa-green hover:ring-offset-2 hover:ring-offset-transparent transition"
      >
        {profile.photoURL ? (
          <Image src={profile.photoURL} alt={profile.name} width={40} height={40} className="object-cover" />
        ) : (
          <div className="h-full w-full bg-wa-gradient flex items-center justify-center text-white font-bold">
            {profile.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl shadow-2xl bg-white dark:bg-wa-panelDark border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          <div className="p-4 bg-wa-gradient text-white">
            <div className="flex items-center gap-3">
              {profile.photoURL ? (
                <Image
                  src={profile.photoURL}
                  alt={profile.name}
                  width={48}
                  height={48}
                  className="rounded-full object-cover ring-2 ring-white"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center font-bold">
                  {profile.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold truncate">{profile.name}</p>
                <p className="text-xs text-white/80 truncate">{profile.email}</p>
              </div>
            </div>
          </div>

          <div className="p-4 text-sm space-y-1 text-gray-700 dark:text-gray-300">
            <p><span className="font-medium">UID:</span> <span className="break-all">{profile.uid}</span></p>
            <p><span className="font-medium">Email Verified:</span> {profile.emailVerified ? 'Yes' : 'No'}</p>
            <p><span className="font-medium">Provider:</span> {profile.providerId}</p>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 p-2 space-y-1">
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 transition"
            >
              🚪 Logout
            </button>
            <button
              onClick={() => { setOpen(false); logoutAll(); }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition"
            >
              🔒 Logout All Devices
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
