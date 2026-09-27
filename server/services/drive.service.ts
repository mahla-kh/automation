import { DriveFile } from "@/types/drive";
import { google } from "googleapis";
import path from "path";
import fs from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";


const auth =
new google.auth.GoogleAuth({

credentials:{
client_email:
process.env.GOOGLE_CLIENT_EMAIL,

private_key:
process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g,"\n")
},

scopes:[
"https://www.googleapis.com/auth/drive"
]

});

console.log(process.env.GOOGLE_PRIVATE_KEY?.slice(0,50));

const drive =
google.drive({
version:"v3",
auth
});



export async function getFilesFromFolder(
folderId:string
){


const response =
await drive.files.list({

q:
`'${folderId}' in parents`,

fields:
"files(id,name,mimeType)"

});


return response.data.files ?? [];

}

/**
 * Uploads a plain-text string to a Google Drive folder.
 * If a file with the same name already exists in that folder it is overwritten;
 * otherwise a new file is created.  This prevents duplicate files on repeated
 * pipeline runs.
 */
export async function uploadTextToDrive(
  folderId: string,
  fileName: string,
  content: string
) {
  // Check whether the file already exists in the target folder.
  const existing = await drive.files.list({
    q: `'${folderId}' in parents and name = '${fileName.replace(/'/g, "\\'")}'  and trashed = false`,
    fields: "files(id,name)",
    spaces: "drive",
  });

  const existingFile = existing.data.files?.[0];

  if (existingFile?.id) {
    // Overwrite the existing file in-place to avoid duplicates.
    const response = await drive.files.update({
      fileId: existingFile.id,
      media: {
        mimeType: "text/plain",
        body: Readable.from([content]),
      },
      fields: "id,name,mimeType,parents",
    });
    return response.data;
  }

  // No existing file — create a new one.
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: "text/plain",
    },
    media: {
      mimeType: "text/plain",
      body: Readable.from([content]),
    },
    fields: "id,name,mimeType,parents",
  });

  return response.data;
}

/**
 * Uploads a JSON string to a Google Drive folder.
 * Uses the same find-then-update/create upsert strategy as uploadTextToDrive.
 */
export async function uploadJsonToDrive(
  folderId: string,
  fileName: string,
  content: string
) {
  const existing = await drive.files.list({
    q: `'${folderId}' in parents and name = '${fileName.replace(/'/g, "\\'")}'  and trashed = false`,
    fields: "files(id,name)",
    spaces: "drive",
  });

  const existingFile = existing.data.files?.[0];

  if (existingFile?.id) {
    const response = await drive.files.update({
      fileId: existingFile.id,
      media: {
        mimeType: "application/json",
        body: Readable.from([content]),
      },
      fields: "id,name,mimeType,parents",
    });
    return response.data;
  }

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: "application/json",
    },
    media: {
      mimeType: "application/json",
      body: Readable.from([content]),
    },
    fields: "id,name,mimeType,parents",
  });

  return response.data;
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