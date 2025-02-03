"use client";

import { useEffect, useState } from "react";
import { WS_URL } from "../app/config";

export function useSocket(token: string) {
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState<WebSocket>();

    useEffect(() => {
        const ws = new WebSocket(`${WS_URL}?token=${token}`); // or hardcode it lol
        ws.onopen = () => {
            setLoading(false);
            setSocket(ws);
        }
    }, [token]);

    return {
        socket,
        loading
    }

}