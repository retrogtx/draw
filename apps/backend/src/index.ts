import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { middleware } from "./middleware";
import { CreateUserSchema, SignInSchema, CreateRoomSchema } from "@repo/common/types";
import { prismaClient } from "@repo/db/client";
import { JWT_SECRET } from "@repo/backend-common/config";

const app = express();
app.use(express.json());

app.post("/signup", async (req, res) => {
  const parsedData = CreateUserSchema.safeParse(req.body);
  if (!parsedData.success) {
    console.log(parsedData.error);
    res.status(400).json({message: "Invalid request"});
    return;
  }
  try {
    const user = await prismaClient.user.create({
      data: {
        email: parsedData.data.email,
        password: bcrypt.hashSync(parsedData.data.password, 10),
        name: parsedData.data.name,
    },
  });
  res.json({userId: user.id})}
  catch (error) {
    res.status(500).json({message: "User already exists"});
    return;
  }
})    

app.post("/signin", async (req, res) => {
  const parsedData = SignInSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({message: "Invalid request"});
    return;
  }

  const user = await prismaClient.user.findUnique({
    where: {
      email: parsedData.data.email,
    },
  });
  
  if (!user || !bcrypt.compareSync(parsedData.data.password, user.password)) {
    res.status(403).json({message: "Invalid credentials"});
    return;
  }

  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
  }
  const token = jwt.sign({userId: user.id}, JWT_SECRET);
  res.json({token});
});

app.post("/room", middleware, async (req, res) => {
  const parsedData = CreateRoomSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({message: "Invalid request"});
    return; 
  }

  const userId = req.userId;
  if (!userId) {
    res.status(401).json({message: "Unauthorized"});
    return;
  }
  
  try {
    const room = await prismaClient.room.create({
      data: {
        slug: parsedData.data.name,
        adminId: userId.toString(),
      },
    });

    res.json({roomId: room.id});
  } catch (error) {
    res.status(411).json({message: "Room already exists"});
    return;
  }
});

app.get("chats/:roomId", async (req, res) => {
  const roomId = Number(req.params.roomId);
  const messages = await prismaClient.chat.findMany({
    where: {
      roomId: roomId,
    },
    orderBy: {
      id: "desc",
    },
    take: 50
  })

  res.json({messages});
})
app.listen(3001); 