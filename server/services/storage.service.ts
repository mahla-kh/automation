import fs from "fs/promises";

export async function saveJson(

name:string,

content:string

){

await fs.writeFile(

`outputs/${name}.json`,

content

);

}