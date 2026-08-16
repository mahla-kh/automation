import { NextRequest, NextResponse } from "next/server";
import { CRUnoteBookService } from "@/server/services/CRUnoteBook.service";


export async function POST(req: NextRequest) {

    try {

        const body = await req.json();
            console.log('body',body)
        const { noteBookUrl } = body;


        if(!noteBookUrl){
            return NextResponse.json(
                {
                    error:"Folder URL is required"
                },
                {
                    status:400
                }
            );
        }


        const jobData =
            await CRUnoteBookService.start(noteBookUrl);



        return NextResponse.json({
            success:true,
            jobId:jobData
        });


    } catch(error){
        console.log('pipeline start err',error)
        return NextResponse.json(
            {
                error:"Pipeline failed"
            },
            {
                status:500
            }
        );
    }

}