import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../server/_core/supabase.js";
import { IncomingForm } from "formidable";
import { promises as fs } from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = new IncomingForm();

  try {
    const [fields, files] = await form.parse(req);

    if (!files.file || files.file.length === 0) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const uploadedFile = files.file[0];
    const fileBuffer = await fs.readFile(uploadedFile.filepath);
    const fileName = `${Date.now()}-${uploadedFile.originalFilename}`;
    const bucketName = "jarvis-uploads"; // Você pode configurar isso como uma variável de ambiente

    // Criar o bucket se não existir (apenas para desenvolvimento/primeiro uso)
    // Em produção, o bucket deve ser criado manualmente ou via migração
    try {
      await supabase.storage.getBucket(bucketName);
    } catch (error) {
      console.warn(`Bucket '${bucketName}' not found, attempting to create.`);
      await supabase.storage.createBucket(bucketName, { public: true });
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: uploadedFile.mimetype || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return res.status(500).json({ error: "Failed to upload file to Supabase", details: error.message });
    }

    const publicUrl = supabase.storage.from(bucketName).getPublicUrl(fileName).data.publicUrl;

    return res.status(200).json({ message: "File uploaded successfully", url: publicUrl });
  } catch (error) {
    console.error("File upload error:", error);
    return res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}
