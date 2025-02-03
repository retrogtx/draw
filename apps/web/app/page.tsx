"use client"

import { useRouter } from "next/router";
import { useState } from "react";

export default function Home(){
  const [roomId, setRoomId] = useState("");
  const router = useRouter();
}