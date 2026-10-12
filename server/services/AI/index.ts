import { DeepSeekOCR, deepseekOCR } from "./deepseek.service";


export interface OCRProvider{

    extract(

        pdfPath:string , fileName:string

    ):Promise<string>

}

export const ocrService: OCRProvider = new DeepSeekOCR();
export { deepseekOCR };