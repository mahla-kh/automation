import { NextRequest, NextResponse } from "next/server";
import { noteBookService } from "@/server/services/noteBook.service";


export async function POST(req: NextRequest) {

    try {

        const body = await req.json();
            console.log('body',body)
        const { noteBookUrl,batch,qLength } = body;


        if(!batch || !noteBookUrl||!qLength){
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
            await noteBookService.start(noteBookUrl,batch,qLength);



        return NextResponse.json({
            success:true,
            jobId:jobData.jobId
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