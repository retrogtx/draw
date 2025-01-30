import express from "express";
import jwt from "jsonwebtoken";
import { middleware } from "./middleware";
import { CreateUserSchema, SignInSchema, CreateRoomSchema } from "@repo/common/types";

const app = express();

app.post("/signup", (req, res) => {
  const data = CreateUserSchema.safeParse(req.body);
  if (!data.success) {
    res.status(400).json({message: "Invalid request"});
  }
  res.json({message: "User created"});
  return;
})    

app.post("/signin", (req, res) => {
  const data = SignInSchema.safeParse(req.body);
  if (!data.success) {
      res.status(400).json({message: "Invalid request"});
      return;
    }
  const userId = 1;
  if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined");
    }
  const token = jwt.sign({userId}, process.env.JWT_SECRET);
    res.json({token});
});

app.post("/room", middleware, (req, res) => {
  const data = CreateRoomSchema.safeParse(req.body);
  if (!data.success) {
    res.status(400).json({message: "Invalid request"});
    return; 
  }
  res.json({message: "Room created"});
});

app.listen(3001);