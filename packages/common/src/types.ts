import { z } from "zod";

export const CreateUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(255),
});

export const SignInSchema = z.object({
  username: z.string().min(1).max(255),
  password: z.string().min(8).max(255),
});

export const CreateRoomSchema = z.object({
  name: z.string().min(1).max(255),
})