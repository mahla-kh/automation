import fs from "fs/promises";
import path from "path";

export async function saveNote(
folder:string,
file:string,

content:string

){
const dir = path.join(process.cwd(), "outputs", folder);

    await fs.mkdir(dir, {
        recursive: true,
    });

    await fs.writeFile(
        path.join(dir, `${file}.txt`),
        content,
        "utf8"
    );

}
export async function saveText(
folder:string,
file:string,

content:string

){
const dir = path.join(process.cwd(), "outputs", folder);

    await fs.mkdir(dir, {
        recursive: true,
    });

    await fs.writeFile(
        path.join(dir, `${file}.txt`),
        content,
        "utf8"
    );

}
export async function saveJson(

folder:string,
file:string,

content:string

){

const dir = path.join(process.cwd(), "outputs", folder);

    await fs.mkdir(dir, {
        recursive: true,
    });

    await fs.writeFile(
        path.join(dir, `${file}.json`),
        content,
        "utf8"
    );

}