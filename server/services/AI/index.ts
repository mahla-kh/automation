import { MistralOCR } from "./mistral.service";


export interface OCRProvider{

    extract(

        pdfPath:string , fileName:string

    ):Promise<string>

}

export const ocrService= new MistralOCR();