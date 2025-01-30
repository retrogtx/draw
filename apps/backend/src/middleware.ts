import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
    namespace Express {
        interface Request {
            userId?: number;
        }
    }
}

export function middleware(req: Request, res: Response, next: NextFunction) {
    const token = req.headers["authorization"] ?? "";
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {userId: number};

    if(decoded) {
        req.userId = decoded.userId;
        next();
    } else {
        res.status(403).json({message: "Unauthorized"});
    }
} 