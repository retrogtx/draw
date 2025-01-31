import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";

declare global {
    namespace Express {
        interface Request {
            userId?: number;
        }
    }
}

export function middleware(req: Request, res: Response, next: NextFunction) {
    const token = req.headers["authorization"] ?? "";
    
    if (!JWT_SECRET) {
        res.status(500).json({ message: "Server configuration error" });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(403).json({ message: "Unauthorized" });
    }
} 