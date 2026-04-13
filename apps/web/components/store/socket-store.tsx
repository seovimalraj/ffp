"use client";

import { createContext, ReactNode, useContext, useEffect } from "react";
import { getSocket } from "@/lib/socket";

const SocketContext = createContext<any>(null);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const socket = getSocket();

  useEffect(() => {
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
