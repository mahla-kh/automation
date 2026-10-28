import { DriveFile } from "@/types/drive";
import { google } from "googleapis";
import path from "path";
import fs from "fs";
import { pipeline } from "stream/promises";


const auth =
  new google.auth.GoogleAuth({

    credentials: {
      client_email:
        process.env.GOOGLE_CLIENT_EMAIL,

      private_key:
        process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")
    },

    scopes: [
      "https://www.googleapis.com/auth/drive.readonly"
    ]

  });

const drive =
  google.drive({
    version: "v3",
    auth
  });



export async function getFilesFromFolder(
  folderId: string
) {


  const response =
    await drive.files.list({

      q:
        `'${folderId}' in parents`,

      fields:
        "files(id,name,mimeType)"

    });


  return response.data.files ?? [];

}

export async function downloadFile(
  file: DriveFile
): Promise<string> {

  const tempDir = path.join(process.cwd(), "temp");

  await fs.promises.mkdir(tempDir, {
    recursive: true,
  });

  const localPath = path.join(
    tempDir,
    `${file.id}.pdf`
  );

  const response = await drive.files.get(
    {
      fileId: file.id,
      alt: "media",
    },
    {
      responseType: "stream",
    }
  );

  await pipeline(
    response.data,
    fs.createWriteStream(localPath)
  );

  return localPath;
}