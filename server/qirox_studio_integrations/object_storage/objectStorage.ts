import { Response } from "express";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const UPLOAD_DIR = path.resolve(process.cwd(), "attached_assets", "uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export class MockFile {
  name: string;
  bucket: string;
  _metadata: Record<string, any> = { visibility: "public" };

  constructor(bucket: string, name: string) {
    this.bucket = bucket;
    this.name = name;
  }

  get localPath(): string {
    return path.join(UPLOAD_DIR, this.bucket, this.name);
  }

  async exists(): Promise<[boolean]> {
    return [fs.existsSync(this.localPath)];
  }

  async getMetadata(): Promise<[Record<string, any>]> {
    return [{ contentType: "application/octet-stream", ...this._metadata }];
  }

  async setMetadata(meta: Record<string, any>): Promise<void> {
    this._metadata = { ...this._metadata, ...meta };
  }

  createReadStream() {
    return fs.createReadStream(this.localPath);
  }
}

// Stub storage client
export const objectStorageClient = {
  bucket: (bucketName: string) => ({
    file: (objectName: string) => new MockFile(bucketName, objectName),
  }),
};

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "/uploads/public";
    return pathsStr.split(",").map((p) => p.trim()).filter(Boolean);
  }

  getPrivateObjectDir(): string {
    return process.env.PRIVATE_OBJECT_DIR || "/uploads/private";
  }

  async searchPublicObject(filePath: string): Promise<MockFile | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const file = new MockFile(bucketName, objectName);
      const [exists] = await file.exists();
      if (exists) return file;
    }
    return null;
  }

  async downloadObject(file: MockFile, res: Response, cacheTtlSec: number = 3600) {
    try {
      const [exists] = await file.exists();
      if (!exists) {
        res.status(404).json({ error: "File not found" });
        return;
      }
      const [metadata] = await file.getMetadata();
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });
      const stream = file.createReadStream();
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) res.status(500).json({ error: "Error downloading file" });
    }
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    return `/api/upload/${objectId}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<MockFile> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) throw new ObjectNotFoundError();
    const entityId = parts.slice(1).join("/");
    const file = new MockFile("private", entityId);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();
    return file;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) return rawPath;
    const url = new URL(rawPath);
    return url.pathname;
  }

  async trySetObjectEntityAclPolicy(rawPath: string, aclPolicy: ObjectAclPolicy): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) return normalizedPath;
    try {
      const objectFile = await this.getObjectEntityFile(normalizedPath);
      await setObjectAclPolicy(objectFile as any, aclPolicy);
    } catch {}
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: MockFile;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile: objectFile as any,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  if (parts.length < 3) throw new Error("Invalid path");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}
